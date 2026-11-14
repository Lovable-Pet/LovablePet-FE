import type { DepthSampler, StageSensors, StageView } from './arStage'
import { SPOT_DIRECTIONS } from './spotCheck'
import { distanceXZ, type Vec3 } from './types'
import { isOnScreen, projectToView } from './viewProjection'

// 가림 판정: 바닥 광선이 실제로 처음 닿는 면이 바닥인가.
// hit-test 는 ARCore 가 면으로 인식한 것만 맞힌다. 아직 인식하지 못한 책상·문은 광선이 통과해 뒤쪽 바닥에 맞고,
// 링과 개는 실제 물체에 가려지지 않아 화면에서는 책상·문 위에 놓인 것처럼 보인다. 그래서 바닥 hit 앞에 실제 물체가 있는지 따로 본다.
// 1. 깊이 센서: 바닥 hit 이 보이는 화면 자리의 실제 거리가 바닥까지 거리보다 확실히 짧으면 가림
// 2. 특징점(깊이가 없을 때): 같은 광선이 바닥보다 확실히 가까운 특징점에 맞으면 가림
// 3. 둘 다 없으면 판정하지 않는다 (막지 않는다)
// 렌더러를 모르는 순수 계산이다. 걷는 중 장애물(4단계)에서도 쓴다

/** 깊이 여유 (m). 실제 거리가 바닥까지 거리보다 이만큼 넘게 짧아야 앞에 물체가 있다고 본다. 멀수록 깊이 오차가 커서 늘린다 */
export const depthMargin = (floorDepth: number) => 0.12 + 0.03 * floorDepth
/** 특징점 여유 (m). 특징점은 깊이보다 흩어져 있어 거리 비율을 더 준다 */
export const pointMargin = (floorDistance: number) => 0.1 + 0.05 * floorDistance

/** 가운데 표본 n×n (깊이 버퍼 픽셀) */
const CENTER_SAMPLE = 5
/** 둘레 점 표본 n×n */
const PERIMETER_SAMPLE = 3
/** 흔들림 줄이기: 최근 몇 프레임 차이의 중앙값을 쓴다 */
const CENTER_HISTORY = 5
const PERIMETER_HISTORY = 3
/** 특징점은 프레임마다 맞았다 안 맞았다 한다. 한 번 앞에 잡히면 이만큼(ms) 가림을 유지한다 */
const POINT_HOLD_MS = 300
/** 원이 한 번에 이만큼(m) 넘게 옮겨지면 둘레 기록을 버린다 */
const PERIMETER_JUMP_M = 0.1

const distance = (a: Vec3, b: Vec3) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z)

export function median(values: readonly number[]): number | null {
  if (!values.length) return null
  const sorted = [...values].sort((a, b) => a - b)
  const middle = sorted.length >> 1
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
}

/** (u, v) 둘레 size×size 표본의 중앙값 (m). 값 없는 칸은 뺀다. 하나도 없으면 null */
export function medianDepth(depth: DepthSampler, u: number, v: number, size: number): number | null {
  // 깊이 버퍼 한 칸쯤 (버퍼가 화면과 돌아 있을 수 있어 짧은 변 기준)
  const step = 1 / Math.max(1, Math.min(depth.width, depth.height))
  const half = Math.floor(size / 2)
  const values: number[] = []
  for (let i = -half; i <= half; i++) {
    for (let j = -half; j <= half; j++) {
      const su = u + i * step
      const sv = v + j * step
      if (su < 0 || su > 1 || sv < 0 || sv > 1) continue
      const value = depth.at(su, sv)
      if (value !== null) values.push(value)
    }
  }
  return median(values)
}

/** 최근 size 개 값의 중앙값. null(값 없음)은 자리만 차지하고 계산에서 빠진다 */
export class RecentMedian {
  private readonly size: number
  private readonly values: (number | null)[] = []

  constructor(size: number) {
    this.size = size
  }

  push(value: number | null): number | null {
    this.values.push(value)
    if (this.values.length > this.size) this.values.shift()
    return median(this.values.filter((item): item is number => item !== null))
  }

  clear() {
    this.values.length = 0
  }
}

/** depth: 깊이 센서 · points: 특징점 · none: 판정하지 않음 */
export type OcclusionBasis = 'depth' | 'points' | 'none'

export interface OcclusionResult {
  /** 바닥 hit 앞에 실제 물체가 있어 바닥이 가려졌는지 */
  occluded: boolean
  basis: OcclusionBasis
  /** 바닥 hit 까지 거리 (깊이: 카메라 정면 축, 특징점: 광선 길이) */
  floorDistance: number | null
  /** 이번 프레임에 잰 실제 거리 (깊이 표본 중앙값 또는 특징점까지 광선 길이). 없으면 null */
  measured: number | null
  /** 판정에 쓴 차이 (실제 − 바닥). 음수면 바닥 앞에 무언가 있다. 깊이는 최근 프레임 중앙값 */
  gap: number | null
  margin: number | null
}

export interface CenterOcclusionInput {
  time: number
  camera: Vec3
  view: StageView
  /** 화면 가운데 광선이 맞은 바닥 */
  floorHit: Vec3
  depth: DepthSampler | null
  /** 같은 광선이 맞은 특징점 */
  pointHit: Vec3 | null
  sensors: StageSensors
}

const NO_JUDGEMENT: OcclusionResult = {
  occluded: false,
  basis: 'none',
  floorDistance: null,
  measured: null,
  gap: null,
  margin: null,
}

/** 화면 가운데 바닥 hit 이 가려졌는지. 깊이가 있으면 깊이, 없거나 이번에 값이 없으면 특징점, 둘 다 없으면 판정 안 함 */
export class CenterOcclusion {
  private readonly gaps = new RecentMedian(CENTER_HISTORY)
  private pointBlockedAt = -Infinity

  update(input: CenterOcclusionInput): OcclusionResult {
    if (input.sensors.depth === 'on') {
      const result = this.byDepth(input)
      if (result) return result
    }
    if (input.sensors.points === 'on') return this.byPoints(input)
    return NO_JUDGEMENT
  }

  /** 바닥을 놓쳤거나 다시 놓기: 기록을 버린다 */
  reset() {
    this.gaps.clear()
    this.pointBlockedAt = -Infinity
  }

  private byDepth({ view, floorHit, depth }: CenterOcclusionInput): OcclusionResult | null {
    // 바닥 hit 이 화면에 보이는 자리 (거의 가운데). 깊이는 정면 축 거리라 바닥 hit 도 정면 축 거리로 잰다
    const projected = projectToView(floorHit, view)
    if (!projected || !isOnScreen(projected)) return null
    const measured = depth ? medianDepth(depth, projected.u, projected.v, CENTER_SAMPLE) : null
    const gap = this.gaps.push(measured === null ? null : measured - projected.depth)
    // 최근 프레임에 깊이 값이 하나도 없으면 특징점으로 넘어간다
    if (gap === null) return null
    const margin = depthMargin(projected.depth)
    return { occluded: gap < -margin, basis: 'depth', floorDistance: projected.depth, measured, gap, margin }
  }

  private byPoints({ time, camera, floorHit, pointHit }: CenterOcclusionInput): OcclusionResult {
    // 둘 다 같은 광선 위라 광선 길이로 견준다
    const floorDistance = distance(camera, floorHit)
    const margin = pointMargin(floorDistance)
    const measured = pointHit ? distance(camera, pointHit) : null
    const gap = measured === null ? null : measured - floorDistance
    if (gap !== null && gap < -margin) this.pointBlockedAt = time
    return { occluded: time - this.pointBlockedAt <= POINT_HOLD_MS, basis: 'points', floorDistance, measured, gap, margin }
  }
}

export interface DepthCounts {
  clear: number
  obstacles: number
  /** 화면 밖이거나 깊이 값이 없음 (막지 않는다) */
  unknown: number
}

/**
 * 자리 검사에 깊이를 더한다. 원 둘레 8곳(바닥 높이)을 화면에 투영해, 그 자리의 실제 거리가 그 점까지 거리보다
 * 확실히 짧으면 장애물로 센다 (둘레 점이 가구 밑·벽 뒤에 있거나, 카메라와 둘레 사이에 물체가 있을 때)
 */
export class PerimeterDepth {
  private readonly gaps = Array.from({ length: SPOT_DIRECTIONS }, () => new RecentMedian(PERIMETER_HISTORY))
  private lastCenter: Vec3 | null = null

  update(center: Vec3, floorY: number, radius: number, view: StageView, depth: DepthSampler | null): DepthCounts {
    if (this.lastCenter && distanceXZ(this.lastCenter, center) > PERIMETER_JUMP_M) this.reset()
    this.lastCenter = center
    const counts: DepthCounts = { clear: 0, obstacles: 0, unknown: 0 }
    this.gaps.forEach((gaps, index) => {
      const angle = (index / SPOT_DIRECTIONS) * Math.PI * 2
      const point = { x: center.x + Math.sin(angle) * radius, y: floorY, z: center.z + Math.cos(angle) * radius }
      const projected = projectToView(point, view)
      if (!projected || !isOnScreen(projected)) {
        gaps.push(null)
        counts.unknown++
        return
      }
      const measured = depth ? medianDepth(depth, projected.u, projected.v, PERIMETER_SAMPLE) : null
      const gap = gaps.push(measured === null ? null : measured - projected.depth)
      if (gap === null) counts.unknown++
      else if (gap < -depthMargin(projected.depth)) counts.obstacles++
      else counts.clear++
    })
    return counts
  }

  reset() {
    for (const gaps of this.gaps) gaps.clear()
    this.lastCenter = null
  }
}
