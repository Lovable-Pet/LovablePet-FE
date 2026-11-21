import { useCallback, useEffect, useRef, useState } from 'react'

/** 길게 누르기로 보는 시간 (HoldRing 링이 이 시간 동안 찬다) */
export const LONG_PRESS_MS = 2000

/**
 * 길게 누르기 동안 손가락이 누른 곳에서 이만큼(px)까지 움직여도 된다.
 * 탭과 끌기를 가르는 거리(8 px)는 따로다: 폰에서 2초 누르는 동안 손가락이 8 px 넘게 흔들려 자주 처음으로 돌아갔다
 */
export const HOLD_SLOP_PX = 24

export interface PressPoint {
  x: number
  y: number
}

/** React 의 PointerEvent 와 DOM PointerEvent 둘 다 받는다 */
type PointerLike = Pick<PointerEvent, 'pointerId' | 'clientX' | 'clientY' | 'target'>

interface LongPressOptions<E extends PointerLike> {
  enabled: boolean
  onLongPress: () => void
  /** 누른 곳에서 이만큼 넘게 움직이면 취소한다 (기본 HOLD_SLOP_PX) */
  slopPx?: number
  /** 누른 곳에서 시작해도 되는지 (개를 맞혔는지 등) */
  canStart?: (event: E) => boolean
  delayMs?: number
  /** 개발 모드 기록: 시작·취소 이유·완료 (부르는 곳에서 import.meta.env.DEV 일 때만 넘긴다) */
  onLog?: (text: string) => void
}

/** 누른 곳 · 누른 시각 · 지금까지 가장 멀리 움직인 거리 (px) */
type Press = PressPoint & { pointerId: number; at: number; moved: number }

/** 누른 뒤 지난 시간 (ms, 개발 기록용) */
const heldMs = (press: Press | null) => (press ? Math.round(performance.now() - press.at) : 0)

/**
 * 누른 채 slopPx 넘게 움직이지 않고 delayMs 가 지나면 onLongPress.
 * 손가락이 하나 더 닿거나(확대·회전), 움직이거나, 떼거나, 브라우저가 누르기를 가져가면(pointercancel) 취소한다.
 * 길게 누르기가 일어난 누르기는 손을 뗄 때의 탭·클릭을 내지 않게 알려 준다 (onPointerUp 의 반환값, onClickCapture).
 * 개발 기록(onLog)은 부르는 곳을 모두 import.meta.env.DEV 안에 둬 배포 빌드에 문구가 남지 않게 한다
 */
export function useLongPress<E extends PointerLike>({
  enabled,
  onLongPress,
  slopPx = HOLD_SLOP_PX,
  canStart,
  delayMs = LONG_PRESS_MS,
  onLog,
}: LongPressOptions<E>) {
  /** 누르고 있는 곳 (진행 표시용). 누르지 않으면 null */
  const [press, setPress] = useState<PressPoint | null>(null)
  const pressRef = useRef<Press | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  /** 지금 누르기에서 길게 누르기가 일어났다. 다음 누르기에서 지운다 */
  const firedRef = useRef(false)
  const latest = useRef({ onLongPress, canStart, enabled, onLog })
  useEffect(() => {
    latest.current = { onLongPress, canStart, enabled, onLog }
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
        if (import.meta.env.DEV) latest.current.onLog?.(`취소: 두 번째 손가락 (${heldMs(pressRef.current)} ms)`)
        cancel()
        return
      }
      firedRef.current = false
      if (!enabled) return
      if (latest.current.canStart && !latest.current.canStart(event)) {
        if (import.meta.env.DEV) latest.current.onLog?.('시작 안 함: 강아지 밖')
        return
      }
      const point = { x: event.clientX, y: event.clientY }
      pressRef.current = { ...point, pointerId: event.pointerId, at: performance.now(), moved: 0 }
      setPress(point)
      if (import.meta.env.DEV) latest.current.onLog?.(`시작 (${Math.round(point.x)}, ${Math.round(point.y)})`)
      timerRef.current = setTimeout(() => {
        const moved = pressRef.current?.moved ?? 0
        timerRef.current = null
        pressRef.current = null
        setPress(null)
        // 누르는 사이 꺼졌으면(AR 이 끝나는 등) 하지 않는다
        if (!latest.current.enabled) {
          if (import.meta.env.DEV) latest.current.onLog?.('취소: 누르는 사이 꺼짐')
          return
        }
        if (import.meta.env.DEV) latest.current.onLog?.(`완료 → 빵 (가장 멀리 ${Math.round(moved)} px 움직임)`)
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
      const distance = Math.hypot(event.clientX - current.x, event.clientY - current.y)
      current.moved = Math.max(current.moved, distance)
      if (distance <= slopPx) return
      if (import.meta.env.DEV) {
        latest.current.onLog?.(`취소: ${Math.round(distance)} px 움직임 (허용 ${slopPx} px, ${heldMs(current)} ms)`)
      }
      cancel()
    },
    [slopPx, cancel],
  )

  /** 손을 뗐을 때. 이 누르기에서 길게 누르기가 일어났으면 true (탭 반응을 내지 않게) */
  const onPointerUp = useCallback(
    (event: E) => {
      if (pressRef.current?.pointerId === event.pointerId) {
        if (import.meta.env.DEV) latest.current.onLog?.(`취소: ${heldMs(pressRef.current)} ms 에 뗌`)
        cancel()
      }
      return firedRef.current
    },
    [cancel],
  )

  /** 브라우저가 누르기를 가져감 (길게 누르기 메뉴·스크롤 등) */
  const onPointerCancel = useCallback(() => {
    if (!pressRef.current) return
    if (import.meta.env.DEV) latest.current.onLog?.(`취소: pointercancel (${heldMs(pressRef.current)} ms)`)
    cancel()
  }, [cancel])

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
    handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel, onClickCapture },
  }
}

export type LongPressHandlers<E extends PointerLike> = ReturnType<typeof useLongPress<E>>['handlers']
