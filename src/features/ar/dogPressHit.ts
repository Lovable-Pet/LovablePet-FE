import type { ModelViewerElement } from '@google/model-viewer'

/**
 * 길게 누르기를 시작해도 되는, 화면에 그려진 강아지 둘레 거리 (px).
 * 작은 개(말티즈 등)는 화면에 작게 그려져 손가락이 개 바로 옆을 누르는 일이 많다. 탭 판정은 지금처럼 개 위만
 */
export const HOLD_START_MARGIN_PX = 24

/** 둘레를 볼 방향 수와 거리 단계 (margin 의 1/3·2/3·전부) */
const DIRECTIONS = 8
const RINGS = 3

type Hitter = Pick<ModelViewerElement, 'positionAndNormalFromPoint'>

/**
 * (x, y) 가 강아지 위면 0, 아니면 둘레 margin 안에서 강아지가 그려진 가장 가까운 거리 (px, margin/3 단계). 없으면 null.
 * 누른 점 둘레를 몇 바퀴 찍어 positionAndNormalFromPoint 로 개를 맞혀 본다 (가까운 바퀴부터, 맞으면 바로 끝)
 */
export function dogNearPoint(mv: Hitter, x: number, y: number, margin = HOLD_START_MARGIN_PX): number | null {
  if (mv.positionAndNormalFromPoint(x, y)) return 0
  for (let ring = 1; ring <= RINGS; ring++) {
    const r = (margin * ring) / RINGS
    for (let i = 0; i < DIRECTIONS; i++) {
      // 바퀴마다 반 칸 돌려 빈틈을 줄인다
      const a = ((i + (ring % 2) / 2) * 2 * Math.PI) / DIRECTIONS
      if (mv.positionAndNormalFromPoint(x + Math.cos(a) * r, y + Math.sin(a) * r)) return r
    }
  }
  return null
}
