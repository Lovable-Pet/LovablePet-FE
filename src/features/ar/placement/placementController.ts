import type { ArStage, StageFrame } from './arStage'
import { yawToward } from './facing'
import { FloorEstimate, isHorizontal, type SurfaceLevel } from './floorEstimate'
import { CenterOcclusion, samplePerimeterDepth, type OcclusionResult } from './occlusion'
import { PerimeterVote, type DirectionReport, type PerimeterReport } from './perimeterVote'
import { SpotCheck, type SpotReport } from './spotCheck'
import { distanceXZ, type SurfaceHit, type Vec3 } from './types'

/**
 * searching: 바닥 못 찾음 (원 숨김) · placeable: 놓을 수 있음 · blocked: 놓을 수 없음 · placed: 놓았음
 */
export type PlacementPhase = 'searching' | 'placeable' | 'blocked' | 'placed'

/**
 * 놓을 수 없는 까닭.
 * raised: 바닥보다 높은 면 · occluded: 바닥 앞에 실제 물체가 있음 (면으로 인식 안 된 책상·문) · obstacle: 둘레에 장애물
 */
export type BlockReason = 'raised' | 'occluded' | 'obstacle'

export interface PlacementSnapshot {
  phase: PlacementPhase
  /** 바닥(수평면)을 한 번이라도 봤는지 */
  floorKnown: boolean
  /** blocked 일 때 까닭 */
  blockedBy: BlockReason | null
}

export interface PlacementControllerOptions {
  /** 상태가 바뀔 때만 부른다 */
  onChange(snapshot: PlacementSnapshot): void
  /** hit-test 를 쓸 수 없어 직접 놓기를 못 할 때 */
  onUnavailable(reason: string): void
  /** 디버그 글. 주면 놓은 자리에 표시 원도 남긴다 (발밑 가운데가 원 중심에 오는지 보려고) */
  onDebug?(lines: string[]): void
}

/** 가운데 광선이 바닥을 놓쳐도 이만큼(ms)은 원을 그대로 둔다. 한두 프레임 놓칠 때 깜빡이지 않게 */
const LOST_GRACE_MS = 250
/** 디버그 글을 고치는 간격 (ms) */
const DEBUG_INTERVAL_MS = 200
/** 디버그: 막힌 근거를 이만큼(ms) 동안 센다 */
const DEBUG_STATS_MS = 3000

/** 디버그: 최근 몇 초 동안 근거마다 막힌 프레임 수 */
class RecentCounts {
  private readonly windowMs: number
  private readonly events: { time: number; reason: BlockReason }[] = []

  constructor(windowMs: number) {
    this.windowMs = windowMs
  }

  add(time: number, reason: BlockReason) {
    this.events.push({ time, reason })
  }

  counts(now: number): Record<BlockReason, number> {
    while (this.events.length && now - this.events[0].time > this.windowMs) this.events.shift()
    const counts: Record<BlockReason, number> = { occluded: 0, obstacle: 0, raised: 0 }
    for (const { reason } of this.events) counts[reason]++
    return counts
  }

  clear() {
    this.events.length = 0
  }
}

interface Spot {
  /** 원 중심 = 가운데 광선이 맞은 점 */
  center: Vec3
  level: SurfaceLevel
  seenAt: number
}

/**
 * AR 배치 흐름. 렌더러는 ArStage 로만 만진다.
 * 1. 개를 숨기고, 매 프레임 화면 가운데 광선이 맞은 수평면에 원을 눕힌다. 놓을 수 없는 때:
 *    - 바닥보다 5cm 넘게 높은 면
 *    - 바닥 hit 앞에 실제 물체가 있음 (CenterOcclusion: 깊이 센서 → 특징점 → 판정 안 함)
 *    - 둘레에 장애물이 확인됨 (SpotCheck 광선 + samplePerimeterDepth 깊이 → PerimeterVote: 2곳 이상 · 3프레임 연속)
 * 2. place(): 놓을 수 있을 때만 원 중심·바닥 높이에 개를 놓고, 앞쪽이 휴대폰을 향하게 한다. 그 뒤 방향은 고정.
 *    place({ force: true }) 는 막혀 있어도 놓는다 (디버그 확인용, 부르는 쪽이 ?debug 에서만 쓴다)
 * 3. replace(): 개를 숨기고 1 로 돌아간다
 */
export class PlacementController {
  /** 원 반지름: 개 가로·세로 중 긴 쪽의 절반 (원 안에 개가 들어간다) */
  readonly ringRadius: number
  private readonly stage: ArStage
  private readonly options: PlacementControllerOptions
  private readonly floor = new FloorEstimate()
  private readonly spotCheck: SpotCheck
  private readonly centerOcclusion = new CenterOcclusion()
  private readonly perimeterVote = new PerimeterVote()
  private readonly blockStats = new RecentCounts(DEBUG_STATS_MS)
  private spotReport: SpotReport | null = null
  private occlusion: OcclusionResult | null = null
  private perimeter: PerimeterReport | null = null
  private forced = false
  private phase: PlacementPhase = 'searching'
  private blockedBy: BlockReason | null = null
  private spot: Spot | null = null
  private camera: Vec3 | null = null
  private lastHit: SurfaceHit | null = null
  private placed: { position: Vec3; yaw: number } | null = null
  private reported: PlacementSnapshot | null = null
  private lastDebugAt = -Infinity
  private stopped = false

  constructor(stage: ArStage, options: PlacementControllerOptions) {
    this.stage = stage
    this.options = options
    const { x, z } = stage.dogSize
    this.ringRadius = Math.max(x, z) / 2
    this.spotCheck = new SpotCheck((rays) => stage.createProbes(rays), stage.dogSize)
  }

  start() {
    this.stage.hideDog()
    this.stage.start(
      (frame) => this.onFrame(frame),
      (reason) => {
        if (!this.stopped) this.options.onUnavailable(reason)
      },
    )
    this.report()
  }

  /** 화면 탭. 놓을 수 있을 때만 놓고 true. force 면 빨간 원(막힘)에서도 원 자리에 놓는다 (디버그 확인용) */
  place({ force = false }: { force?: boolean } = {}): boolean {
    const { spot } = this
    const floorY = this.floor.y
    const allowed = this.phase === 'placeable' || (force && this.phase === 'blocked')
    if (this.stopped || !allowed || !spot || floorY === null) return false
    // 높은 면에서 강제로 놓으면 원이 있는 그 면 높이에 둔다
    const y = spot.level === 'raised' ? spot.center.y : floorY
    const position = { x: spot.center.x, y, z: spot.center.z }
    this.forced = this.phase === 'blocked'
    // 앞쪽이 휴대폰(바닥에 투영한 점)을 향하게. 놓은 뒤에는 다시 계산하지 않아 카메라를 따라 돌지 않는다
    const yaw = this.camera ? yawToward(position, this.camera) : 0
    this.stage.setRing(this.options.onDebug ? { center: position, radius: this.ringRadius, tone: 'marker' } : null)
    this.clearChecks()
    this.stage.placeDog(position, yaw)
    this.placed = { position, yaw }
    this.phase = 'placed'
    this.blockedBy = null
    this.report()
    return true
  }

  /** 다시 놓기: 개를 숨기고 원 모드로 돌아간다. 다시 놓으면 그때 휴대폰 위치를 바라본다 */
  replace() {
    if (this.stopped || this.phase !== 'placed') return
    this.stage.hideDog()
    this.stage.setRing(null)
    this.placed = null
    this.spot = null
    this.phase = 'searching'
    this.report()
  }

  /** 끝낸다. 개를 다시 보이고 원을 지운다 */
  dispose() {
    if (this.stopped) return
    this.stopped = true
    this.spotCheck.idle()
    this.stage.dispose()
  }

  private onFrame(frame: StageFrame) {
    if (this.stopped) return
    this.camera = frame.camera
    this.lastHit = frame.centerHit
    if (this.phase !== 'placed') this.track(frame)
    this.debug(frame)
  }

  private track(frame: StageFrame) {
    const { time, centerHit } = frame
    // 수평면만 쓴다. 벽 등을 맞히면 놓친 것과 같다
    if (centerHit && isHorizontal(centerHit.normal)) {
      this.floor.observe(centerHit)
      this.spot = { center: centerHit.position, level: this.floor.levelOf(centerHit.position.y), seenAt: time }
      // hit-test 는 인식한 면만 맞힌다. 그 바닥이 실제로 처음 닿는 면인지 본다
      this.occlusion = this.centerOcclusion.update({
        time,
        camera: frame.camera,
        view: frame.view,
        floorHit: centerHit.position,
        depth: frame.depth,
        pointHit: frame.centerPointHit?.position ?? null,
        sensors: frame.sensors,
      })
    } else if (this.spot && time - this.spot.seenAt > LOST_GRACE_MS) {
      this.spot = null
      this.occlusion = null
      this.centerOcclusion.reset()
    }

    const floorY = this.floor.y
    if (this.spot?.level === 'floor' && floorY !== null) {
      const { center } = this.spot
      this.spotReport = this.spotCheck.update(center, floorY)
      const depth =
        frame.sensors.depth === 'on'
          ? samplePerimeterDepth(center, floorY, this.spotCheck.radius, frame.camera, frame.view, frame.depth)
          : null
      this.perimeter = this.perimeterVote.update(center, this.spotReport.fresh ? this.spotReport.directions : null, depth)
    } else {
      this.spotCheck.idle()
      this.perimeterVote.reset()
      this.spotReport = null
      this.perimeter = null
    }

    const raised = this.spot?.level === 'raised'
    const occluded = !!this.spot && !!this.occlusion?.occluded
    const obstacle = !!this.perimeter?.blocked
    if (this.options.onDebug) {
      if (raised) this.blockStats.add(time, 'raised')
      if (occluded) this.blockStats.add(time, 'occluded')
      if (obstacle) this.blockStats.add(time, 'obstacle')
    }
    const blockedBy: BlockReason | null = !this.spot
      ? null
      : raised
        ? 'raised'
        : occluded
          ? 'occluded'
          : obstacle
            ? 'obstacle'
            : null
    const phase: PlacementPhase = !this.spot ? 'searching' : blockedBy ? 'blocked' : 'placeable'
    this.stage.setRing(
      this.spot && { center: this.spot.center, radius: this.ringRadius, tone: phase === 'placeable' ? 'ok' : 'blocked' },
    )
    this.phase = phase
    this.blockedBy = blockedBy
    this.report()
  }

  /** 놓았을 때: 검사를 멈추고 기록을 버린다 */
  private clearChecks() {
    this.spotCheck.idle()
    this.perimeterVote.reset()
    this.centerOcclusion.reset()
    this.blockStats.clear()
    this.spotReport = null
    this.perimeter = null
    this.occlusion = null
  }

  private report() {
    const snapshot: PlacementSnapshot = {
      phase: this.phase,
      floorKnown: this.floor.y !== null,
      blockedBy: this.blockedBy,
    }
    const last = this.reported
    if (
      last &&
      last.phase === snapshot.phase &&
      last.floorKnown === snapshot.floorKnown &&
      last.blockedBy === snapshot.blockedBy
    ) {
      return
    }
    this.reported = snapshot
    this.options.onChange(snapshot)
  }

  private debug({ time, camera, sensors, centerPointHit }: StageFrame) {
    const { onDebug } = this.options
    if (!onDebug || time - this.lastDebugAt < DEBUG_INTERVAL_MS) return
    this.lastDebugAt = time
    const hit = this.lastHit
    const occlusion = this.occlusion
    const size = this.stage.dogSize
    const lines = [
      `센서 깊이 ${sensors.depth}${sensors.depthFormat ? ` (${sensors.depthFormat})` : ''} · 특징점 ${sensors.points}`,
      `개 ${meters(size.x)}×${meters(size.y)}×${meters(size.z)} · 원 r ${meters(this.ringRadius)} · 둘레 r ${meters(this.spotCheck.radius)}`,
      `바닥 ${meters(this.floor.y)} · 맞은 점 ${hit ? `${meters(hit.position.y)} (위 ${hit.normal.y.toFixed(2)})` : '없음'}`,
      `판정 ${this.phase}${this.blockedBy ? ` (${this.blockedBy})` : ''}${this.spot ? ` · ${this.spot.level}` : ''}`,
    ]
    if (this.placed) {
      const { position, yaw } = this.placed
      const foot = this.stage.dogFootCenter()
      lines.push(
        `${this.forced ? '강제로 놓음 · ' : ''}yaw ${degrees(yaw)}° · 지금 폰 쪽 ${degrees(yawToward(position, camera))}° · 발밑-원 ${foot ? `${(distanceXZ(foot, position) * 100).toFixed(1)}cm` : '?'}`,
      )
    } else {
      const stats = this.blockStats.counts(time)
      lines.push(
        `최근 3초 막힌 프레임: 가운데 가림 ${stats.occluded} · 둘레 장애물 ${stats.obstacle} · 높은 면 ${stats.raised}`,
        `거리 바닥 hit ${meters(hit ? distance(camera, hit.position) : null)} · 특징점 hit ${meters(centerPointHit ? distance(camera, centerPointHit.position) : null)}`,
        `가운데 ${describeOcclusion(occlusion)}`,
        `둘레 광선 ${describeSpot(this.spotReport)} · 확정 ${this.perimeter ? `${this.perimeter.confirmed}/8` : '-'}`,
        ...describeDirections(this.perimeter),
      )
    }
    onDebug(lines)
  }
}

const distance = (a: Vec3, b: Vec3) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z)
const meters = (value: number | null) => (value === null ? '-' : value.toFixed(2))
const signed = (value: number) => `${value >= 0 ? '+' : ''}${value.toFixed(2)}`
const degrees = (radians: number) => Math.round((radians * 180) / Math.PI)

const BASIS_LABEL = { depth: '깊이', points: '특징점', none: '판정 안 함' } as const

function describeOcclusion(result: OcclusionResult | null) {
  if (!result) return '-'
  if (result.basis === 'none') return '근거 없음 (깊이·특징점 둘 다 못 씀) → 막지 않음'
  const verdict = result.occluded ? '가림' : '안 가림'
  const measuredLabel = result.basis === 'depth' ? '실제(축)' : '특징점'
  const floorLabel = result.basis === 'depth' ? '바닥(축)' : '바닥(광선)'
  const detail = result.gap === null ? '' : ` · 차이 ${signed(result.gap)} / 여유 ${meters(result.margin)}`
  return `근거 ${BASIS_LABEL[result.basis]} → ${verdict} · ${measuredLabel} ${meters(result.measured)} · ${floorLabel} ${meters(result.floorDistance)}${detail}`
}

function describeSpot(report: SpotReport | null) {
  if (!report) return '안 함'
  if (report.unavailable) return '못 함'
  if (!report.fresh) return '만드는 중'
  return `빈 곳 ${report.clear}·장애물 ${report.obstacles}·모름 ${report.unknown}`
}

const STATE_LABEL = { floor: '바닥', obstacle: '장애물', unknown: '모름' } as const
const REASON_LABEL = { offscreen: '화면 밖', feet: '발밑', close: '가까움', nodata: '값 없음' } as const

/**
 * 둘레 8곳: 번호:합친 상태, 깊이 차이(실제 − 둘레 점)와 깊이가 모름인 까닭, 광선이 장애물이면 '광선',
 * 장애물이 이어진 프레임 수. 두 줄. 예) 3:바닥 깊이-1.83 가까움 · 2:장애물 깊이-0.30 ×4
 */
function describeDirections(report: PerimeterReport | null): string[] {
  if (!report) return ['둘레 방향 -']
  const one = (direction: DirectionReport, index: number) => {
    const parts = [`${index}:${STATE_LABEL[direction.state]}`]
    if (direction.gap !== null || direction.reason) {
      parts.push(`깊이${direction.gap !== null ? signed(direction.gap) : ''}${direction.reason ? ` ${REASON_LABEL[direction.reason]}` : ''}`)
    }
    if (direction.probe === 'blocked') parts.push('광선')
    if (direction.streak > 0) parts.push(`×${direction.streak}`)
    return parts.join(' ')
  }
  const items = report.directions.map(one)
  const half = Math.ceil(items.length / 2)
  return [`둘레 ${items.slice(0, half).join(' · ')}`, `둘레 ${items.slice(half).join(' · ')}`]
}
