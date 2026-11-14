import type { SurfaceHit, Vec3 } from './types'

/** 면의 위쪽 방향이 이만큼 넘게 수직이면 수평면으로 본다 (cos 18° ≈ 0.95) */
export const HORIZONTAL_MIN_UP = 0.95
/** 바닥 층보다 이만큼(m) 넘게 높으면 높은 면이다 (책상·소파·침대). 러그·문턱·ARCore 높이 흔들림은 바닥으로 본다 */
export const RAISED_ENTER_M = 0.08
/** 높은 면으로 본 뒤에는 바닥 층 + 이만큼(m) 아래로 내려와야 풀린다 (경계에서 깜빡이지 않게) */
export const RAISED_EXIT_M = 0.06
/** 바닥 층보다 이만큼(m) 넘게 낮으면 아직 확정 안 된 더 낮은 면이다 (원 자리로 쓰지 않는다) */
export const LOWER_M = 0.08

/** 바닥 추정에 쓰는 기간 (ms). 이보다 오래된 수평 hit 은 버린다 */
export const FLOOR_WINDOW_MS = 15_000
/** 높이 칸 (m) */
export const FLOOR_BIN_M = 0.02
/** 바닥 후보 칸 조건: 칸에 든 hit 수 */
export const FLOOR_MIN_HITS = 20
/** 바닥 후보 칸 조건: 처음부터 마지막까지 이만큼(ms)에 걸쳐 보임 */
export const FLOOR_MIN_SPAN_MS = 500
/** 바닥 후보 칸 조건: 가로 퍼짐 (hit 들의 x·z 범위 대각선, m). 광택 바닥의 반사처럼 좁게만 잡히는 면을 거른다 */
export const FLOOR_MIN_SPREAD_M = 0.4
/** 후보 칸끼리 높이 차가 이만큼(m) 안이면 같은 바닥 층으로 잇는다 (ARCore 높이가 서서히 움직여 생긴 이웃 칸) */
export const LAYER_JOIN_M = 0.06
/** 층 높이끼리 이만큼(m) 넘게 떨어져야 다른 층이다. 안이면 한 층으로 합친다 */
export const LAYER_SEPARATION_M = 0.08
/** 층 높이 = 그 층을 마지막으로 본 때부터 이만큼(ms) 안의 hit 높이 중앙값 (서서히 움직이는 높이를 따라간다) */
export const LAYER_HEIGHT_MS = 2500
/** 층을 이만큼(ms) 다시 못 보면 후보에서 뺀다 */
export const LAYER_EXPIRE_MS = 5000
/** 지금 바닥보다 낮은 다른 층이 이만큼(ms) 이어져야 바닥을 바꾼다 */
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
 * floor: 바닥 층 높이 · raised: 바닥 층보다 8cm 넘게 높음 (책상·소파, 6cm 아래로 와야 풀림) ·
 * lower: 바닥 층보다 8cm 넘게 낮음 (아직 바닥으로 확정되지 않은 더 낮은 면. 원 자리로 쓰지 않는다)
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

/** 바닥 층: 높이가 이어진 후보 칸 묶음 */
export interface FloorLayer {
  /** 층 높이: 마지막으로 본 때부터 2.5초 안의 hit 높이 중앙값 (m) */
  y: number
  /** 묶인 후보 칸 (낮은 것부터) */
  bins: FloorBin[]
  hits: number
  firstSeen: number
  lastSeen: number
}

export interface FloorStatus {
  /** 바닥 높이. 확정된 바닥 층, 없으면 임시 바닥(지금 맞은 수평면). 아직 수평면을 못 봤으면 null */
  y: number | null
  /** 후보가 없어 임시 바닥을 쓰는 중 */
  provisional: boolean
  /** 마지막 가운데 hit 을 추정에 썼는지 */
  lastUse: HitUse
  /** 바닥으로 쓰는 층 */
  layer: FloorLayer | null
  /** 살아 있는 층 전부 (낮은 것부터) */
  layers: FloorLayer[]
  /** 바닥을 바꿀 더 낮은 층과 그 층이 이어진 시간 */
  pending: { layer: FloorLayer; heldMs: number } | null
  /** hit 이 많은 칸 위 3개 */
  top: FloorBin[]
  /** raised 기준: 바닥 층 + 8cm 를 넘으면 raised, 풀림은 + 6cm 아래. 지금 raised 로 잡혀 있는지 */
  raised: { enterY: number; exitY: number; latched: boolean } | null
}

interface Sample {
  time: number
  x: number
  y: number
  z: number
  key: number
}

const median = (values: number[]): number => {
  const sorted = [...values].sort((a, b) => a - b)
  const middle = sorted.length >> 1
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
}

/**
 * 바닥 높이 추정.
 * 1. 최근 15초의 수평 hit(2.5m 안, 25° 넘게 세워 본 것)을 2cm 높이 칸으로 모아,
 *    hit 20개 이상 · 0.5초 이상 · 가로 0.4m 이상 퍼진 칸만 후보로 본다 (한 번 튄·좁은 반사는 못 든다)
 * 2. 후보 칸끼리 6cm 안이면 같은 바닥 층으로 잇고, 층 높이끼리 8cm 안이면 합친다.
 *    층 높이는 최근 2.5초 hit 의 중앙값이라 ARCore 높이가 서서히 움직여도 따라간다
 * 3. 5초 동안 다시 안 보인 층은 뺀다. 남은 층 중 가장 낮은 층이 바닥 (다른 층으로 바꿀 때는 1초 기다린다)
 * 4. 후보가 없으면(처음 몇 초) 지금 맞은 수평면을 임시 바닥으로 쓴다 (처음부터 책상만 비추면 책상이 바닥이 된다)
 */
export class FloorEstimate {
  private samples: Sample[] = []
  private bins = new Map<number, FloorBin>()
  private layers: FloorLayer[] = []
  /** 바닥 층의 높이 (프레임마다 그 층을 다시 찾을 때 쓴다) */
  private currentY: number | null = null
  private pending: { y: number; since: number } | null = null
  private lastHorizontalY: number | null = null
  private lastUse: HitUse = 'none'
  private raisedLatched = false
  private now = 0

  /**
   * 매 프레임 부른다. 가운데 광선이 맞은 면이 쓸 만한 수평면이면 넣는다 (아니어도 오래된 값 버리기·층 고르기는 돈다).
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
    this.rebuild(time)
    this.choose(time)
  }

  /** 바닥 높이 (확정된 바닥 층, 없으면 임시) */
  get y(): number | null {
    return this.currentLayer()?.y ?? this.lastHorizontalY
  }

  /** 임시 바닥(후보 없음)을 쓰는 중인지 */
  get provisional(): boolean {
    return this.currentLayer() === null && this.lastHorizontalY !== null
  }

  /**
   * 가운데 hit 높이가 바닥 층에 견줘 어디인지. raised 는 히스테리시스가 있어 매 프레임 한 번만 부른다.
   * 확정된 바닥 층이 없으면(임시) 늘 바닥으로 본다
   */
  classify(y: number): SurfaceLevel {
    const layer = this.currentLayer()
    if (!layer) {
      this.raisedLatched = false
      return 'floor'
    }
    const above = y - layer.y
    if (above < -LOWER_M) {
      this.raisedLatched = false
      return 'lower'
    }
    this.raisedLatched = this.raisedLatched ? above > RAISED_EXIT_M : above > RAISED_ENTER_M
    return this.raisedLatched ? 'raised' : 'floor'
  }

  status(): FloorStatus {
    const layer = this.currentLayer()
    const pendingLayer = this.pending ? this.nearestLayer(this.pending.y) : null
    return {
      y: this.y,
      provisional: this.provisional,
      lastUse: this.lastUse,
      layer,
      layers: this.layers,
      pending: pendingLayer && this.pending ? { layer: pendingLayer, heldMs: this.now - this.pending.since } : null,
      top: [...this.bins.values()].sort((a, b) => b.hits - a.hits).slice(0, 3),
      raised: layer
        ? { enterY: layer.y + RAISED_ENTER_M, exitY: layer.y + RAISED_EXIT_M, latched: this.raisedLatched }
        : null,
    }
  }

  /** 처음부터 다시 (모든 hit 을 버린다) */
  reset() {
    this.samples = []
    this.bins.clear()
    this.layers = []
    this.currentY = null
    this.pending = null
    this.lastHorizontalY = null
    this.lastUse = 'none'
    this.raisedLatched = false
  }

  /** 최근 FLOOR_RECONFIRM_MS 안에 다시 보지 못한 칸의 hit 을 버린다 */
  prune(time: number) {
    const stale = new Set([...this.bins.values()].filter((bin) => time - bin.lastSeen > FLOOR_RECONFIRM_MS).map((bin) => bin.key))
    if (!stale.size) return
    this.samples = this.samples.filter((sample) => !stale.has(sample.key))
    this.rebuild(time)
    this.choose(time)
  }

  private currentLayer(): FloorLayer | null {
    return this.currentY === null ? null : this.nearestLayer(this.currentY)
  }

  /** 높이 y 에서 8cm 안의 가장 가까운 층 (층 높이는 프레임마다 조금씩 움직여 높이로 다시 찾는다) */
  private nearestLayer(y: number): FloorLayer | null {
    let best: FloorLayer | null = null
    for (const layer of this.layers) {
      const distance = Math.abs(layer.y - y)
      if (distance <= LAYER_SEPARATION_M && (!best || distance < Math.abs(best.y - y))) best = layer
    }
    return best
  }

  private rebuild(time: number) {
    const groups = new Map<
      number,
      { sumY: number; hits: number; first: number; last: number; minX: number; maxX: number; minZ: number; maxZ: number }
    >()
    for (const { time: seen, x, y, z, key } of this.samples) {
      const group = groups.get(key)
      if (!group) {
        groups.set(key, { sumY: y, hits: 1, first: seen, last: seen, minX: x, maxX: x, minZ: z, maxZ: z })
        continue
      }
      group.sumY += y
      group.hits++
      group.first = Math.min(group.first, seen)
      group.last = Math.max(group.last, seen)
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
    this.layers = this.buildLayers(time)
  }

  /** 후보 칸 → 바닥 층. 6cm 안으로 잇고, 5초 넘게 안 보인 층은 빼고, 높이가 8cm 안인 층은 합친다 */
  private buildLayers(time: number): FloorLayer[] {
    const candidates = [...this.bins.values()].filter((bin) => bin.candidate).sort((a, b) => a.y - b.y)
    const chains: FloorBin[][] = []
    for (const bin of candidates) {
      const chain = chains.at(-1)
      if (chain && bin.y - chain[chain.length - 1].y <= LAYER_JOIN_M) chain.push(bin)
      else chains.push([bin])
    }
    let layers = chains.map((bins) => this.toLayer(bins)).filter((layer) => time - layer.lastSeen <= LAYER_EXPIRE_MS)
    // 층 높이가 8cm 안으로 붙어 있으면 한 층이다
    for (let merged = true; merged; ) {
      merged = false
      for (let index = 1; index < layers.length; index++) {
        if (layers[index].y - layers[index - 1].y > LAYER_SEPARATION_M) continue
        const joined = this.toLayer([...layers[index - 1].bins, ...layers[index].bins].sort((a, b) => a.y - b.y))
        layers = [...layers.slice(0, index - 1), joined, ...layers.slice(index + 1)]
        merged = true
        break
      }
    }
    return layers
  }

  private toLayer(bins: FloorBin[]): FloorLayer {
    const keys = new Set(bins.map((bin) => bin.key))
    const lastSeen = Math.max(...bins.map((bin) => bin.lastSeen))
    const recent = this.samples
      .filter((sample) => keys.has(sample.key) && sample.time >= lastSeen - LAYER_HEIGHT_MS)
      .map((sample) => sample.y)
    return {
      y: median(recent),
      bins,
      hits: bins.reduce((sum, bin) => sum + bin.hits, 0),
      firstSeen: Math.min(...bins.map((bin) => bin.firstSeen)),
      lastSeen,
    }
  }

  private choose(time: number) {
    const lowest = this.layers[0] ?? null
    if (!lowest) {
      this.currentY = null
      this.pending = null
      return
    }
    const current = this.currentY === null ? null : this.nearestLayer(this.currentY)
    // 바닥이 없거나 지금 바닥 층이 사라졌으면 바로 가장 낮은 층으로
    if (!current) {
      this.currentY = lowest.y
      this.pending = null
      return
    }
    this.currentY = current.y
    if (current === lowest) {
      this.pending = null
      return
    }
    // 더 낮은 다른 층: 1초 넘게 이어지면 바꾼다
    if (!this.pending || Math.abs(this.pending.y - lowest.y) > LAYER_SEPARATION_M) {
      this.pending = { y: lowest.y, since: time }
      return
    }
    this.pending.y = lowest.y
    if (time - this.pending.since >= FLOOR_SWITCH_HOLD_MS) {
      this.currentY = lowest.y
      this.pending = null
    }
  }
}
