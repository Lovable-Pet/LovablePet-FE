import type { ProbeSet } from './arStage'
import { isHorizontal, RAISED_ENTER_M } from './floorEstimate'
import { distanceXZ, type Ray, type SurfaceHit, type Vec3 } from './types'

// 자리 검사 (장애물 1차). 원 둘레 8곳이 원 중심과 같은 바닥인지, 둘레 안에 벽·소파 옆면 같은 수직면이 없는지 본다.
// - 위→아래 광선 8개: 둘레 위 (개 키 + 10cm) 에서 내려 처음 맞은 면이 바닥 높이의 수평면이어야 한다.
//   8cm 넘게 높은 면(소파 방석·침대·낮은 탁자)이나 기운 면이면 막힘. 개보다 높은 식탁 아래는 막지 않는다
// - 옆 광선 8개: 원 중심, 개 키 절반 높이에서 바깥으로. 둘레 반지름 안에서 수직면(벽·가구 옆면)을 맞히면 막힘
//   (위→아래 광선은 벽과 나란해서 벽을 맞히지 못한다)
// - 아무것도 안 맞은 곳(아직 비춰 보지 않은 곳)은 막지 않는다. 확인된 장애물이 있을 때만 막는다
// 여기서는 방향마다 판정만 내고, 막을지는 PerimeterVote 가 깊이 검사와 합쳐 정한다 (2곳 이상 · 3프레임 연속)

/** 둘레에서 볼 방향 수 */
export const SPOT_DIRECTIONS = 8
/** 원 중심이 이만큼(m) 넘게 움직이면 광선을 다시 만든다 */
export const PROBE_REBUILD_M = 0.1
/** 바닥 높이가 이만큼(m) 넘게 바뀌어도 다시 만든다 */
const PROBE_FLOOR_SHIFT_M = 0.02
/**
 * 둘레 반지름 = 몸길이 절반 + 개 키 × 이 값. 구르기·빵(옆으로 눕기)에서 다리가 몸 옆으로 나오는 여유.
 * 0.4 는 큰 개에서 둘레가 1m 가까이 나가 휴대폰을 든 사람의 발까지 닿아 0.2 로 줄였다
 */
export const ACTION_HEIGHT_RATIO = 0.2
/** 위→아래 광선을 개 키보다 이만큼(m) 위에서 쏜다 */
const DOWN_PROBE_CLEARANCE_M = 0.1
/** 옆 광선 높이 범위 (m). 개 키의 절반을 쓴다 */
const SIDE_PROBE_MIN_M = 0.1
const SIDE_PROBE_MAX_M = 0.4

export type ProbeKind = 'down' | 'side'

export interface Probe {
  kind: ProbeKind
  /** 둘레 방향 번호 (0 ~ SPOT_DIRECTIONS-1, 각도 = 번호 / 방향 수 × 360°) */
  direction: number
  ray: Ray
  /** 옆 광선: 이 거리(m) 안에서 맞으면 막힘 */
  reach: number
}

/** clear: 비었음 · blocked: 장애물 · unknown: 아무것도 안 맞음 (아직 모름) */
export type ProbeVerdict = 'clear' | 'blocked' | 'unknown'

export interface SpotReport {
  /** 지금 원 자리의 결과인지. 광선을 다시 만드는 중이거나 못 만들면 false (막지 않는다) */
  fresh: boolean
  /** 광선을 만들 수 없어 자리 검사를 못 함 */
  unavailable: boolean
  clear: number
  obstacles: number
  unknown: number
  /** 방향마다 (위→아래·옆 광선을 합쳐) 장애물이 하나라도 있으면 blocked, 빈 곳이 있으면 clear. 길이 SPOT_DIRECTIONS */
  directions: ProbeVerdict[]
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

/** 개가 구르기·빵을 해도 닿는 반지름 (m): 몸길이의 절반 + 옆으로 누웠을 때 다리 */
export function actionRadius(size: Vec3): number {
  return Math.max(size.x, size.z) / 2 + ACTION_HEIGHT_RATIO * size.y
}

/** 원 중심·바닥 높이·개 크기로 광선 16개 (방향마다 위→아래, 옆) */
export function buildProbes(center: Vec3, floorY: number, size: Vec3): Probe[] {
  const radius = actionRadius(size)
  const top = floorY + size.y + DOWN_PROBE_CLEARANCE_M
  const sideY = floorY + clamp(size.y / 2, SIDE_PROBE_MIN_M, SIDE_PROBE_MAX_M)
  const probes: Probe[] = []
  for (let index = 0; index < SPOT_DIRECTIONS; index++) {
    const angle = (index / SPOT_DIRECTIONS) * Math.PI * 2
    const dx = Math.sin(angle)
    const dz = Math.cos(angle)
    probes.push({
      kind: 'down',
      direction: index,
      reach: Infinity,
      ray: { origin: { x: center.x + dx * radius, y: top, z: center.z + dz * radius }, direction: { x: 0, y: -1, z: 0 } },
    })
    probes.push({
      kind: 'side',
      direction: index,
      reach: radius,
      ray: { origin: { x: center.x, y: sideY, z: center.z }, direction: { x: dx, y: 0, z: dz } },
    })
  }
  return probes
}

export function judgeProbe(probe: Probe, hit: SurfaceHit | null, floorY: number): ProbeVerdict {
  if (!hit) return 'unknown'
  if (probe.kind === 'down') {
    if (!isHorizontal(hit.normal)) return 'blocked'
    // 바닥 판정과 같은 8cm (ARCore 바닥 높이가 몇 cm 흔들려도 같은 바닥으로 본다)
    return Math.abs(hit.position.y - floorY) > RAISED_ENTER_M ? 'blocked' : 'clear'
  }
  const { origin } = probe.ray
  const distance = Math.hypot(hit.position.x - origin.x, hit.position.y - origin.y, hit.position.z - origin.z)
  if (distance > probe.reach) return 'clear'
  return isHorizontal(hit.normal) ? 'clear' : 'blocked'
}

const notFresh = (unavailable: boolean): SpotReport => ({
  fresh: false,
  unavailable,
  clear: 0,
  obstacles: 0,
  unknown: 0,
  directions: Array.from({ length: SPOT_DIRECTIONS }, () => 'unknown'),
})

/**
 * 광선 묶음을 만들고 결과를 판정한다. 원이 10cm 넘게 움직였을 때만 묶음을 다시 만든다 (만들기는 비동기).
 * 묶음을 만드는 일은 create 로 받는다 (렌더러를 모른다)
 */
export class SpotCheck {
  readonly radius: number
  private readonly create: (rays: readonly Ray[]) => Promise<ProbeSet>
  private readonly size: Vec3
  private active: { center: Vec3; floorY: number; probes: Probe[]; set: ProbeSet } | null = null
  private pending = false
  /** 만든 묶음이 아직 쓸모 있는지 가르는 번호. idle·다시 만들 때 올린다 */
  private generation = 0
  private unavailable = false

  constructor(create: (rays: readonly Ray[]) => Promise<ProbeSet>, size: Vec3) {
    this.create = create
    this.size = size
    this.radius = actionRadius(size)
  }

  /** 매 프레임, 원이 바닥 위에 있을 때 (프레임 안에서 불러야 결과를 읽는다) */
  update(center: Vec3, floorY: number): SpotReport {
    const { active } = this
    const stale =
      !active ||
      distanceXZ(active.center, center) > PROBE_REBUILD_M ||
      Math.abs(active.floorY - floorY) > PROBE_FLOOR_SHIFT_M
    if (stale) {
      if (!this.pending && !this.unavailable) this.rebuild(center, floorY)
      return notFresh(this.unavailable)
    }
    const hits = active.set.read()
    let clear = 0
    let obstacles = 0
    let unknown = 0
    const directions: ProbeVerdict[] = Array.from({ length: SPOT_DIRECTIONS }, () => 'unknown')
    active.probes.forEach((probe, index) => {
      const verdict = judgeProbe(probe, hits[index] ?? null, floorY)
      if (verdict === 'clear') clear++
      else if (verdict === 'blocked') obstacles++
      else unknown++
      const before = directions[probe.direction]
      if (verdict === 'blocked' || (verdict === 'clear' && before === 'unknown')) directions[probe.direction] = verdict
    })
    return { fresh: true, unavailable: false, clear, obstacles, unknown, directions }
  }

  /** 원이 없거나 바닥이 아니거나 놓은 뒤: 광선을 끝낸다 */
  idle() {
    this.generation++
    this.active?.set.cancel()
    this.active = null
  }

  private rebuild(center: Vec3, floorY: number) {
    const generation = ++this.generation
    const probes = buildProbes(center, floorY, this.size)
    this.pending = true
    this.create(probes.map((probe) => probe.ray)).then(
      (set) => {
        this.pending = false
        if (generation !== this.generation) {
          set.cancel()
          return
        }
        this.active?.set.cancel()
        this.active = { center, floorY, probes, set }
      },
      () => {
        this.pending = false
        this.unavailable = true
      },
    )
  }
}
