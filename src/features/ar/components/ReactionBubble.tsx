import type { ModelViewerElement } from '@google/model-viewer'
import { Heart } from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react'
import { REACTION_MS, REACTION_TEXT, type ReactionKind } from '../arText'
import { headScreenPoint } from '../modelViewerArStage'

/** 말풍선 자리를 다시 재는 간격 (ms). WebXR 중에는 창의 requestAnimationFrame 이 돌지 않을 수 있어 타이머로 */
const FOLLOW_MS = 33
/** 화면 가장자리에서 이만큼(0~1) 안쪽이어야 띄운다 */
const EDGE = 0.04

const onScreen = (point: { x: number; y: number } | null) =>
  !!point && point.x >= EDGE && point.x <= 1 - EDGE && point.y >= EDGE && point.y <= 1 - EDGE

/**
 * 개 머리 위 반응 말풍선 ('?', 하트, '멍!', '빵!'). reaction 이 바뀔 때마다 REACTION_MS 동안 머리를 따라다닌다.
 * 머리가 화면 밖이면 띄우지 않고, 보이는 중에 나가면 숨긴다. model-viewer 의 자식으로 둬야 WebXR 화면에도 보인다
 */
export function ReactionBubble({
  mvRef,
  reaction,
}: {
  mvRef: RefObject<ModelViewerElement | null>
  /** id 가 바뀌면 새로 띄운다. null 이면 숨긴다 */
  reaction: { kind: ReactionKind; id: number } | null
}) {
  const layerRef = useRef<HTMLDivElement>(null)
  const bubbleRef = useRef<HTMLDivElement>(null)
  const [shown, setShown] = useState<{ kind: ReactionKind; id: number } | null>(null)

  useEffect(() => {
    const mv = mvRef.current
    if (!reaction || !mv) return
    if (!onScreen(headScreenPoint(mv))) return
    setShown(reaction)
    const timer = window.setTimeout(() => setShown(null), REACTION_MS)
    return () => {
      window.clearTimeout(timer)
      setShown(null)
    }
  }, [reaction, mvRef])

  // 보이는 동안 머리를 따라간다 (화면 안 3D 와 AR 에서 기준 위치가 달라 이 층의 크기로 잰다)
  useLayoutEffect(() => {
    const mv = mvRef.current
    const layer = layerRef.current
    if (!shown || !mv || !layer) return
    const place = () => {
      const bubble = bubbleRef.current
      if (!bubble) return
      const point = headScreenPoint(mv)
      if (!onScreen(point)) {
        bubble.style.visibility = 'hidden'
        return
      }
      const { width, height } = layer.getBoundingClientRect()
      bubble.style.visibility = 'visible'
      bubble.style.left = `${point!.x * width}px`
      bubble.style.top = `${point!.y * height}px`
    }
    place()
    const timer = window.setInterval(place, FOLLOW_MS)
    return () => window.clearInterval(timer)
  }, [shown, mvRef])

  return (
    <div ref={layerRef} aria-hidden className="pointer-events-none absolute inset-0">
      {shown && (
        <div ref={bubbleRef} key={shown.id} className="absolute -translate-x-1/2 -translate-y-full">
          <div className="flex min-w-11 animate-pop-in items-center justify-center rounded-full bg-white px-3 py-1.5 text-emphasis font-bold text-ink shadow-[0_2px_8px_rgb(0_0_0/0.3)]">
            {shown.kind === 'heart' ? (
              <Heart className="size-5 text-accent" fill="currentColor" strokeWidth={2} />
            ) : (
              REACTION_TEXT[shown.kind]
            )}
          </div>
          {/* 꼬리 */}
          <div className="mx-auto -mt-1.5 size-3 rotate-45 bg-white" />
        </div>
      )}
    </div>
  )
}
