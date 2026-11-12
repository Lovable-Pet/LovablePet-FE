import type { ModelViewerElement } from '@google/model-viewer'
import { useEffect, useState, type RefObject } from 'react'
import { useSearchParams } from 'react-router'

/** 이벤트가 도착한 곳. model-viewer 면 'mv' (그림자 DOM 안에서 난 이벤트도 mv 로 보인다) */
const describe = (target: EventTarget | null, mv: Element) => {
  if (target === mv) return 'mv'
  if (target instanceof HTMLElement && target.dataset.arTouch !== undefined) return 'touch-layer'
  if (!(target instanceof Element)) return String(target)
  const className = typeof target.className === 'string' ? target.className.split(' ')[0] : ''
  return `${target.tagName.toLowerCase()}${className ? `.${className}` : ''}`
}

/**
 * AR 터치 확인 표시. 개발 모드에서 주소에 ?debug 를 붙였을 때만 보인다
 * (ArPage 에서 import.meta.env.DEV 일 때만 그려 배포 파일에는 들어가지 않는다. 예: /pets/201/ar?debug).
 * WebXR 화면에서 누르면 pointer 이벤트가 어디에 도착하는지(AR 중에는 '→ touch-layer', 화면 안 3D 는 '→ mv'),
 * positionAndNormalFromPoint 가 그 자리에서 개를 맞히는지(hit/miss)를 보인다.
 * AR 안에서 model-viewer 는 XR 카메라와 window.screen 크기로 계산한다
 */
export function ArHitDebug({ mvRef, arStatus }: { mvRef: RefObject<ModelViewerElement | null>; arStatus: string }) {
  const [searchParams] = useSearchParams()
  const enabled = searchParams.has('debug')
  const [lines, setLines] = useState<string[]>([])

  useEffect(() => {
    // 꺼져 있으면 누를 때마다 개를 맞혀 보는 계산(positionAndNormalFromPoint)도 하지 않는다
    if (!enabled) return
    const onPointer = (event: PointerEvent) => {
      const mv = mvRef.current
      if (!mv) return
      const hit = mv.positionAndNormalFromPoint(event.clientX, event.clientY)
      const where = hit
        ? `hit ${[hit.position.x, hit.position.y, hit.position.z].map((value) => value.toFixed(2)).join(',')}`
        : 'miss'
      const line = `${event.type.replace('pointer', '')} ${event.pointerType} ${Math.round(event.clientX)},${Math.round(event.clientY)} → ${describe(event.target, mv)} · ${where}`
      setLines((previous) => [line, ...previous].slice(0, 6))
    }
    // 어디에 도착하든 보려고 window 에서 먼저(capture) 받는다
    window.addEventListener('pointerdown', onPointer, true)
    window.addEventListener('pointerup', onPointer, true)
    return () => {
      window.removeEventListener('pointerdown', onPointer, true)
      window.removeEventListener('pointerup', onPointer, true)
    }
  }, [mvRef, enabled])

  if (!enabled) return null
  return (
    <pre className="pointer-events-none absolute top-[38%] left-2 max-w-[calc(100%-16px)] rounded-md bg-black/65 px-2 py-1.5 font-mono text-[10px] leading-snug whitespace-pre-wrap text-lime-300">
      {`[dev] ${arStatus} · screen ${window.screen.width}x${window.screen.height} · inner ${window.innerWidth}x${window.innerHeight}\n`}
      {lines.length ? lines.join('\n') : '화면을 눌러 보세요'}
    </pre>
  )
}
