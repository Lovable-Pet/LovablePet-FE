import type { SurfaceHit, Vec3 } from './types'

/** 면의 위쪽 방향이 이만큼 넘게 수직이면 수평면으로 본다 (cos 18° ≈ 0.95) */
export const HORIZONTAL_MIN_UP = 0.95
/** 바닥보다 이만큼(m) 넘게 높으면 바닥이 아니다 (책상·소파·침대). 러그·문턱 정도는 바닥으로 본다 */
export const RAISED_TOLERANCE_M = 0.05

export const isHorizontal = (normal: Vec3) => normal.y >= HORIZONTAL_MIN_UP

/** floor: 바닥 높이 · raised: 바닥보다 높은 면 */
export type SurfaceLevel = 'floor' | 'raised'

/**
 * 바닥 높이 추정. 지금까지 본 수평면 중 가장 낮은 높이를 바닥으로 본다.
 * 처음 비춘 곳이 책상이면 진짜 바닥을 비출 때까지는 책상을 바닥으로 여긴다
 */
export class FloorEstimate {
  private lowest: number | null = null

  /** 바닥 높이 (m). 아직 수평면을 못 봤으면 null */
  get y() {
    return this.lowest
  }

  /** 수평면이면 바닥 후보로 넣는다 */
  observe(hit: SurfaceHit) {
    if (!isHorizontal(hit.normal)) return
    const { y } = hit.position
    if (this.lowest === null || y < this.lowest) this.lowest = y
  }

  /** 이 높이가 바닥인지. 바닥을 아직 모르면 바닥으로 본다 */
  levelOf(y: number): SurfaceLevel {
    return this.lowest !== null && y > this.lowest + RAISED_TOLERANCE_M ? 'raised' : 'floor'
  }
}
