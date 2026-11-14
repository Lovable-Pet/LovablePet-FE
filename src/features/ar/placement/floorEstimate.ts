import type { SurfaceHit, Vec3 } from './types'

/** 면의 위쪽 방향이 이만큼 넘게 수직이면 수평면으로 본다 (cos 18° ≈ 0.95) */
export const HORIZONTAL_MIN_UP = 0.95
/** 바닥보다 이만큼(m) 넘게 높으면 바닥이 아니다 (책상·소파·침대). 러그·문턱 정도는 바닥으로 본다 */
export const RAISED_TOLERANCE_M = 0.05

/** 바닥 추정에 쓰는 기간 (ms). 이보다 오래된 수평 hit 은 버린다 (추적 좌표가 다시 맞춰져 높이가 어긋난 옛 값 등) */
export const FLOOR_WINDOW_MS = 15_000
/** 높이 칸 (m) */
export const FLOOR_BIN_M = 0.02
/** 바닥 후보 조건: 칸에 든 hit 수 */
export const FLOOR_MIN_HITS = 20
/** 바닥 후보 조건: 처음부터 마지막까지 이만큼(ms)에 걸쳐 보임 */
export const FLOOR_MIN_SPAN_MS = 500
/** 바닥 후보 조건: 가로 퍼짐 (hit 들의 x·z 범위 대각선, m). 광택 바닥의 반사처럼 좁게만 잡히는 면을 거른다 */
export const FLOOR_MIN_SPREAD_M = 0.4
/** 지금 바닥보다 낮은 새 후보가 이만큼(ms) 이어져야 바닥을 바꾼다 (값이 자주 흔들리지 않게) */
export const FLOOR_SWITCH_HOLD_MS = 1000
/** 정리(prune): 최근 이만큼(ms) 안에 다시 보지 못한 칸은 버린다 */
export const FLOOR_RECONFIRM_MS = 3000
/** 카메라에서 수평 거리로 이만큼(m) 넘게 떨어진 hit 은 바닥 추정에 쓰지 않는다 (원 표시·판정에는 쓴다) */
export const FLOOR_MAX_DISTANCE_M = 2.5
/**
 * 광선과 면 사이 각도가 이만큼(°)보다 작으면(비스듬하면) 바닥 추정에 쓰지 않는다.
 * 먼 곳을 낮은 각도로 보면 ARCore 면이 조금만 기울어도 높이가 크게 틀어진다 (2° 기울기 × 4m ≈ 14cm)
 */
export const FLOOR_MIN_GRAZING_DEG = 25

export const isHorizontal = (normal: Vec3) => normal.y >= HORIZONTAL_MIN_UP

/**
 * 가운데 hit 을 바닥 추정에 썼는지. used: 씀 · far: 2.5m 넘게 멀다 · grazing: 너무 비스듬하다 ·
 * notHorizontal: 수평면이 아니다 · none: 맞은 것이 없다
 */
export type HitUse = 'used' | 'far' | 'grazing' | 'notHorizontal' | 'none'

/** 카메라에서 hit 까지 수평 거리(m)와 광선이 면에 맞는 각도(°, 광선과 면 사이. 90° 는 수직으로 내려다봄) */
export function hitGeometry(hit: SurfaceHit, camera: Vec3): { distance: number; grazingDeg: number } {
  const dx = hit.position.x - camera.x
  const dy = hit.position.y - camera.y
  const dz = hit.position.z - camera.z
  const length = Math.hypot(dx, dy, dz)
  const { normal } = hit
  const normalLength = Math.hypot(normal.x, normal.y, normal.z) || 1
  // 광선과 면 사이 각도 = 90° − 광선과 법선 사이 각도
  const sine = Math.abs(dx * normal.x + dy * normal.y + dz * normal.z) / (length * normalLength || 1)
  return { distance: Math.hypot(dx, dz), grazingDeg: (Math.asin(Math.min(1, sine)) * 180) / Math.PI }
}

/** hit 을 바닥 추정에 쓸 수 있는지 (카메라 위치 기준) */
export function floorHitUse(hit: SurfaceHit | null, camera: Vec3): HitUse {
  if (!hit) return 'none'
  if (!isHorizontal(hit.normal)) return 'notHorizontal'
  const { distance, grazingDeg } = hitGeometry(hit, camera)
  if (distance > FLOOR_MAX_DISTANCE_M) return 'far'
  if (grazingDeg < FLOOR_MIN_GRAZING_DEG) return 'grazing'
  return 'used'
}

/**
 * floor: 바닥 높이 · raised: 바닥보다 5cm 넘게 높음 (책상·소파) ·
 * lower: 바닥보다 5cm 넘게 낮음 (아직 바닥으로 확정되지 않은 더 낮은 면. 원 자리로 쓰지 않는다)
 */
export type SurfaceLevel = 'floor' | 'raised' | 'lower'

/** 높이 칸 하나의 집계 (최근 FLOOR_WINDOW_MS 안의 수평 hit) */
export interface FloorBin {
  key: number
  /** 칸에 든 hit 높이 평균 (m) */
  y: number
  hits: number
  /** 처음·마지막으로 본 시각 (ms, 프레임 시각) */
  firstSeen: number
  lastSeen: number
  /** 가로 퍼짐 (m) */
  spread: number
  /** 바닥 후보 조건을 모두 채웠는지 */
  candidate: boolean
}

export interface FloorStatus {
  /** 바닥 높이. 확정된 바닥, 없으면 임시 바닥(지금 맞은 수평면). 아직 수평면을 못 봤으면 null */
  y: number | null
  /** 마지막 가운데 hit 을 추정에 썼는지 */
  lastUse: HitUse
  /** 후보가 없어 임시 바닥을 쓰는 중 */
  provisional: boolean
  /** 확정 바닥의 칸 */
  bin: FloorBin | null
  /** 바닥을 바꿀 새 후보와 그 후보가 이어진 시간 */
  pending: { bin: FloorBin; heldMs: number } | null
  /** hit 이 많은 칸 위 3개 */
  top: FloorBin[]
}

interface Sample {
  time: number
  x: number
  y: number
  z: number
  key: number
}

/**
 * 바닥 높이 추정. 최근 15초의 수평 hit 을 2cm 높이 칸으로 모아,
 * hit 20개 이상 · 0.5초 이상 · 가로 0.4m 이상 퍼진 칸만 바닥 후보로 보고 그중 가장 낮은 것을 바닥으로 쓴다.
 * - 카메라에서 2.5m 넘게 멀거나 25°보다 비스듬히 맞은 hit 은 넣지 않는다 (면이 조금만 기울어도 높이가 크게 틀어진다)
 * - 한두 번 튀거나 좁게만 잡힌 낮은 면(광택 바닥의 반사 등)은 바닥이 되지 못한다
 * - 좌표가 어긋나 옛 높이가 남아도 15초가 지나면 빠진다
 * - 후보가 없으면(처음 몇 초) 지금 맞은 수평면을 임시 바닥으로 쓴다 (처음부터 책상만 비추면 책상이 바닥이 된다)
 * - 바닥이 있을 때 새 후보로 바꾸려면 그 후보가 1초 넘게 가장 낮은 후보여야 한다
 */
export class FloorEstimate {
  private samples: Sample[] = []
  private bins = new Map<number, FloorBin>()
  private currentKey: number | null = null
  private pending: { key: number; since: number } | null = null
  private lastHorizontalY: number | null = null
  private lastUse: HitUse = 'none'
  private now = 0

  /**
   * 매 프레임 부른다. 가운데 광선이 맞은 면이 쓸 만한 수평면이면 넣는다 (아니어도 오래된 값 버리기·바꾸기 대기는 돈다).
   * 임시 바닥은 멀거나 비스듬해도 지금 맞은 수평면 높이다 (그 자리에 놓기 때문)
   */
  update(time: number, hit: SurfaceHit | null, camera: Vec3) {
    this.now = time
    this.lastUse = floorHitUse(hit, camera)
    if (hit && this.lastUse !== 'notHorizontal') this.lastHorizontalY = hit.position.y
    if (hit && this.lastUse === 'used') {
      const { x, y, z } = hit.position
      this.samples.push({ time, x, y, z, key: Math.floor(y / FLOOR_BIN_M) })
    }
    const before = time - FLOOR_WINDOW_MS
    let expired = 0
    while (expired < this.samples.length && this.samples[expired].time < before) expired++
    if (expired) this.samples.splice(0, expired)
    this.rebuild()
    this.choose(time)
  }

  /** 바닥 높이 (확정, 없으면 임시) */
  get y(): number | null {
    return this.currentBin()?.y ?? this.lastHorizontalY
  }

  /** 임시 바닥(후보 없음)을 쓰는 중인지 */
  get provisional(): boolean {
    return this.currentBin() === null && this.lastHorizontalY !== null
  }

  /** 이 높이가 바닥인지. 확정된 바닥이 없으면(임시) 늘 바닥으로 본다 */
  levelOf(y: number): SurfaceLevel {
    const bin = this.currentBin()
    if (!bin) return 'floor'
    if (y > bin.y + RAISED_TOLERANCE_M) return 'raised'
    if (y < bin.y - RAISED_TOLERANCE_M) return 'lower'
    return 'floor'
  }

  status(): FloorStatus {
    const pendingBin = this.pending ? (this.bins.get(this.pending.key) ?? null) : null
    return {
      y: this.y,
      lastUse: this.lastUse,
      provisional: this.provisional,
      bin: this.currentBin(),
      pending: pendingBin && this.pending ? { bin: pendingBin, heldMs: this.now - this.pending.since } : null,
      top: [...this.bins.values()].sort((a, b) => b.hits - a.hits).slice(0, 3),
    }
  }

  /** 처음부터 다시 (모든 hit 을 버린다) */
  reset() {
    this.samples = []
    this.bins.clear()
    this.currentKey = null
    this.pending = null
    this.lastHorizontalY = null
    this.lastUse = 'none'
  }

  /** 최근 FLOOR_RECONFIRM_MS 안에 다시 보지 못한 칸의 hit 을 버린다 */
  prune(time: number) {
    const stale = new Set([...this.bins.values()].filter((bin) => time - bin.lastSeen > FLOOR_RECONFIRM_MS).map((bin) => bin.key))
    if (!stale.size) return
    this.samples = this.samples.filter((sample) => !stale.has(sample.key))
    this.rebuild()
    if (this.currentKey !== null && stale.has(this.currentKey)) this.currentKey = null
    if (this.pending && stale.has(this.pending.key)) this.pending = null
    this.choose(time)
  }

  private currentBin(): FloorBin | null {
    return this.currentKey === null ? null : (this.bins.get(this.currentKey) ?? null)
  }

  private rebuild() {
    const groups = new Map<number, { sumY: number; hits: number; first: number; last: number; minX: number; maxX: number; minZ: number; maxZ: number }>()
    for (const { time, x, y, z, key } of this.samples) {
      const group = groups.get(key)
      if (!group) {
        groups.set(key, { sumY: y, hits: 1, first: time, last: time, minX: x, maxX: x, minZ: z, maxZ: z })
        continue
      }
      group.sumY += y
      group.hits++
      group.first = Math.min(group.first, time)
      group.last = Math.max(group.last, time)
      group.minX = Math.min(group.minX, x)
      group.maxX = Math.max(group.maxX, x)
      group.minZ = Math.min(group.minZ, z)
      group.maxZ = Math.max(group.maxZ, z)
    }
    this.bins.clear()
    for (const [key, group] of groups) {
      const spread = Math.hypot(group.maxX - group.minX, group.maxZ - group.minZ)
      this.bins.set(key, {
        key,
        y: group.sumY / group.hits,
        hits: group.hits,
        firstSeen: group.first,
        lastSeen: group.last,
        spread,
        candidate:
          group.hits >= FLOOR_MIN_HITS && group.last - group.first >= FLOOR_MIN_SPAN_MS && spread >= FLOOR_MIN_SPREAD_M,
      })
    }
  }

  private choose(time: number) {
    let best: FloorBin | null = null
    for (const bin of this.bins.values()) if (bin.candidate && (!best || bin.y < best.y)) best = bin
    if (!best) {
      this.currentKey = null
      this.pending = null
      return
    }
    // 바닥이 없거나 지금 바닥이 후보에서 빠졌으면 바로 가장 낮은 후보로
    if (this.currentKey === null || !this.bins.get(this.currentKey)?.candidate) {
      this.currentKey = best.key
      this.pending = null
      return
    }
    if (best.key === this.currentKey) {
      this.pending = null
      return
    }
    if (this.pending?.key !== best.key) {
      this.pending = { key: best.key, since: time }
      return
    }
    if (time - this.pending.since >= FLOOR_SWITCH_HOLD_MS) {
      this.currentKey = best.key
      this.pending = null
    }
  }
}
