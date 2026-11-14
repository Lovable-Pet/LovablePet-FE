import { useEffect, useState } from 'react'

// AR(WebXR)에서 바닥을 오래 못 찾을 때 띄우는 자세한 안내.
// 개를 숨기고 놓는 흐름은 useArPlacement 가 맡는다 (예전에는 이 자리의 ArFloorGate 가 자동 착지까지 숨겼다)

/** 이만큼 지나도 바닥을 못 찾으면 안내를 띄운다 */
const FLOOR_HINT_MS = 8000

/** active: 바닥을 아직 한 번도 못 찾았고 찾는 중 */
export function ArFloorHint({ active }: { active: boolean }) {
  const [slow, setSlow] = useState(false)

  useEffect(() => {
    if (!active) return
    const timer = setTimeout(() => setSlow(true), FLOOR_HINT_MS)
    return () => {
      clearTimeout(timer)
      setSlow(false)
    }
  }, [active])

  if (!active || !slow) return null
  return (
    <p
      role="status"
      className="pointer-events-none absolute inset-x-6 top-1/2 -translate-y-1/2 rounded-card bg-overlay px-4 py-3 text-center text-body text-on-dark"
    >
      바닥을 찾기 어려워요. 밝은 곳에서 무늬가 있는 바닥을 비추며 휴대폰을 천천히 좌우로 움직여 보세요
    </p>
  )
}
