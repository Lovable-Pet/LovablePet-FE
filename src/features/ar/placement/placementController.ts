import type { ArStage, RingMark, StageFrame, StageSensors } from './arStage'
import { DepthCalibration, type CalibrationReport } from './depthCalibration'
import { yawToward } from './facing'
import {
  FLOOR_SWITCH_HOLD_MS,
  FloorEstimate,
  floorHitUse,
  hitGeometry,
  isHorizontal,
  type FloorStatus,
  type SurfaceLevel,
} from './floorEstimate'
import { INNER_RING_FRACTIONS, InnerVote, innerSlot, sampleInnerDepth, type InnerReport } from './innerDepth'
import { CenterOcclusion, centerDepthRatio, floorGridRatios, samplePerimeterDepth, type OcclusionResult } from './occlusion'
import { PerimeterVote, type DirectionReport, type PerimeterReport } from './perimeterVote'
import { READY_DEPTH_TIMEOUT_MS, READY_MOVE_M, READY_TRACKING_MS, Readiness, type ReadinessReport } from './readiness'
import { SpotCheck, type SpotReport } from './spotCheck'
import { distanceXZ, type SurfaceHit, type Vec3 } from './types'
import { viewForward } from './viewProjection'

/**
 * preparing: 준비 단계 (휴대폰을 좌우로 움직여 추적·바닥·깊이를 맞추는 중, 원 숨김) ·
 * searching: 바닥 못 찾음 (원 숨김) · placeable: 놓을 수 있음 · blocked: 놓을 수 없음 · placed: 놓았음
 */
export type PlacementPhase = 'preparing' | 'searching' | 'placeable' | 'blocked' | 'placed'

/**
 * moveSteps: 원 단계에서 깊이가 3초 넘게 안 맞음 → 한두 걸음 옆으로 움직이라는 안내 ·
 * tiltDown: 준비 단계에서 추적·이동은 됐는데 바닥이 2초 넘게 안 보임 (벽·옷만 비춤) → 아래로 기울이라는 안내
 */
export type PlacementNotice = 'moveSteps' | 'tiltDown'

/** 원 단계에서 깊이 안 맞음이 이만큼(ms) 이어지면 옆으로 움직이라고 안내한다 */
export const DEPTH_DRIFT_NOTICE_MS = 3000
/** 준비 단계에서 추적·이동이 된 뒤 바닥(가운데 광선이 맞은 바닥 높이의 수평면)이 이만큼(ms) 넘게 안 보이면 아래로 기울이라고 안내한다 */
export const FLOOR_UNSEEN_NOTICE_MS = 2000

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
  /** 안내를 바꿔 보일 때 */
  notice: PlacementNotice | null
}

export interface PlacementControllerOptions {
  /** 상태가 바뀔 때만 부른다 */
  onChange(snapshot: PlacementSnapshot): void
  /** hit-test 를 쓸 수 없어 직접 놓기를 못 할 때 */
  onUnavailable(reason: string): void
  /** 디버그 글. 주면 놓은 자리에 표시 원도 남긴다 (발밑 가운데가 원 중심에 오는지 보려고) */
  onDebug?(debug: PlacementDebug): void
}

export interface PlacementDebug {
  /** 한 줄 요약: 판정과 바닥 높이 (debug 상자를 접었을 때) */
  summary: string
  lines: string[]
}

/** 가운데 광선이 바닥을 놓쳐도 이만큼(ms)은 원을 그대로 둔다. 한두 프레임 놓칠 때 깜빡이지 않게 */
const LOST_GRACE_MS = 250
/** 디버그 글을 고치는 간격 (ms) */
const DEBUG_INTERVAL_MS = 200
/** 디버그: 막힌 근거를 이만큼(ms) 동안 센다 */
const DEBUG_STATS_MS = 3000

/** 디버그 통계 근거. inner: 원 안쪽 깊이 표본 (판정은 obstacle 로 낸다) */
type StatReason = BlockReason | 'inner'

/** 디버그: 최근 몇 초 동안 근거마다 막힌 프레임 수 */
class RecentCounts {
  private readonly windowMs: number
  private readonly events: { time: number; reason: StatReason }[] = []

  constructor(windowMs: number) {
    this.windowMs = windowMs
  }

  add(time: number, reason: StatReason) {
    this.events.push({ time, reason })
  }

  counts(now: number): Record<StatReason, number> {
    while (this.events.length && now - this.events[0].time > this.windowMs) this.events.shift()
    const counts: Record<StatReason, number> = { occluded: 0, obstacle: 0, inner: 0, raised: 0 }
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
  /** floor 또는 raised (lower 는 원 자리로 쓰지 않는다) */
  level: SurfaceLevel
  seenAt: number
}

/**
 * AR 배치 흐름. 렌더러는 ArStage 로만 만진다.
 * 1. 개를 숨기고, 매 프레임 화면 가운데 광선이 맞은 수평면에 원을 눕힌다. 놓을 수 없는 때:
 *    - 바닥 층보다 8cm 넘게 높은 면 (6cm 아래로 와야 풀림)
 *    - 바닥 hit 앞에 실제 물체가 있음 (CenterOcclusion: 깊이 센서 → 특징점 → 판정 안 함)
 *      깊이는 DepthCalibration 이 맞음으로 본 동안만 쓴다 (화면 전체가 같은 비율로 어긋나면 특징점으로 대신)
 *    - 둘레에 장애물이 확인됨 (SpotCheck 광선 + samplePerimeterDepth 깊이 → PerimeterVote: 3프레임 연속 2곳 이상, 또는 한 곳 10프레임 연속)
 *    - 원 안쪽에 장애물이 확인됨 (깊이를 믿을 때만, 세 겹 × 2cm 간격 방향 → InnerVote: 이웃 2개 이상 5프레임 연속, 또는 하나 10프레임 연속)
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
  private readonly calibration = new DepthCalibration()
  private calibrationReport: CalibrationReport | null = null
  /** 깊이 판정(가운데 가림·둘레 깊이 장애물)을 쓰는 중인지 */
  private depthTrusted = false
  private readonly blockStats = new RecentCounts(DEBUG_STATS_MS)
  private spotReport: SpotReport | null = null
  private occlusion: OcclusionResult | null = null
  private perimeter: PerimeterReport | null = null
  private readonly innerVote: InnerVote
  /** 원 안쪽 깊이 검사 결과. 깊이를 못 믿거나 원이 없으면 null */
  private inner: InnerReport | null = null
  private forced = false
  private phase: PlacementPhase = 'preparing'
  private notice: PlacementNotice | null = null
  private readonly readiness = new Readiness()
  private readinessReport: ReadinessReport | null = null
  private blockedBy: BlockReason | null = null
  private spot: Spot | null = null
  private camera: Vec3 | null = null
  private lastHit: SurfaceHit | null = null
  /** 마지막 가운데 hit 이 바닥에 견줘 어디인지 (수평면이 아니면 null) */
  private lastLevel: SurfaceLevel | null = null
  /** 마지막 프레임 시각 (ms) */
  private lastTime = 0
  /** 가운데 광선이 바닥에 마지막으로 맞은 시각 (ms). 첫 프레임부터 센다 */
  private floorSeenAt: number | null = null
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
    this.innerVote = new InnerVote(this.spotCheck.radius)
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
    const allowed = this.phase === 'placeable' || (force && this.phase === 'blocked')
    const y = spot && this.surfaceY(spot)
    if (this.stopped || !allowed || !spot || y === null) return false
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

  /**
   * 다시 놓기: 개를 숨기고 원 모드로 돌아간다. 다시 놓으면 그때 휴대폰 위치를 바라본다.
   * 최근 3초 안에 다시 보지 못한 바닥 후보는 정리한다 (좌표가 어긋나 남은 옛 바닥 높이)
   */
  replace() {
    if (this.stopped || this.phase !== 'placed') return
    this.stage.hideDog()
    this.stage.setRing(null)
    this.floor.prune(this.lastTime)
    this.placed = null
    this.spot = null
    this.phase = 'searching'
    this.report()
  }

  /** 바닥 다시 찾기 (디버그): 바닥 추정을 처음부터. 놓기 전이면 원 모드도 처음부터 */
  resetFloor() {
    if (this.stopped) return
    this.floor.reset()
    if (this.phase === 'placed') return
    this.spot = null
    this.lastLevel = null
    this.clearChecks()
    this.stage.setRing(null)
    this.phase = 'searching'
    this.blockedBy = null
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
    this.lastTime = frame.time
    // 놓은 뒤에도 바닥 추정은 이어 간다 (다시 놓을 때 쓴다)
    this.floor.update(frame.time, frame.centerHit, frame.camera)
    if (this.phase !== 'placed') this.track(frame)
    this.debug(frame)
  }

  private track(frame: StageFrame) {
    const { time, centerHit } = frame
    // 수평면만 쓴다. 벽 등을 맞히면 놓친 것과 같다.
    // 확정된 바닥 층보다 8cm 넘게 낮은 면도 놓친 것으로 본다: 광택 바닥의 반사로 잠깐 잡힌 가짜 면이면 원이 그대로 있고,
    // 정말 더 낮은 바닥(좌표가 내려앉음, 책상을 먼저 본 경우)이면 바닥 추정이 그 높이로 바뀔 때(약 2초)까지 '바닥 찾는 중'이다.
    // 믿을 수 없는 높이에 개를 놓지 않는다
    const level = centerHit && isHorizontal(centerHit.normal) ? this.floor.classify(centerHit.position.y) : null
    this.lastLevel = level
    const freshHit = centerHit && level !== null && level !== 'lower' ? centerHit : null
    if (this.floorSeenAt === null || (freshHit && level === 'floor')) this.floorSeenAt = time
    if (freshHit && level) {
      this.spot = { center: freshHit.position, level, seenAt: time }
    } else if (this.spot && time - this.spot.seenAt > LOST_GRACE_MS) {
      this.spot = null
      this.occlusion = null
      this.centerOcclusion.reset()
    }

    const floorY = this.spot && this.spot.level !== 'raised' ? this.surfaceY(this.spot) : null
    const depthOn = frame.sensors.depth === 'on'
    // 둘레 깊이: 둘레 장애물 판정과 깊이 보정 검사 둘 다에 쓴다
    const perimeterDepth =
      this.spot && floorY !== null && depthOn
        ? samplePerimeterDepth(this.spot.center, floorY, this.spotCheck.radius, frame.camera, frame.view, frame.depth)
        : null

    // 깊이 보정 검사: 가운데가 확정 바닥 층에 맞았을 때 r = 깊이 / 바닥 hit 을 모은다
    const onFloorLayer = freshHit !== null && level === 'floor' && !this.floor.provisional
    this.calibrationReport = depthOn
      ? this.calibration.update({
          time,
          centerRatio: onFloorLayer ? centerDepthRatio(freshHit.position, frame.view, frame.depth) : null,
          perimeterRatios: perimeterDepth?.map((sample) => sample.ratio) ?? [],
          gridRatios: onFloorLayer && floorY !== null ? floorGridRatios(frame.camera, floorY, frame.view, frame.depth) : [],
          pointRatio:
            onFloorLayer && frame.centerPointHit
              ? distance(frame.camera, frame.centerPointHit.position) / distance(frame.camera, freshHit.position)
              : null,
        })
      : null
    const depthTrusted = depthOn && this.calibrationReport?.state === 'ok'
    if (depthTrusted !== this.depthTrusted) {
      // 깊이를 쓰다 말다 할 때 옛 기록을 버린다
      this.depthTrusted = depthTrusted
      this.centerOcclusion.reset()
      this.perimeterVote.reset()
      this.innerVote.reset()
    }

    // hit-test 는 인식한 면만 맞힌다. 그 바닥이 실제로 처음 닿는 면인지 본다
    if (freshHit) {
      this.occlusion = this.centerOcclusion.update({
        time,
        camera: frame.camera,
        view: frame.view,
        floorHit: freshHit.position,
        depth: frame.depth,
        pointHit: frame.centerPointHit?.position ?? null,
        sensors: frame.sensors,
        depthTrusted,
      })
    }

    if (this.spot && floorY !== null) {
      const { center } = this.spot
      this.spotReport = this.spotCheck.update(center, floorY)
      this.perimeter = this.perimeterVote.update(
        center,
        this.spotReport.fresh ? this.spotReport.directions : null,
        depthTrusted ? perimeterDepth : null,
      )
    } else {
      this.spotCheck.idle()
      this.perimeterVote.reset()
      this.spotReport = null
      this.perimeter = null
    }
    // 원 안쪽: 가는 기둥(책상 다리)이 둘레 점 사이로 빠지지 않게 촘촘하게 본다. 깊이를 믿을 때만
    if (depthTrusted && this.spot && floorY !== null) {
      const samples = sampleInnerDepth(
        this.spot.center,
        floorY,
        this.spotCheck.radius,
        frame.camera,
        frame.view,
        frame.depth,
        this.calibrationReport?.ratio ?? null,
      )
      this.inner = this.innerVote.update(this.spot.center, samples)
    } else {
      this.innerVote.reset()
      this.inner = null
    }

    const raised = this.spot?.level === 'raised'
    const occluded = !!this.spot && !!this.occlusion?.occluded
    const innerBlocked = !!this.inner?.blocked
    const obstacle = !!this.perimeter?.blocked || innerBlocked
    if (this.options.onDebug) {
      if (raised) this.blockStats.add(time, 'raised')
      if (occluded) this.blockStats.add(time, 'occluded')
      if (this.perimeter?.blocked) this.blockStats.add(time, 'obstacle')
      if (innerBlocked) this.blockStats.add(time, 'inner')
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
    // 준비 단계: 추적·이동·바닥 층·깊이 보정이 될 때까지 원을 보이지 않는다
    const readiness = this.readiness.update({
      time,
      tracking: frame.tracking,
      camera: frame.camera,
      forward: viewForward(frame.view),
      floorConfirmed: this.floor.y !== null && !this.floor.provisional,
      depthSensor: depthOn,
      depthOk: this.calibrationReport?.state === 'ok',
    })
    this.readinessReport = readiness
    if (!readiness.ready) {
      this.stage.setRing(null)
      // 추적·이동은 됐는데 바닥 층이 없으면 지금의 '바닥 못 찾음' 안내
      this.phase = readiness.moving && !readiness.floor ? 'searching' : 'preparing'
      this.blockedBy = null
      // 추적·이동은 됐는데 바닥이 2초 넘게 안 보이면 (벽·옷만 비추는 중) 아래로 기울이라고 안내한다
      const floorUnseen = this.floorSeenAt !== null && time - this.floorSeenAt > FLOOR_UNSEEN_NOTICE_MS
      this.notice = readiness.moving && floorUnseen ? 'tiltDown' : null
      this.report()
      return
    }

    const phase: PlacementPhase = !this.spot ? 'searching' : blockedBy ? 'blocked' : 'placeable'
    this.stage.setRing(
      this.spot && {
        center: this.spot.center,
        radius: this.ringRadius,
        tone: phase === 'placeable' ? 'ok' : 'blocked',
        marks: this.options.onDebug ? innerMarks(this.inner) : undefined,
      },
    )
    this.phase = phase
    this.blockedBy = blockedBy
    // 원 단계에서 깊이가 3초 넘게 안 맞으면 한두 걸음 옆으로 움직이라고 안내한다 (판정은 이미 특징점으로 내려가 있다)
    const drifting = this.calibrationReport?.state === 'bad' && this.calibrationReport.stateMs >= DEPTH_DRIFT_NOTICE_MS
    this.notice = drifting ? 'moveSteps' : null
    this.report()
  }

  /**
   * 원 자리의 바닥 높이. 바닥이면 바닥 추정값(러그 몇 cm 는 바닥에 맞춘다), 높은 면(강제로 놓을 때)은 그 면 높이.
   * 바닥보다 낮은 면은 원 자리로 쓰지 않아 여기에 오지 않는다
   */
  private surfaceY(spot: Spot): number | null {
    return spot.level === 'floor' ? this.floor.y : spot.center.y
  }

  /** 놓았을 때: 검사를 멈추고 기록을 버린다 */
  private clearChecks() {
    this.spotCheck.idle()
    this.perimeterVote.reset()
    this.innerVote.reset()
    this.inner = null
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
      notice: this.notice,
    }
    const last = this.reported
    if (
      last &&
      last.phase === snapshot.phase &&
      last.floorKnown === snapshot.floorKnown &&
      last.blockedBy === snapshot.blockedBy &&
      last.notice === snapshot.notice
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
      `깊이 보정 ${describeCalibration(this.calibrationReport, sensors)}`,
      `준비 ${describeReadiness(this.readinessReport)}${describeFloorUnseen(this.floorSeenAt, time)}`,
      `개 ${meters(size.x)}×${meters(size.y)}×${meters(size.z)} · 원 r ${meters(this.ringRadius)} · 둘레 r ${meters(this.spotCheck.radius)}`,
      `바닥 ${describeFloor(this.floor.status(), time)}`,
      `맞은 점 ${hit ? `${height(hit.position.y)} (위 ${hit.normal.y.toFixed(2)}) · ${describeHitUse(hit, camera)}` : '없음'}`,
      `바닥 층 ${describeLayers(this.floor.status(), time)}`,
      `${describeRaisedLine(this.floor.status())} · 높이 분포 ${describeBins(this.floor.status())}`,
      `판정 ${this.phase}${this.blockedBy ? ` (${this.blockedBy})` : ''} · 맞은 면 ${this.lastLevel ?? '-'}${this.lastLevel === 'lower' ? ' (바닥보다 낮아 무시)' : ''}`,
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
        `최근 3초 막힌 프레임: 가운데 가림 ${stats.occluded} · 둘레 장애물 ${stats.obstacle} · 안쪽 장애물 ${stats.inner} · 높은 면 ${stats.raised}`,
        `거리 바닥 hit ${meters(hit ? distance(camera, hit.position) : null)} · 특징점 hit ${meters(centerPointHit ? distance(camera, centerPointHit.position) : null)}`,
        `가운데 ${describeOcclusion(occlusion)}`,
        `둘레 광선 ${describeSpot(this.spotReport)} · 확정 ${this.perimeter ? `${this.perimeter.confirmed}/8 · 지속 ${this.perimeter.persistent}` : '-'}`,
        ...describeDirections(this.perimeter),
        ...describeInner(this.inner),
      )
    }
    const floorY = this.floor.y
    const summary = `${this.phase}${this.blockedBy ? ` (${this.blockedBy})` : ''} · 바닥 ${floorY === null ? '-' : height(floorY)}${this.floor.provisional ? ' 임시' : ''}`
    onDebug({ summary, lines })
  }
}

const distance = (a: Vec3, b: Vec3) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z)
const meters = (value: number | null) => (value === null ? '-' : value.toFixed(2))
const height = (value: number) => value.toFixed(3)
const secondsAgo = (now: number, then: number) => ((now - then) / 1000).toFixed(1)

/** 바닥 추정값이 어떻게 정해졌는지: 높이, hit 수, 가로 퍼짐, 처음·마지막으로 본 시각, 바꿀 후보 */
function describeFloor(status: FloorStatus, now: number) {
  if (status.y === null) return '- (아직 수평면 없음)'
  if (status.provisional || !status.layer) return `${height(status.y)} (임시: 후보 없음, 지금 맞은 수평면)`
  const { layer, pending } = status
  const next = pending
    ? ` · 바꿀 층 ${height(pending.layer.y)} ${(pending.heldMs / 1000).toFixed(1)}/${(FLOOR_SWITCH_HOLD_MS / 1000).toFixed(1)}초`
    : ''
  return `${height(layer.y)} (층 · 최근 2.5초 중앙값 · 칸 ${layer.bins.length}개 · hit ${layer.hits} · 처음 ${secondsAgo(now, layer.firstSeen)}초 전 · 마지막 ${secondsAgo(now, layer.lastSeen)}초 전)${next}`
}

/** 바닥 층 목록 (낮은 것부터): 층 높이 [묶인 칸 높이] 마지막으로 본 때. ★ 지금 바닥 */
function describeLayers(status: FloorStatus, now: number) {
  if (!status.layers.length) return '-'
  return status.layers
    .map(
      (layer) =>
        `${height(layer.y)}[${layer.bins.map((bin) => height(bin.y)).join(',')}] 퍼짐 ${layer.spread.toFixed(1)}m ${secondsAgo(now, layer.lastSeen)}초 전${layer === status.layer ? '★' : ''}`,
    )
    .join(' · ')
}

/** raised 기준선: 바닥 층 + 8cm 를 넘으면 raised, + 6cm 아래로 와야 풀림 */
function describeRaisedLine(status: FloorStatus) {
  if (!status.raised) return 'raised 기준 - (임시 바닥)'
  const { enterY, exitY, latched } = status.raised
  return `raised 기준 >${height(enterY)} · 풀림 <${height(exitY)} · 지금 ${latched ? 'raised' : '아님'}`
}

/** 지금 가운데 hit 을 바닥 추정에 썼는지, 안 썼으면 왜 */
function describeHitUse(hit: SurfaceHit, camera: Vec3) {
  const use = floorHitUse(hit, camera)
  if (use === 'used') return '추정에 씀'
  if (use === 'notHorizontal') return '수평면 아님'
  const { distance, grazingDeg } = hitGeometry(hit, camera)
  if (use === 'far') return `추정 안 씀: 멀다 ${distance.toFixed(1)}m`
  return `추정 안 씀: 비스듬하다 ${Math.round(grazingDeg)}°`
}

/** 높이별(2cm 칸) 수평 hit 수 위 3개. ✓ 바닥 후보 조건을 채움 · ★ 지금 바닥 층에 묶임 */
function describeBins(status: FloorStatus) {
  if (!status.top.length) return '-'
  const inFloor = new Set(status.layer?.bins.map((bin) => bin.key))
  return status.top
    .map((bin) => `${height(bin.y)}:${bin.hits}${bin.candidate ? '✓' : ''}${inFloor.has(bin.key) ? '★' : ''}`)
    .join(' · ')
}
const signed = (value: number) => `${value >= 0 ? '+' : ''}${value.toFixed(2)}`
const degrees = (radians: number) => Math.round((radians * 180) / Math.PI)

const BASIS_LABEL = { depth: '깊이', points: '특징점', none: '판정 안 함' } as const

const mark = (ok: boolean) => (ok ? '됨' : '안 됨')

/** 준비 조건: a 추적 1.2s 됨 · b 이동 0.24/0.30m 안 됨 · c 바닥 층 됨 · d 깊이 보정 기다림 5.1/8s */
function describeReadiness(report: ReadinessReport | null) {
  if (!report) return '-'
  const depth = {
    ok: '됨',
    skipped: '건너뜀 (깊이 센서 없음)',
    timeout: '8초 지나 깊이 없이 진행',
    waiting: `안 됨 ${(report.elapsedMs / 1000).toFixed(1)}/${READY_DEPTH_TIMEOUT_MS / 1000}s`,
  }[report.depth]
  const head = report.ready ? '끝 · ' : ''
  return (
    `${head}a 추적 ${(report.trackingMs / 1000).toFixed(1)}s ${mark(report.trackingMs >= READY_TRACKING_MS)}` +
    ` · b 이동 ${report.moved.toFixed(2)}/${READY_MOVE_M.toFixed(2)}m ${mark(report.moved >= READY_MOVE_M)}` +
    ` · c 바닥 층 ${mark(report.floor)} · d 깊이 보정 ${depth}`
  )
}

/** 디버그 점: 이번 프레임 장애물인 원 안쪽 표본 (막는 데 센 표본은 진하게) */
function innerMarks(report: InnerReport | null): RingMark[] {
  if (!report) return []
  return report.samples
    .filter((sample) => sample.state === 'obstacle')
    .map((sample) => ({ position: sample.position, strong: sample.counted }))
}

/** 디버그 표본 자리 이름: 겹(반지름 비율)과 시계 방향 (12시 = 원 너머, 6시 = 휴대폰 쪽, 3시 = 오른쪽) */
function innerSlotLabel(index: number, directions: number) {
  const { ring, direction } = innerSlot(index, directions)
  const hour = Math.round((direction / directions) * 12) || 12
  return `${INNER_RING_FRACTIONS[ring].toFixed(2)}r ${hour}시`
}

/** 디버그 걸린 표본을 이만큼까지 적는다 */
const INNER_LIST_MAX = 6

/**
 * 원 안쪽 두 줄. 예)
 * 안쪽 장애물 표본 4/261 (87방향) · 이웃 5f 3 · 혼자 10f 0 → 막음
 * 안쪽 걸림 0.70r 12시 ×7★ · 1.00r 12시 ×7★ · 1.00r 1시 ×2
 */
function describeInner(report: InnerReport | null): string[] {
  if (!report) return ['안쪽 안 함 (깊이 보정이 맞음일 때만 본다)']
  const total = INNER_RING_FRACTIONS.length * report.directions
  const hits = report.samples
    .map((sample, index) => ({ sample, index }))
    .filter(({ sample }) => sample.state === 'obstacle')
    .sort((a, b) => b.sample.streak - a.sample.streak)
  const list = hits
    .slice(0, INNER_LIST_MAX)
    .map(({ sample, index }) => `${innerSlotLabel(index, report.directions)} ×${sample.streak}${sample.counted ? '★' : ''}`)
  const more = hits.length > INNER_LIST_MAX ? ` 외 ${hits.length - INNER_LIST_MAX}` : ''
  return [
    `안쪽 장애물 표본 ${report.obstacles}/${total} (${report.directions}방향) · 이웃 5f ${report.clustered} · 혼자 10f ${report.persistent}${report.blocked ? ' → 막음' : ''}`,
    `안쪽 걸림 ${list.length ? list.join(' · ') + more : '-'}`,
  ]
}

/** 준비 줄 끝: 바닥이 0.5초 넘게 안 보이면 그 시간 (2초 넘으면 아래로 기울이라는 안내가 나온다) */
function describeFloorUnseen(floorSeenAt: number | null, now: number) {
  if (floorSeenAt === null || now - floorSeenAt < 500) return ''
  return ` · 바닥 안 보임 ${((now - floorSeenAt) / 1000).toFixed(1)}/${FLOOR_UNSEEN_NOTICE_MS / 1000}s`
}

/** 깊이 보정: r=0.74 (안 맞음 → 특징점 사용) · 둘레 같이 어긋남 7/8 · 특징점 일치 · 2.3초째 */
function describeCalibration(report: CalibrationReport | null, sensors: StageSensors) {
  if (sensors.depth !== 'on' || !report) return '깊이 센서 없음 → 특징점 사용'
  const verdict = report.state === 'ok' ? '맞음 → 깊이 사용' : report.state === 'bad' ? '안 맞음 → 특징점 사용' : '아직 모름 → 특징점 사용'
  const point = report.pointAgree === null ? '특징점 없음' : report.pointAgree ? '특징점 일치' : '특징점 불일치'
  return `r=${report.ratio === null ? '-' : report.ratio.toFixed(2)} (${verdict}) · 둘레 같이 어긋남 ${report.similar ?? '-'}/8 · 화면 ${report.gridSimilar === null ? '-' : `${Math.round(report.gridSimilar * 100)}%`} · ${point} · ${(report.stateMs / 1000).toFixed(1)}초째`
}

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
