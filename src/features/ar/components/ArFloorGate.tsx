import type { ModelViewerElement } from '@google/model-viewer'
import { useEffect, useState, type RefObject } from 'react'
import { getArSceneInternals, type ArSceneInternals } from '../arSceneInternals'

// AR(WebXR)에서 바닥을 찾아 내려앉을 때까지 개를 숨긴다.
// model-viewer 는 AR 을 켜자마자 개를 카메라 앞 공중(카메라 높이)에 놓고, 바닥을 찾으면('object-placed')
// 바닥으로 떨어뜨린다. 떨어지는 장면이 보이지 않게 그동안 숨겼다가, 다 내려앉으면 짧게 페이드인한다.
// - 내려앉는 시간: model-viewer 의 Damper(감쇠 50ms)로 재 보면 1cm 안까지 약 0.35초, 완전히 멈추기까지 약 0.6초
//   (높이 0.6~2m, 30·60fps). 실제로는 높이가 멈춘 것을 보고 정한다
// - 내부 장면을 못 찾으면(model-viewer 버전이 바뀐 때) 숨기지 않는다. 바닥 안내만 보인다

/** 이만큼 지나도 바닥을 못 찾으면 안내를 띄운다 */
const FLOOR_HINT_MS = 8000
/** 내려앉았는지 높이를 보는 간격. 연속 두 번 거의 그대로면 내려앉은 것으로 본다 */
const LAND_POLL_MS = 50
/** 이 간격 동안 이만큼(m)도 안 움직이면 멈춘 것으로 본다 (1cm 안에서는 눈에 안 보인다) */
const LAND_STILL_M = 0.001
/** 높이를 못 읽거나 계속 움직여도 이만큼 지나면 보인다 */
const LAND_TIMEOUT_MS = 1500
/** 나타날 때 페이드인 시간. 0 이면 바로 보인다 (재질을 투명으로 바꿨다 되돌리지 않는다) */
const REVEAL_FADE_MS = 300
const FADE_STEP_MS = 16

export function ArFloorGate({ mvRef }: { mvRef: RefObject<ModelViewerElement | null> }) {
  const [slowFloor, setSlowFloor] = useState(false)

  useEffect(() => {
    const mv = mvRef.current
    if (!mv) return
    let scene: ArSceneInternals | null = null
    let hintTimer: ReturnType<typeof setTimeout> | undefined
    let landTimer: ReturnType<typeof setInterval> | undefined
    let fadeTimer: ReturnType<typeof setInterval> | undefined
    let restoreMaterials: (() => void) | null = null

    /** 숨긴 것·바꾼 재질을 모두 원래대로 (AR 을 나갈 때, 다시 들어올 때, 화면을 떠날 때) */
    const reset = () => {
      clearTimeout(hintTimer)
      clearInterval(landTimer)
      clearInterval(fadeTimer)
      restoreMaterials?.()
      restoreMaterials = null
      scene?.setVisible(true)
      scene = null
    }

    const reveal = (current: ArSceneInternals) => {
      const saved =
        REVEAL_FADE_MS > 0
          ? current.materials().map((material) => ({ material, transparent: material.transparent, opacity: material.opacity }))
          : []
      // 보이기 전에 투명으로 바꿔 둬야 한 프레임 번쩍이지 않는다
      for (const { material } of saved) {
        if (!material.transparent) {
          material.transparent = true
          material.needsUpdate = true
        }
        material.opacity = 0
      }
      restoreMaterials = () => {
        for (const { material, transparent, opacity } of saved) {
          if (material.transparent !== transparent) {
            material.transparent = transparent
            material.needsUpdate = true
          }
          material.opacity = opacity
        }
      }
      current.setVisible(true)
      if (!saved.length) return
      // WebXR 중에는 window 의 requestAnimationFrame 이 돌지 않을 수 있어 타이머로 돌린다. AR 은 매 프레임 다시 그린다
      const start = performance.now()
      fadeTimer = setInterval(() => {
        const progress = Math.min(1, (performance.now() - start) / REVEAL_FADE_MS)
        for (const { material, opacity } of saved) material.opacity = opacity * progress
        if (progress < 1) return
        clearInterval(fadeTimer)
        restoreMaterials?.()
        restoreMaterials = null
      }, FADE_STEP_MS)
    }

    const waitForLanding = (current: ArSceneInternals) => {
      const start = performance.now()
      let last = current.floorY()
      let still = 0
      landTimer = setInterval(() => {
        const y = current.floorY()
        still = Math.abs(y - last) < LAND_STILL_M ? still + 1 : 0
        last = y
        if (still < 2 && performance.now() - start < LAND_TIMEOUT_MS) return
        clearInterval(landTimer)
        reveal(current)
      }, LAND_POLL_MS)
    }

    // ar-status 는 model-viewer 가 그 자리에서 바로 보내서, React 상태를 거치지 않고 여기서 받아야 첫 프레임 전에 숨길 수 있다
    const onStatus = (event: Event) => {
      const status = (event as CustomEvent<{ status: string }>).detail.status
      if (status === 'session-started') {
        // 다시 들어온 때도 같은 순서: 공중에 놓이고 → 바닥을 찾고 → 내려앉는다
        reset()
        scene = getArSceneInternals(mv)
        scene?.setVisible(false)
        hintTimer = setTimeout(() => setSlowFloor(true), FLOOR_HINT_MS)
      } else if (status === 'object-placed') {
        clearTimeout(hintTimer)
        setSlowFloor(false)
        if (scene) waitForLanding(scene)
      } else {
        // not-presenting, failed
        reset()
        setSlowFloor(false)
      }
    }

    mv.addEventListener('ar-status', onStatus)
    return () => {
      mv.removeEventListener('ar-status', onStatus)
      reset()
    }
  }, [mvRef])

  if (!slowFloor) return null
  return (
    <p
      role="status"
      className="pointer-events-none absolute inset-x-6 top-1/2 -translate-y-1/2 rounded-card bg-overlay px-4 py-3 text-center text-body text-on-dark"
    >
      바닥을 찾기 어려워요. 밝은 곳에서 무늬가 있는 바닥을 비추며 휴대폰을 천천히 좌우로 움직여 보세요
    </p>
  )
}
