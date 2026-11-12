import { useLayoutEffect, useRef } from 'react'
import type { PressPoint } from '../useLongPress'

const SIZE = 76
const STROKE = 4
const RADIUS = (SIZE - STROKE) / 2
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

/**
 * 길게 누르는 동안 손가락 둘레에 차오르는 원. 다 차면 길게 누르기가 일어난다.
 * model-viewer 의 자식으로 둬야 WebXR 화면(DOM overlay)에도 보인다
 */
export function HoldRing({ at, durationMs }: { at: PressPoint | null; durationMs: number }) {
  const layerRef = useRef<HTMLDivElement>(null)
  const ringRef = useRef<SVGSVGElement>(null)

  useLayoutEffect(() => {
    const layer = layerRef.current
    const ring = ringRef.current
    if (!at || !layer || !ring) return
    // 화면 안 3D 와 AR(전체 화면 오버레이)에서 기준 위치가 달라서, 이 층의 위치를 빼서 놓는다
    const rect = layer.getBoundingClientRect()
    ring.style.left = `${at.x - rect.left}px`
    ring.style.top = `${at.y - rect.top}px`
    // CSS 애니메이션은 '동작 줄이기'에서 1ms 로 끝나 버린다(index.css). 진행 표시라 Web Animations 로 그대로 돌린다
    const animation = ring.lastElementChild?.animate(
      [{ strokeDashoffset: CIRCUMFERENCE }, { strokeDashoffset: 0 }],
      { duration: durationMs, easing: 'linear', fill: 'forwards' },
    )
    return () => animation?.cancel()
  }, [at, durationMs])

  return (
    <div ref={layerRef} aria-hidden className="pointer-events-none absolute inset-0">
      {at && (
        <svg
          ref={ringRef}
          width={SIZE}
          height={SIZE}
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          className="absolute -translate-x-1/2 -translate-y-1/2 -rotate-90 drop-shadow-md"
        >
          <circle cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} fill="none" stroke="rgb(0 0 0 / 0.35)" strokeWidth={STROKE} />
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            fill="none"
            stroke="var(--color-measure)"
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={CIRCUMFERENCE}
          />
        </svg>
      )}
    </div>
  )
}
