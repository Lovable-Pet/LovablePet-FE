import { useCallback, useEffect, useRef, useState } from 'react'
import { describeGaze, GazeController, type GazePose } from './gaze/gazeController'
import type { GazeTuning } from './gaze/gazeSpec'
import type { GazeHost } from './gaze/gazeStage'
import { StandTurn, type TurnPlan } from './walk/standTurn'
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
  /** 가까이 앉기·일어나기 (?closesit). 받아서 시작했으면 true */
  requestPose?: (pose: 'sit' | 'stand') => boolean
  /** 카메라가 너무 가까워 개를 숨긴 동안: 판단을 멈춘다 (고개는 그 자리, 몸 돌리기·가까이 앉기 없음) */
  isHidden?: () => boolean
}

const DEBUG_INTERVAL_MS = 200

/**
 * AR 고개 바라보기 + 몸 돌리기. host 는 useArPlacement 의 gazeHost (개를 놓은 뒤에만 있다).
 * 매 XR 프레임 판단(GazeController)을 돌려 다음 렌더에 더할 고개 방향을 넘긴다. 몸 돌리기는 산책 중이면 산책(서 있는 단계)에,
 * 아니면 StandTurn 에 맡긴다
 */
export function useArGaze(host: GazeHost | null, options: ArGazeOptions): ArGaze {
  const { enabled, offReason, debug, template, tuning, turnSpeed, walkHost } = options
  const latest = useRef(options)
  useEffect(() => {
    latest.current = options
  })
  const controllerRef = useRef<GazeController | null>(null)
  const standTurnRef = useRef<StandTurn | null>(null)
  const [turning, setTurning] = useState(false)
  const [debugLine, setDebugLine] = useState<string | null>(null)

  // 산책 밖 몸 돌리기. 다시 놓거나 AR 이 끝나면 버린다 (도는 중이면 서기로 바로 돌려준다)
  useEffect(() => {
    if (!walkHost) return
    const standTurn = new StandTurn(walkHost, { turnSpeed, onChange: setTurning })
    standTurnRef.current = standTurn
    return () => {
      standTurn.dispose()
      if (standTurnRef.current === standTurn) standTurnRef.current = null
      setTurning(false)
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
        if (walk.active) return walk.requestTurn(reason)
        return standTurnRef.current?.start(need, clip as TurnPlan['clip']) ?? false
      },
      onPose: (pose) => latest.current.requestPose?.(pose) ?? false,
    })
    controllerRef.current = controller
    let lastDebugAt = -Infinity
    /** ?debug 바닥 윤곽을 그렸는지 (산책 발자취 점과 같은 자리를 쓴다) */
    let outlineShown = false
    let lastOutlineAt = -Infinity
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
    }
  }, [host, enabled, debug, template, tuning, walkHost])

  const trigger = useCallback((kind: 'tap' | 'mic') => controllerRef.current?.trigger(kind), [])
  const isTurning = useCallback(() => !!standTurnRef.current?.turning, [])
  const userCommand = useCallback(() => controllerRef.current?.userCommand(), [])
  return {
    turning,
    debugLine: !debug ? null : !enabled ? `고개: 꺼짐 (${offReason ?? '?'})` : host ? debugLine : null,
    trigger,
    isTurning,
    userCommand,
  }
}
