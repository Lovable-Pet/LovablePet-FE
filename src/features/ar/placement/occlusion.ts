import type { DepthSampler, StageSensors, StageView } from './arStage'
import { SPOT_DIRECTIONS } from './spotCheck'
import { distanceXZ, type Vec3 } from './types'
import { isOnScreen, projectToView, viewForward } from './viewProjection'

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
/** 흔들림 줄이기: 가운데는 최근 몇 프레임 차이의 중앙값을 쓴다 (둘레는 PerimeterVote 가 연속 프레임으로 거른다) */
const CENTER_HISTORY = 5
/** 특징점은 프레임마다 맞았다 안 맞았다 한다. 한 번 앞에 잡히면 이만큼(ms) 가림을 유지한다 */
const POINT_HOLD_MS = 300
/**
 * 둘레 점보다 이만큼(m) 넘게 앞에 있는 것은 장애물로 세지 않는다 (모름).
 * 둘레 바로 옆의 가구는 이 안에 들고, 그보다 훨씬 앞은 휴대폰을 든 사람의 손·발·다리처럼 카메라 가까이에 있는 것이다.
 * 가운데 판정에는 상한을 두지 않는다 (책상·문은 바닥 hit 보다 훨씬 앞에 있을 수 있다)
 */
export const PERIMETER_MAX_GAP_M = 0.6
/** 카메라를 바닥에 투영한 점에서 이만큼(m) 안의 둘레 점은 보지 않는다 (모름). 사람의 발이 있는 자리 */
export const CAMERA_FOOT_RADIUS_M = 0.6

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

/**
 * 화면 가운데 바닥 hit 자리의 깊이 비율 r = 실제 거리(깊이, 정면 축) / 바닥 hit 까지 거리(정면 축).
 * 깊이 센서가 맞으면 빈 바닥에서 1 근처다. 값이 없거나 화면 밖이면 null
 */
export function centerDepthRatio(floorHit: Vec3, view: StageView, depth: DepthSampler | null): number | null {
  if (!depth) return null
  const projected = projectToView(floorHit, view)
  if (!projected || !isOnScreen(projected)) return null
  const measured = medianDepth(depth, projected.u, projected.v, CENTER_SAMPLE)
  return measured === null ? null : measured / projected.depth
}

/** 화면 격자: 카메라 앞 바닥의 이 거리(m)들과 */
const GRID_DISTANCES_M = [1.0, 1.4, 1.9, 2.5]
/** … 거리에 대한 좌우 비율들 (화면 가로 안에 들게 작게) */
const GRID_SIDES = [-0.2, -0.1, 0, 0.1, 0.2]

/**
 * 화면 여러 곳의 바닥 깊이 비율 r = 실제 거리 / 바닥 점까지 거리 (정면 축).
 * 카메라 앞 바닥(바닥 높이)의 격자 점을 화면에 투영해 잰다. 화면 밖·값 없음·발밑은 뺀다.
 * 깊이 센서가 화면 전체에서 같은 비율로 어긋났는지(센서 문제) 진짜 물체가 일부만 가렸는지 가를 때 쓴다
 */
export function floorGridRatios(camera: Vec3, floorY: number, view: StageView, depth: DepthSampler | null): number[] {
  if (!depth) return []
  const forward = viewForward(view)
  const length = Math.hypot(forward.x, forward.z)
  if (length === 0) return []
  const fx = forward.x / length
  const fz = forward.z / length
  const ratios: number[] = []
  for (const distance of GRID_DISTANCES_M) {
    for (const side of GRID_SIDES) {
      const lateral = distance * side
      const point = { x: camera.x + fx * distance - fz * lateral, y: floorY, z: camera.z + fz * distance + fx * lateral }
      if (distanceXZ(point, camera) < CAMERA_FOOT_RADIUS_M) continue
      const projected = projectToView(point, view)
      if (!projected || !isOnScreen(projected)) continue
      const measured = medianDepth(depth, projected.u, projected.v, PERIMETER_SAMPLE)
      if (measured !== null) ratios.push(measured / projected.depth)
    }
  }
  return ratios
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
  /** 깊이를 믿을 수 있는지 (DepthCalibration 이 맞음으로 본 때). 아니면 깊이 대신 특징점으로 판정한다 */
  depthTrusted: boolean
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
    if (input.sensors.depth === 'on' && input.depthTrusted) {
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

/** floor: 바닥이 보임 · obstacle: 둘레 바로 앞에 물체 · unknown: 모름 (막지 않는다) */
export type PerimeterState = 'floor' | 'obstacle' | 'unknown'
/** 모름의 까닭. offscreen: 화면 밖 · feet: 사람 발 자리 · close: 카메라 가까운 물체 (손·발) · nodata: 깊이 값 없음 */
export type UnknownReason = 'offscreen' | 'feet' | 'close' | 'nodata'

export interface PerimeterSample {
  state: PerimeterState
  /** 실제 거리 − 둘레 점까지 거리 (정면 축, m). 음수면 둘레 점 앞에 무언가 있다. 못 쟀으면 null */
  gap: number | null
  /** 실제 거리 / 둘레 점까지 거리 (정면 축). 깊이 보정 검사에 쓴다. 발밑 자리도 잰다. 못 쟀으면 null */
  ratio: number | null
  reason: UnknownReason | null
}

/**
 * 자리 검사에 깊이를 더한다. 원 둘레 8곳(바닥 높이, 방향 번호는 SpotCheck 과 같다)을 화면에 투영해,
 * 그 자리의 실제 거리가 둘레 점까지 거리보다 여유(12cm + 거리의 3%)보다 많이, 그러나 0.6m 보다는 적게 짧으면 장애물이다.
 * 카메라 발밑 0.6m 안의 둘레 점, 0.6m 넘게 앞을 가린 것(손·발), 화면 밖, 값 없음은 모름이다.
 * 한 프레임 판정만 낸다. 막을지는 PerimeterVote 가 정한다
 */
export function samplePerimeterDepth(
  center: Vec3,
  floorY: number,
  radius: number,
  camera: Vec3,
  view: StageView,
  depth: DepthSampler | null,
): PerimeterSample[] {
  return Array.from({ length: SPOT_DIRECTIONS }, (_, index): PerimeterSample => {
    const angle = (index / SPOT_DIRECTIONS) * Math.PI * 2
    const point = { x: center.x + Math.sin(angle) * radius, y: floorY, z: center.z + Math.cos(angle) * radius }
    return sampleFloorDepth(point, camera, view, depth, PERIMETER_SAMPLE)
  })
}

export interface FloorDepthOptions {
  /** 상한에 더하는 거리 (정면 축, m). 원 안쪽 표본은 표본 점 너머 바닥을 보므로 상한을 표본 점 앞으로 잰다 */
  extraCap?: number
  /** 여유에 더하는 거리 비율. 깊이 배율이 이만큼 어긋나 있을 때 (원 안쪽 표본) */
  scaleError?: number
}

/**
 * 바닥 위 한 점이 보이는지 깊이로 본다 (둘레 점·원 안쪽 표본이 같은 기준을 쓴다).
 * 그 자리의 실제 거리가 바닥 점까지 거리보다 여유보다 많이, 0.6m(+ extraCap) 보다는 적게 짧으면 장애물.
 * size: 표본 n×n 깊이 칸의 중앙값 (1 이면 한 칸)
 */
export function sampleFloorDepth(
  point: Vec3,
  camera: Vec3,
  view: StageView,
  depth: DepthSampler | null,
  size: number,
  { extraCap = 0, scaleError = 0 }: FloorDepthOptions = {},
): PerimeterSample {
  const projected = projectToView(point, view)
  if (!projected || !isOnScreen(projected)) return { state: 'unknown', gap: null, ratio: null, reason: 'offscreen' }
  const measured = depth ? medianDepth(depth, projected.u, projected.v, size) : null
  const ratio = measured === null ? null : measured / projected.depth
  if (distanceXZ(point, camera) < CAMERA_FOOT_RADIUS_M) return { state: 'unknown', gap: null, ratio, reason: 'feet' }
  if (measured === null) return { state: 'unknown', gap: null, ratio, reason: 'nodata' }
  const gap = measured - projected.depth
  if (gap >= -(depthMargin(projected.depth) + scaleError * projected.depth)) return { state: 'floor', gap, ratio, reason: null }
  if (-gap < PERIMETER_MAX_GAP_M + extraCap) return { state: 'obstacle', gap, ratio, reason: null }
  return { state: 'unknown', gap, ratio, reason: 'close' }
}
