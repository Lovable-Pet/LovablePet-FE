import type { DepthSampler, StageView } from './arStage'
import { DEPTH_GOOD_MAX } from './depthCalibration'
import { depthMargin, sampleFloorDepth, CAMERA_FOOT_RADIUS_M, type PerimeterSample, type PerimeterState } from './occlusion'
import { distanceXZ, type Vec3 } from './types'
import { projectToView } from './viewProjection'

// 원 안쪽 깊이 검사. 가운데 1점과 둘레 8곳만 보면 원 안의 가는 물체(지름 4~5cm 책상 다리)가 점 사이로 빠진다.
// 깊이 보정이 맞음일 때만, 원 안쪽을 세 겹(0.35r · 0.7r · 1.0r, r = 둘레 반지름) × 촘촘한 방향으로 본다.
//
// 표본 광선: 표본 점 바로 위를 지나 그 너머 바닥에 닿는 광선 (표본 점 위 약 12~20cm, 개 몸 높이).
// - 기둥은 카메라에서 볼 때 그 뒤쪽 바닥만 가린다. 표본 점의 바닥을 바로 보면 여유(12cm + 거리의 3%) 때문에
//   기둥보다 9cm 넘게 뒤에 있는 표본만 걸리고, 원 너머 쪽 테두리 근처 기둥은 가려진 바닥이 원 밖이라 못 본다
// - 그래서 광선이 표본 점 위에서 바닥에 닿기까지 거리가 여유보다 INNER_PAST_M 길게 되는 높이로 쏜다.
//   표본 점에 선 기둥은 여유를 넘어 장애물이 되고, 표본 점보다 광선으로 INNER_PAST_M(바닥에서 약 3cm) 넘게 뒤에 있는 것은
//   장애물이 안 된다. 높이 12cm 아래의 낮은 물건(케이블·러그)은 광선 아래로 지나간다
// - 장애물 기준은 둘레 깊이와 같다: 여유, 0.6m 상한(표본 점 앞으로 잰다), 카메라 발밑 0.6m 제외.
//   다만 여유에 깊이 보정의 어긋남(|1 − r| × 거리, 8% 까지)을 더한다. 원 안쪽 표본은 더 먼 바닥을 한 칸으로 재고 수가 많아,
//   r 이 맞음 범위 끝(0.93 등)이면 빈 바닥도 잡음으로 여유를 넘는다 (둘레 8곳은 3×3 중앙값이라 그대로 둔다)
// - 표본은 깊이 한 칸(1×1)으로 잰다. 3×3 중앙값이면 2~3칸 너비의 기둥이 둘레 바닥 값에 묻힌다
// - 방향 수는 바깥 겹 표본 간격이 2cm 가 되게 정한다 (16방향이면 큰 개의 바깥 겹 간격이 20cm 라 기둥이 사이로 빠진다).
//   방향 0 은 원 너머(카메라 반대쪽)이고 시계 방향으로 커진다. 가운데 근처 기둥이 늘 같은 방향 표본에 걸린다
// 막는 때: 이웃한(겹·방향이 하나씩 차이 나는, 대각선 포함) 표본 2개 이상이 5프레임 넘게 이어진 장애물이거나,
// 표본 하나라도 10프레임 넘게 이어진 장애물일 때. 한두 프레임 튀는 잡음으로는 막지 않는다.
// 이어진 프레임 수는 장애물이 바로 옆 표본으로 옮겨 가도 잇는다 (기둥 띠가 손 떨림으로 표본 사이를 오가도 깜빡이지 않게).
// 막은 뒤에는 5프레임 연속 안 막힘이어야 푼다 (경계에 걸친 물체로 노랑·빨강이 오가지 않게)
// 렌더러를 모르는 순수 계산이다

/** 표본 겹: 둘레 반지름에 대한 비율 (안쪽부터) */
export const INNER_RING_FRACTIONS = [0.35, 0.7, 1.0] as const
/** 바깥 겹 표본 간격 (m). 지름 4cm 기둥이 표본 둘에 걸리게 */
export const INNER_ARC_M = 0.02
/** 겹마다 방향 수 범위 */
export const INNER_MIN_DIRECTIONS = 16
export const INNER_MAX_DIRECTIONS = 160
/** 표본 광선이 표본 점 위에서 바닥에 닿기까지 거리 = 여유 + 이만큼 (m). 표본 점보다 이만큼 넘게 뒤의 물체는 장애물이 아니다 */
export const INNER_PAST_M = 0.04
/** 여유에 더하는 깊이 배율 어긋남의 상한 (깊이 보정이 맞음인 범위) */
export const INNER_SCALE_ERROR_MAX = DEPTH_GOOD_MAX - 1
/** 표본 n×n (깊이 칸) */
export const INNER_SAMPLE = 1
/** 이웃과 함께 이만큼 연속 프레임 장애물이면 막는다 */
export const INNER_CLUSTER_FRAMES = 5
/** 표본 하나라도 이만큼 연속 프레임 장애물이면 막는다 */
export const INNER_PERSISTENT_FRAMES = 10
/** 막은 뒤 이만큼 연속 프레임 막을 까닭이 없어야 푼다 */
export const INNER_RELEASE_FRAMES = 5
/** 원이 한 번에 이만큼(m) 넘게 옮겨지면 이어진 프레임 수를 버린다 */
const JUMP_M = 0.1

/** 둘레 반지름에 맞는 방향 수 */
export const innerDirections = (radius: number) =>
  Math.min(INNER_MAX_DIRECTIONS, Math.max(INNER_MIN_DIRECTIONS, Math.ceil((2 * Math.PI * radius) / INNER_ARC_M)))

export interface InnerSample extends PerimeterSample {
  /** 표본 점 (바닥 높이) */
  position: Vec3
}

/** 표본 번호 → 겹 번호(0 이 안쪽)·방향 번호(0 이 원 너머, 시계 방향) */
export const innerSlot = (index: number, directions: number) => ({
  ring: Math.floor(index / directions),
  direction: index % directions,
})

/**
 * 표본 점 너머 바닥 점: 카메라에서 이 점으로 가는 광선이 표본 점 위를 지나, 거기서 바닥까지 거리가 여유 + INNER_PAST_M 이 되게.
 * 두 번 고쳐 맞춘다 (여유가 거리에 따라 조금 바뀐다). 카메라가 바닥보다 낮거나 표본 점이 카메라 바로 아래면 null
 */
function beyondFloorPoint(point: Vec3, camera: Vec3, scaleError: number): Vec3 | null {
  const height = camera.y - point.y
  const dx = point.x - camera.x
  const dz = point.z - camera.z
  const horizontal = Math.hypot(dx, dz)
  if (height <= 0 || horizontal < 1e-6) return null
  let past = 0
  for (let i = 0; i < 2; i++) {
    const far = horizontal + past
    const distance = Math.hypot(far, height)
    const length = depthMargin(distance) + scaleError * distance + INNER_PAST_M
    // 표본 점 위 → 바닥 거리 = past · √(1 + (높이/far)²)
    past = length / Math.hypot(1, height / far)
  }
  const scale = (horizontal + past) / horizontal
  return { x: camera.x + dx * scale, y: point.y, z: camera.z + dz * scale }
}

/**
 * 원 안쪽 표본 (겹 순서, 겹 안에서는 방향 순서). 원 중심이 카메라 바로 아래면 방향 0 은 +z.
 * depthRatio: 깊이 보정이 잰 r (실제 / 바닥). 1 에서 어긋난 만큼 여유를 늘린다
 */
export function sampleInnerDepth(
  center: Vec3,
  floorY: number,
  radius: number,
  camera: Vec3,
  view: StageView,
  depth: DepthSampler | null,
  depthRatio: number | null,
): InnerSample[] {
  const directions = innerDirections(radius)
  const scaleError = depthRatio === null ? 0 : Math.min(INNER_SCALE_ERROR_MAX, Math.abs(1 - depthRatio))
  // 카메라 → 원 중심 방향. x = sin, z = cos 로 둔다 (SpotCheck 과 같은 꼴)
  const bearing = distanceXZ(center, camera) > 1e-6 ? Math.atan2(center.x - camera.x, center.z - camera.z) : 0
  const samples: InnerSample[] = []
  for (const fraction of INNER_RING_FRACTIONS) {
    for (let direction = 0; direction < directions; direction++) {
      // 각이 줄면 카메라에서 볼 때 오른쪽이다 (시계 방향)
      const angle = bearing - (direction / directions) * Math.PI * 2
      const position = {
        x: center.x + Math.sin(angle) * fraction * radius,
        y: floorY,
        z: center.z + Math.cos(angle) * fraction * radius,
      }
      samples.push({ position, ...sampleInner(position, camera, view, depth, scaleError) })
    }
  }
  return samples
}

function sampleInner(
  point: Vec3,
  camera: Vec3,
  view: StageView,
  depth: DepthSampler | null,
  scaleError: number,
): PerimeterSample {
  if (distanceXZ(point, camera) < CAMERA_FOOT_RADIUS_M) return { state: 'unknown', gap: null, ratio: null, reason: 'feet' }
  const beyond = beyondFloorPoint(point, camera, scaleError)
  if (!beyond) return { state: 'unknown', gap: null, ratio: null, reason: 'offscreen' }
  // 0.6m 상한은 표본 점 앞으로 잰다: 광선이 표본 점 위를 지난 뒤 바닥까지 간 만큼(정면 축) 더 준다
  const near = projectToView(point, view)
  const far = projectToView(beyond, view)
  const extraCap = near && far ? Math.max(0, far.depth - near.depth) : 0
  return sampleFloorDepth(beyond, camera, view, depth, INNER_SAMPLE, { extraCap, scaleError })
}

export interface InnerSampleReport {
  position: Vec3
  state: PerimeterState
  /** 장애물이 이어진 프레임 수 */
  streak: number
  /** 막는 데 센 표본 (이웃과 함께 5프레임 넘게, 또는 혼자 10프레임 넘게) */
  counted: boolean
}

export interface InnerReport {
  /** 겹마다 방향 수 */
  directions: number
  samples: InnerSampleReport[]
  /** 이번 프레임 장애물 표본 수 */
  obstacles: number
  /** 이웃과 함께 INNER_CLUSTER_FRAMES 넘게 이어진 표본 수 */
  clustered: number
  /** INNER_PERSISTENT_FRAMES 넘게 이어진 표본 수 */
  persistent: number
  blocked: boolean
}

/** 표본마다 이웃 번호 (겹·방향이 하나씩 차이, 대각선 포함, 방향은 한 바퀴 이어진다) */
function neighborsOf(directions: number): number[][] {
  const count = INNER_RING_FRACTIONS.length * directions
  return Array.from({ length: count }, (_, index) => {
    const { ring, direction } = innerSlot(index, directions)
    const found: number[] = []
    for (let dr = -1; dr <= 1; dr++) {
      const r = ring + dr
      if (r < 0 || r >= INNER_RING_FRACTIONS.length) continue
      for (let dd = -1; dd <= 1; dd++) {
        if (dr === 0 && dd === 0) continue
        found.push(r * directions + ((direction + dd + directions) % directions))
      }
    }
    return found
  })
}

export class InnerVote {
  private readonly directions: number
  private readonly neighbors: number[][]
  private readonly streaks: number[]
  private lastCenter: Vec3 | null = null
  private blocked = false
  /** 막은 뒤 막을 까닭이 없었던 연속 프레임 수 */
  private clearFrames = 0

  /** radius: 둘레 반지름 (방향 수를 정한다) */
  constructor(radius: number) {
    this.directions = innerDirections(radius)
    this.neighbors = neighborsOf(this.directions)
    this.streaks = this.neighbors.map(() => 0)
  }

  /** 매 프레임. samples 는 같은 반지름으로 부른 sampleInnerDepth 의 순서 */
  update(center: Vec3, samples: readonly InnerSample[]): InnerReport {
    if (this.lastCenter && distanceXZ(this.lastCenter, center) > JUMP_M) this.clearHistory()
    this.lastCenter = center
    const previous = [...this.streaks]
    samples.forEach((sample, index) => {
      if (sample.state !== 'obstacle') {
        this.streaks[index] = 0
        return
      }
      // 가는 기둥이 손 떨림·깊이 칸 경계로 이웃 표본으로 옮겨 가도 이어진 것으로 센다 (지난 프레임 이웃의 수를 잇는다).
      // 홀로 튄 잡음은 이웃이 0 이라 이어 갈 것이 없다
      let carried = previous[index]
      for (const neighbor of this.neighbors[index]) carried = Math.max(carried, previous[neighbor])
      this.streaks[index] = carried + 1
    })
    const held = (index: number) => this.streaks[index] >= INNER_CLUSTER_FRAMES
    let clustered = 0
    let persistent = 0
    const reports = samples.map((sample, index): InnerSampleReport => {
      const streak = this.streaks[index]
      const inCluster = held(index) && this.neighbors[index].some(held)
      const alone = streak >= INNER_PERSISTENT_FRAMES
      if (inCluster) clustered++
      if (alone) persistent++
      return { position: sample.position, state: sample.state, streak, counted: inCluster || alone }
    })
    // 이웃끼리 이어졌으면 적어도 2개다
    const now = clustered >= 2 || persistent > 0
    this.clearFrames = now ? 0 : this.clearFrames + 1
    this.blocked = now || (this.blocked && this.clearFrames < INNER_RELEASE_FRAMES)
    return {
      directions: this.directions,
      samples: reports,
      obstacles: reports.filter((report) => report.state === 'obstacle').length,
      clustered,
      persistent,
      blocked: this.blocked,
    }
  }

  reset() {
    this.clearHistory()
    this.lastCenter = null
  }

  private clearHistory() {
    this.streaks.fill(0)
    this.blocked = false
    this.clearFrames = 0
  }
}
