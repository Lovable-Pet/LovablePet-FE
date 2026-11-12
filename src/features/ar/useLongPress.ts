import { useCallback, useEffect, useRef, useState } from 'react'

/** 길게 누르기로 보는 시간 */
export const LONG_PRESS_MS = 3000

export interface PressPoint {
  x: number
  y: number
}

/** React 의 PointerEvent 와 DOM PointerEvent 둘 다 받는다 */
type PointerLike = Pick<PointerEvent, 'pointerId' | 'clientX' | 'clientY' | 'target'>

interface LongPressOptions<E extends PointerLike> {
  enabled: boolean
  onLongPress: () => void
  /** 이만큼 넘게 움직이면 취소한다 (탭과 드래그를 가르는 거리와 같게) */
  slopPx: number
  /** 누른 곳에서 시작해도 되는지 (개를 맞혔는지 등) */
  canStart?: (event: E) => boolean
  delayMs?: number
}

/**
 * 누른 채 slopPx 넘게 움직이지 않고 delayMs 가 지나면 onLongPress.
 * 손가락이 하나 더 닿거나(확대·회전), 움직이거나, 떼면 취소한다.
 * 길게 누르기가 일어난 누르기는 손을 뗄 때의 탭·클릭을 내지 않게 알려 준다 (onPointerUp 의 반환값, onClickCapture)
 */
export function useLongPress<E extends PointerLike>({
  enabled,
  onLongPress,
  slopPx,
  canStart,
  delayMs = LONG_PRESS_MS,
}: LongPressOptions<E>) {
  /** 누르고 있는 곳 (진행 표시용). 누르지 않으면 null */
  const [press, setPress] = useState<PressPoint | null>(null)
  const pressRef = useRef<(PressPoint & { pointerId: number }) | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  /** 지금 누르기에서 길게 누르기가 일어났다. 다음 누르기에서 지운다 */
  const firedRef = useRef(false)
  const latest = useRef({ onLongPress, canStart, enabled })
  useEffect(() => {
    latest.current = { onLongPress, canStart, enabled }
  })

  const cancel = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = null
    pressRef.current = null
    setPress(null)
  }, [])

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current)
  }, [])

  const onPointerDown = useCallback(
    (event: E) => {
      // 누르는 중에 손가락이 하나 더 닿으면 확대·회전이라 취소한다
      if (pressRef.current) {
        cancel()
        return
      }
      firedRef.current = false
      if (!enabled || (latest.current.canStart && !latest.current.canStart(event))) return
      const point = { x: event.clientX, y: event.clientY }
      pressRef.current = { ...point, pointerId: event.pointerId }
      setPress(point)
      timerRef.current = setTimeout(() => {
        timerRef.current = null
        pressRef.current = null
        setPress(null)
        // 누르는 사이 꺼졌으면(AR 이 끝나는 등) 하지 않는다
        if (!latest.current.enabled) return
        firedRef.current = true
        navigator.vibrate?.(30)
        latest.current.onLongPress()
      }, delayMs)
    },
    [enabled, delayMs, cancel],
  )

  const onPointerMove = useCallback(
    (event: E) => {
      const current = pressRef.current
      if (!current || current.pointerId !== event.pointerId) return
      if (Math.hypot(event.clientX - current.x, event.clientY - current.y) > slopPx) cancel()
    },
    [slopPx, cancel],
  )

  /** 손을 뗐을 때. 이 누르기에서 길게 누르기가 일어났으면 true (탭 반응을 내지 않게) */
  const onPointerUp = useCallback(
    (event: E) => {
      if (pressRef.current?.pointerId === event.pointerId) cancel()
      return firedRef.current
    },
    [cancel],
  )

  /** 버튼에 붙일 때: 길게 누른 뒤 손을 떼며 나는 클릭(탭 반응)을 막는다 */
  const onClickCapture = useCallback((event: { preventDefault(): void; stopPropagation(): void }) => {
    if (!firedRef.current) return
    firedRef.current = false
    event.preventDefault()
    event.stopPropagation()
  }, [])

  return {
    /** 누르고 있는 곳 (진행 표시용). 누르지 않거나 꺼져 있으면 null */
    press: enabled ? press : null,
    handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: cancel, onClickCapture },
  }
}

export type LongPressHandlers<E extends PointerLike> = ReturnType<typeof useLongPress<E>>['handlers']
