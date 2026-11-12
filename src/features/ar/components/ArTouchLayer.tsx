import type { ModelViewerElement } from '@google/model-viewer'
import { useEffect, useRef, type PointerEvent as ReactPointerEvent, type RefObject } from 'react'
import { LONG_PRESS_MS, useLongPress } from '../useLongPress'
import { HoldRing } from './HoldRing'

/**
 * AR(WebXR) 중에만 화면 전체를 덮는 투명 층. model-viewer 의 자식 중 가장 앞에 둔다.
 * - 이 층에 닿은 터치는 beforexrselect 를 막아 XR select 가 되지 않는다. 그래서 model-viewer 의 한 손가락 끌기(이동)·
 *   화면 밀기(회전)·두 손가락 비틀기(회전)가 모두 안 된다 (model-viewer 에 이동·회전을 끄는 공개 설정이 없다)
 * - 뒤에 오는 오버레이(명령 칩·마이크)는 이 층 위에 그려져 그대로 눌린다.
 *   model-viewer 의 AR 닫기 버튼은 그림자 DOM 에서 슬롯보다 뒤에 있어 이 층이 가리지 않는다
 * - 개 탭(꼬리 흔들기)과 3초 누르기(짖기)는 이 층에서 받아 positionAndNormalFromPoint 로 개를 맞혔는지 본다
 * 화면 안 3D 에서는 그리지 않아 카메라 돌리기는 그대로다
 */
export function ArTouchLayer({
  active,
  dogReady,
  holdEnabled,
  slopPx,
  mvRef,
  onTap,
  onLongPress,
}: {
  /** AR 중인지 */
  active: boolean
  /** 개가 바닥에 놓였는지. 그 전에는 개를 눌러도 반응하지 않는다 (막기만 한다) */
  dogReady: boolean
  /** 명령 클립이 있는 모델인지 (3초 누르기 → 짖기) */
  holdEnabled: boolean
  /** 탭과 끌기를 가르는 거리 */
  slopPx: number
  mvRef: RefObject<ModelViewerElement | null>
  onTap: () => void
  onLongPress: () => void
}) {
  const layerRef = useRef<HTMLDivElement>(null)
  /** 첫 손가락이 닿은 곳. 다른 손가락이 닿으면 탭이 아니다 */
  const tapStart = useRef<{ x: number; y: number; pointerId: number } | null>(null)

  const hitsDog = (event: { clientX: number; clientY: number }) =>
    !!mvRef.current?.positionAndNormalFromPoint(event.clientX, event.clientY)

  const hold = useLongPress<ReactPointerEvent>({
    enabled: active && dogReady && holdEnabled,
    slopPx,
    canStart: hitsDog,
    onLongPress,
  })

  useEffect(() => {
    tapStart.current = null
    const layer = layerRef.current
    if (!active || !layer) return
    const blockXrSelect = (event: Event) => event.preventDefault()
    layer.addEventListener('beforexrselect', blockXrSelect)
    return () => layer.removeEventListener('beforexrselect', blockXrSelect)
  }, [active])

  if (!active) return null

  const onPointerDown = (event: ReactPointerEvent) => {
    hold.handlers.onPointerDown(event)
    tapStart.current = event.isPrimary ? { x: event.clientX, y: event.clientY, pointerId: event.pointerId } : null
  }
  const onPointerUp = (event: ReactPointerEvent) => {
    const longPressed = hold.handlers.onPointerUp(event)
    const start = tapStart.current
    if (start?.pointerId !== event.pointerId) return
    tapStart.current = null
    if (longPressed || !dogReady) return
    if (Math.hypot(event.clientX - start.x, event.clientY - start.y) > slopPx) return
    if (hitsDog(event)) onTap()
  }
  const onPointerCancel = () => {
    hold.handlers.onPointerCancel()
    tapStart.current = null
  }

  return (
    <div
      ref={layerRef}
      data-ar-touch
      className="pointer-events-auto absolute inset-0 touch-none"
      onPointerDown={onPointerDown}
      onPointerMove={hold.handlers.onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
    >
      <HoldRing at={hold.press} durationMs={LONG_PRESS_MS} />
    </div>
  )
}
