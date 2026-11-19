import { useCallback, useEffect, useRef, useState } from 'react'
import { describeNear, NearCamera, type NearHost, type NearState, type NearTuning } from './nearCamera'

export interface ArNear {
  /** 위 안내 문구를 '너무 가까워요' 로 바꿀지 */
  hint: boolean
  /** ?debug 한 줄 (거리·상태·방식). 아니면 null */
  debugLine: string | null
  /** 지금 개를 숨겼는지 (상태 갱신을 기다리지 않고 읽는다). 숨긴 동안 바라보기 판단을 멈춘다 */
  isHidden: () => boolean
}

const DEBUG_INTERVAL_MS = 200

/**
 * 카메라가 개에 너무 가까울 때: 매 XR 프레임 카메라에서 개 몸까지 재서 안내를 바꾸고, 더 가까우면 개·그림자를 흐리거나 숨긴다.
 * host 는 useArPlacement 의 nearHost (개를 놓은 뒤에만). 다시 놓거나 AR 이 끝나면 원래대로 돌린다
 */
export function useArNear(
  host: NearHost | null,
  {
    debug,
    tuning,
    onLog,
  }: {
    debug: boolean
    tuning?: NearTuning
    /** 개발 기록 (?debug 이벤트 기록): 가까움 구역이 바뀔 때. 개발 모드에서만 부른다 */
    onLog?: (text: string) => void
  },
): ArNear {
  const [hint, setHint] = useState(false)
  const [debugLine, setDebugLine] = useState<string | null>(null)
  const stateRef = useRef<NearState | null>(null)
  const onLogRef = useRef(onLog)
  useEffect(() => {
    onLogRef.current = onLog
  })

  useEffect(() => {
    if (!host) return
    const near = new NearCamera(tuning)
    let lastHint = false
    let lastDebugAt = -Infinity
    const unsubscribe = host.subscribe((frame) => {
      const distance = frame.tracking ? host.rig.distance(frame.camera) : null
      const state = near.update(frame.time, distance)
      if (import.meta.env.DEV && onLogRef.current && state.zone !== stateRef.current?.zone) {
        onLogRef.current(`${describeNear(state, near.mode)}${state.zone === 'hidden' ? ' (숨김)' : stateRef.current?.zone === 'hidden' ? ' (나타남)' : ''}`)
      }
      stateRef.current = state
      host.rig.setOpacity(state.opacity, near.mode)
      if (state.hint !== lastHint) {
        lastHint = state.hint
        setHint(state.hint)
      }
      if (debug && frame.time - lastDebugAt >= DEBUG_INTERVAL_MS) {
        lastDebugAt = frame.time
        setDebugLine(describeNear(state, near.mode))
      }
    })
    return () => {
      unsubscribe()
      host.rig.setOpacity(1, near.mode)
      stateRef.current = null
      setHint(false)
      setDebugLine(null)
    }
  }, [host, debug, tuning])

  const isHidden = useCallback(() => stateRef.current?.zone === 'hidden', [])
  return { hint: host ? hint : false, debugLine: debug && host ? debugLine : null, isHidden }
}
