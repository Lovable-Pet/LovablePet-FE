import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { describeGaze, GazeController, type GazePose } from './gaze/gazeController'
import type { GazeTuning } from './gaze/gazeSpec'
import type { GazeHost } from './gaze/gazeStage'
import { StandTurn, type TurnPlan } from './walk/standTurn'
import { walkSpec } from './walk/walkSpec'
import type { WalkHost } from './walk/walkStage'

export interface ArGaze {
  /** 산책 밖 몸 돌리기(제자리 회전) 중. 명령·개 탭·산책 시작을 막는다 */
  turning: boolean
  /** ?debug 한 줄 (고개 상태·목표·weight·다음 바뀜·몸 회전 대기). 아니면 null */
  debugLine: string | null
  /** 바로 바라보는 계기 */
  trigger: (kind: 'tap' | 'mic') => void
  /** 지금 몸을 돌리는 중인지 (상태 갱신을 기다리지 않고 읽는다) */
  isTurning: () => boolean
  /** 사용자가 명령을 내림 ('스스로 앉음' 지우기) */
  userCommand: () => void
  /** 몸 돌려 따라보기를 할 수 있는 개인지 (바라보기 켜짐 + 제자리 회전 클립 + 몸 돌리기 켜짐): '따라보기' 토글을 보일지 */
  canFollow: boolean
  /** 따라보기 켜짐인데 쓸고 지나가는 자리에 사용자가 있어 3초 넘게 못 돎 ('한 걸음 물러나면 돌아봐요') */
  stepBack: boolean
}

export interface ArGazeOptions {
  enabled: boolean
  /** 꺼져 있을 때 ?debug 에 보일 까닭 */
  offReason?: string
  debug: boolean
  /** 템플릿 이름 (템플릿별 한계) */
  template: string | null
  /** 개발용 ?gazemax·?gazeup·?gazeon·?gazeoff·?bodyturn */
  tuning?: GazeTuning
  /** 제자리 회전 재생 배율 (개발용 ?turnspeed) */
  turnSpeed?: number
  /** 매 프레임 읽는 명령 상태 (DogAnimator) */
  readAnimator: () => { pose: GazePose; busy: boolean }
  /** 매 프레임 읽는 산책 상태: 산책 모드인지 · 그중 서 있는 단계인지 · 서 있는 단계의 몸 돌리기 */
  readWalk: () => { active: boolean; standing: boolean; requestTurn: (reason: string) => boolean }
  /** 산책 밖 몸 돌리기에 쓸 리그 (회전 클립이 없으면 고개만) */
  walkHost: WalkHost | null
  /** 가까이 앉기·일어나기 (기본 켬, ?closesit=0 끔). 받아서 시작했으면 true */
  requestPose?: (pose: 'sit' | 'stand') => boolean
  /** 몸 돌려 따라보기 (끄면 고개만: 몸 돌리기·가까이 앉기·일어나기 없음). 꺼짐 → 켜짐이면 한계 밖일 때 바로 돈다 */
  follow: boolean
  /** 카메라가 너무 가까워 개를 숨긴 동안: 판단을 멈춘다 (고개는 그 자리, 몸 돌리기·가까이 앉기 없음) */
  isHidden?: () => boolean
  /** 산책 밖 몸 돌리기가 시작·끝날 때 바로 (상태 갱신을 기다리지 않는다: 그동안 명령을 예약한다) */
  onTurning?: (turning: boolean) => void
  /** 개발 기록 (?debug 이벤트 기록): 고개 상태·몸 돌리기·가까이 앉기가 바뀔 때. 개발 모드에서만 부른다 */
  onLog?: (kind: string, text: string) => void
}

const DEBUG_INTERVAL_MS = 200

interface LoggedGaze {
  state: string | null
  block: string | null
  near: string | null
  waiting: boolean
}
const GAZE_STATE_LABEL: Record<string, string> = {
  look: '보는 중',
  react: '반응 늦춤',
  away: '딴청',
  out: '한계 밖',
  hold: '동작 중 (세기 0)',
  off: '꺼짐',
}

/** 개발 기록: 고개 상태·몸 돌리기 기다림·막힘 까닭·가까움(가까이 앉기 등) 줄이 바뀌었으면 적는다 (숫자는 지워 같은 상태를 한 번만) */
function logChanges(log: (kind: string, text: string) => void, controller: GazeController, last: LoggedGaze) {
  const debug = controller.debug
  if (debug.state !== last.state) {
    last.state = debug.state
    const out = debug.state === 'out' ? ` ${debug.outFor.toFixed(1)} s` : ''
    log('고개', `${GAZE_STATE_LABEL[debug.state] ?? debug.state}${out}${debug.rawYaw !== null ? ` · 사용자 ${Math.round(debug.rawYaw)}°` : ''}`)
  }
  const waiting = debug.bodyTurnIn !== null
  if (waiting !== last.waiting) {
    last.waiting = waiting
    log('몸 돌리기', waiting ? `기다림 ${debug.bodyTurnIn?.toFixed(1)} s (몸 기준 ${debug.bodyTurnAngle?.toFixed(0) ?? '?'}°)` : '기다림 끝')
  }
  const block = debug.bodyTurnBlock?.replace(/[\d.]+/g, '#') ?? null
  if (block !== last.block) {
    last.block = block
    log('몸 돌리기', debug.bodyTurnBlock ? `막힘: ${debug.bodyTurnBlock}` : '막힘 풀림')
  }
  const near = debug.near?.replace(/[\d.]+/g, '#') ?? null
  if (near !== last.near) {
    last.near = near
    // 종류가 이미 '가까이 앉기' 라 보류 문구 앞머리는 뺀다
    log('가까이 앉기', debug.near?.replace('가까이 앉기: ', '') ?? '없음')
  }
}

/**
 * AR 고개 바라보기 + 몸 돌리기. host 는 useArPlacement 의 gazeHost (개를 놓은 뒤에만 있다).
 * 매 XR 프레임 판단(GazeController)을 돌려 다음 렌더에 더할 고개 방향을 넘긴다. 몸 돌리기는 산책 중이면 산책(서 있는 단계)에,
 * 아니면 StandTurn 에 맡긴다
 */
export function useArGaze(host: GazeHost | null, options: ArGazeOptions): ArGaze {
  const { enabled, offReason, debug, template, tuning, turnSpeed, walkHost, follow } = options
  const latest = useRef(options)
  useEffect(() => {
    latest.current = options
  })
  /** 회전 클립이 있는 개 (StandTurn.available 과 같은 기준) · 산책 리그의 몸길이 (m, 가까이 앉은 뒤 일어나는 거리) */
  const walkInfo = useMemo(() => {
    if (!walkHost) return { hasTurns: false, bodyLength: null }
    const spec = walkSpec(walkHost.rig.info)
    return { hasTurns: (spec.turns?.length ?? 0) > 0, bodyLength: spec.bodyLength }
  }, [walkHost])
  const canFollow = enabled && !!host && walkInfo.hasTurns && tuning?.bodyTurnS !== 0
  /** 토글이 없는 개 (회전 클립 없음) 는 늘 켜짐: 다른 개에서 끈 상태가 남아 가까이 앉기·일어나기를 막지 않게 */
  const effectiveFollow = follow || !canFollow
  const followRef = useRef(effectiveFollow)
  useEffect(() => {
    followRef.current = effectiveFollow
  })
  const controllerRef = useRef<GazeController | null>(null)
  const standTurnRef = useRef<StandTurn | null>(null)
  const [turning, setTurning] = useState(false)
  const [debugLine, setDebugLine] = useState<string | null>(null)
  const [stepBack, setStepBack] = useState(false)

  // 산책 밖 몸 돌리기. 다시 놓거나 AR 이 끝나면 버린다 (도는 중이면 서기로 바로 돌려준다)
  useEffect(() => {
    if (!walkHost) return
    let turningNow = false
    const onChange = (next: boolean) => {
      setTurning(next)
      latest.current.onTurning?.(next)
      if (import.meta.env.DEV && turningNow && !next) latest.current.onLog?.('몸 돌리기', '끝')
      turningNow = next
    }
    const standTurn = new StandTurn(walkHost, { turnSpeed, onChange })
    standTurnRef.current = standTurn
    return () => {
      standTurn.dispose()
      if (standTurnRef.current === standTurn) standTurnRef.current = null
      onChange(false)
    }
  }, [walkHost, turnSpeed])

  useEffect(() => {
    if (!host) return
    if (!enabled) {
      host.rig.set(null)
      return
    }
    const controller = new GazeController({
      template,
      tuning,
      onTurn: (need, reason, clip) => {
        const walk = latest.current.readWalk()
        const started = walk.active ? walk.requestTurn(reason) : (standTurnRef.current?.start(need, clip as TurnPlan['clip']) ?? false)
        if (import.meta.env.DEV) {
          const deg = Math.round((need * 180) / Math.PI)
          latest.current.onLog?.('몸 돌리기', `${started ? '시작' : '못 함'} ${clip ?? ''} (몸 기준 ${deg > 0 ? '+' : ''}${deg}°${walk.active ? ', 산책 중' : ''}) · ${reason}`)
        }
        return started
      },
      onPose: (pose) => latest.current.requestPose?.(pose) ?? false,
      // 다시 놓기·산책으로 새로 만들어도 지금 상태 그대로
      follow: followRef.current,
      bodyLength: walkInfo.bodyLength,
    })
    controllerRef.current = controller
    let lastDebugAt = -Infinity
    /** ?debug 바닥 윤곽을 그렸는지 (산책 발자취 점과 같은 자리를 쓴다) */
    let outlineShown = false
    let lastOutlineAt = -Infinity
    /** 개발 기록: 지난 프레임에 적은 값 (바뀐 때만 적는다) */
    const logged: LoggedGaze = { state: null, block: null, near: null, waiting: false }
    const unsubscribe = host.subscribe((frame) => {
      const { readAnimator, readWalk, isHidden } = latest.current
      if (isHidden?.()) return
      const { pose, busy } = readAnimator()
      const walk = readWalk()
      const standTurn = standTurnRef.current
      const canTurn = !!standTurn?.available && (walk.active ? walk.standing : !standTurn.turning)
      // 쓸고 지나가는 자리 검사. 산책 중이면 산책이 고르는 클립 하나만 (다른 클립으로 바꾸지 않는다)
      const checked: { plan: TurnPlan | null } = { plan: null }
      const turnCheck = standTurn?.available
        ? (need: number) => (checked.plan = standTurn.plan(need, frame.camera, !walk.active))
        : undefined
      const command = controller.update({
        time: frame.time,
        camera: frame.camera,
        tracking: frame.tracking,
        sample: host.rig.sample(),
        busy,
        pose,
        walking: walk.active,
        canTurn,
        turnCheck,
      })
      host.rig.set(command)
      if (import.meta.env.DEV && latest.current.onLog) logChanges(latest.current.onLog, controller, logged)
      // 같은 값이면 React 가 다시 그리지 않는다
      setStepBack(controller.stepBackHint)
      // ?debug: 몸 돌리기를 기다리는 동안 처음 고른 클립이 쓸고 지나가는 자리 윤곽 (흰 점) 과 사용자 발 (진한 점)
      if (debug && walkHost?.showPath && !walk.active) {
        const waiting = controller.debug.bodyTurnIn !== null || /겹침/.test(controller.debug.bodyTurnBlock ?? '')
        const shown = waiting ? checked.plan : null
        if (shown && frame.time - lastOutlineAt >= DEBUG_INTERVAL_MS) {
          lastOutlineAt = frame.time
          walkHost.showPath({ points: shown.outline, aim: shown.feet, y: shown.y })
          outlineShown = true
        } else if (!shown && outlineShown) {
          walkHost.showPath(null)
          outlineShown = false
        }
      }
      if (debug && frame.time - lastDebugAt >= DEBUG_INTERVAL_MS) {
        lastDebugAt = frame.time
        setDebugLine(describeGaze(controller.debug))
      }
    })
    return () => {
      unsubscribe()
      if (outlineShown && !latest.current.readWalk().active) walkHost?.showPath?.(null)
      host.rig.set(null)
      if (controllerRef.current === controller) controllerRef.current = null
      setDebugLine(null)
      setStepBack(false)
    }
  }, [host, enabled, debug, template, tuning, walkHost, walkInfo])

  // 토글: 지금 컨트롤러에 바로 (새로 만들 때는 위에서 latest 로 읽는다)
  useEffect(() => {
    controllerRef.current?.setFollow(effectiveFollow)
  }, [effectiveFollow])

  const trigger = useCallback((kind: 'tap' | 'mic') => controllerRef.current?.trigger(kind), [])
  const isTurning = useCallback(() => !!standTurnRef.current?.turning, [])
  const userCommand = useCallback(() => controllerRef.current?.userCommand(), [])
  return {
    turning,
    debugLine: !debug ? null : !enabled ? `고개: 꺼짐 (${offReason ?? '?'})` : host ? debugLine : null,
    trigger,
    isTurning,
    userCommand,
    canFollow,
    stepBack: stepBack && enabled && !!host,
  }
}
