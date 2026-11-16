import { useCallback, useEffect, useRef, useState } from 'react'
import {
  WalkController,
  type WalkDebug,
  type WalkNotice,
  type WalkPhase,
  type WalkSnapshot,
  type WalkTuning,
} from './walk/walkController'
import type { WalkHost } from './walk/walkStage'

export interface ArWalk {
  /** '산책' 버튼을 보일지: 놓은 뒤 + 서기 루프만 도는 중 + 걷기 클립·extras.walk 가 있음 (안드로이드 WebXR 만) */
  available: boolean
  /** 산책 중 (명령 칩·음성·개 탭 반응을 막는다) */
  active: boolean
  phase: WalkPhase | null
  /** 산책 끝을 눌러 멈추는 중 */
  ending: boolean
  notice: WalkNotice | null
  /** ?debug 일 때 상태·s·v0·r0·v/v0·timeScale·거리·발자취(벗어난 거리)·예상 정지·회전. 아니면 null. 발자취 점·겨누는 점은 바닥에 찍는다 */
  debug: WalkDebug | null
  start: () => void
  /** 걷는 중이면 다음 루프 끝에서 멈춘 뒤 서기로, 서 있으면 바로 끝낸다 */
  end: () => void
}

const IDLE: WalkSnapshot = { phase: 'standing', ending: false, notice: null }

/**
 * AR 산책 모드. host 는 useArPlacement 의 walkHost (개를 놓은 뒤에만 있다).
 * canStart: 개가 서기 루프만 돌고 있는지 (명령·반응이 재생 중이면 걷기 클립으로 바꾸면 튄다)
 */
export function useArWalk(
  host: WalkHost | null,
  { canStart, debug, tuning }: { canStart: boolean; debug: boolean; /** 개발용 ?floor·?keep·?tight (다음 산책부터) */ tuning?: WalkTuning },
): ArWalk {
  const controllerRef = useRef<WalkController | null>(null)
  /** 돌고 있는 산책이 받은 host. 지금 host 와 다르면(다시 놓기·AR 끝) 산책은 끝난 것이다 */
  const ownerRef = useRef<WalkHost | null>(null)
  const [owner, setOwner] = useState<WalkHost | null>(null)
  const [snapshot, setSnapshot] = useState<WalkSnapshot>(IDLE)
  const [debugInfo, setDebugInfo] = useState<WalkDebug | null>(null)
  const debugRef = useRef(debug)
  const tuningRef = useRef(tuning)
  useEffect(() => {
    debugRef.current = debug
    tuningRef.current = tuning
  }, [debug, tuning])

  // 놓은 개가 없어지거나 바뀌면 산책을 버린다 (상태는 owner !== host 로 꺼진다)
  useEffect(() => {
    if (!ownerRef.current || ownerRef.current === host) return
    controllerRef.current?.dispose()
    controllerRef.current = null
    ownerRef.current = null
  }, [host])

  useEffect(
    () => () => {
      controllerRef.current?.dispose()
      controllerRef.current = null
      ownerRef.current = null
    },
    [],
  )

  const start = useCallback(() => {
    if (!host || controllerRef.current || !canStart) return
    const controller = new WalkController(host, {
      onChange: setSnapshot,
      onFinished: () => {
        if (controllerRef.current !== controller) return
        controllerRef.current = null
        ownerRef.current = null
        setOwner(null)
      },
      onDebug: debugRef.current ? setDebugInfo : undefined,
      tuning: tuningRef.current,
    })
    controllerRef.current = controller
    ownerRef.current = host
    setSnapshot(IDLE)
    setDebugInfo(null)
    setOwner(host)
    controller.start()
  }, [host, canStart])

  const end = useCallback(() => controllerRef.current?.end(), [])

  const active = owner !== null && owner === host
  return {
    available: !!host && canStart && !active,
    active,
    phase: active ? snapshot.phase : null,
    ending: active && snapshot.ending,
    notice: active ? snapshot.notice : null,
    debug: active ? debugInfo : null,
    start,
    end,
  }
}
