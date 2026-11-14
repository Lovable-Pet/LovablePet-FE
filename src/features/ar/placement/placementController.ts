import type { ArStage, StageFrame } from './arStage'
import { yawToward } from './facing'
import { FloorEstimate, isHorizontal, type SurfaceLevel } from './floorEstimate'
import { distanceXZ, type SurfaceHit, type Vec3 } from './types'

/**
 * searching: 바닥 못 찾음 (원 숨김) · placeable: 놓을 수 있음 · blocked: 놓을 수 없음 · placed: 놓았음
 */
export type PlacementPhase = 'searching' | 'placeable' | 'blocked' | 'placed'

export interface PlacementSnapshot {
  phase: PlacementPhase
  /** 바닥(수평면)을 한 번이라도 봤는지 */
  floorKnown: boolean
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

interface Spot {
  /** 원 중심 = 가운데 광선이 맞은 점 */
  center: Vec3
  level: SurfaceLevel
  seenAt: number
}

/**
 * AR 배치 흐름. 렌더러는 ArStage 로만 만진다.
 * 1. 개를 숨기고, 매 프레임 화면 가운데 광선이 맞은 수평면에 원을 눕힌다 (바닥보다 5cm 넘게 높으면 놓을 수 없음)
 * 2. place(): 놓을 수 있을 때만 원 중심·바닥 높이에 개를 놓고, 앞쪽이 휴대폰을 향하게 한다. 그 뒤 방향은 고정
 * 3. replace(): 개를 숨기고 1 로 돌아간다
 */
export class PlacementController {
  /** 원 반지름: 개 가로·세로 중 긴 쪽의 절반 (원 안에 개가 들어간다) */
  readonly ringRadius: number
  private readonly stage: ArStage
  private readonly options: PlacementControllerOptions
  private readonly floor = new FloorEstimate()
  private phase: PlacementPhase = 'searching'
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

  /** 화면 탭. 놓을 수 있을 때만 놓고 true */
  place(): boolean {
    const { spot } = this
    const floorY = this.floor.y
    if (this.stopped || this.phase !== 'placeable' || !spot || floorY === null) return false
    const position = { x: spot.center.x, y: floorY, z: spot.center.z }
    // 앞쪽이 휴대폰(바닥에 투영한 점)을 향하게. 놓은 뒤에는 다시 계산하지 않아 카메라를 따라 돌지 않는다
    const yaw = this.camera ? yawToward(position, this.camera) : 0
    this.stage.setRing(this.options.onDebug ? { center: position, radius: this.ringRadius, tone: 'marker' } : null)
    this.stage.placeDog(position, yaw)
    this.placed = { position, yaw }
    this.phase = 'placed'
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
    this.stage.dispose()
  }

  private onFrame(frame: StageFrame) {
    if (this.stopped) return
    this.camera = frame.camera
    this.lastHit = frame.centerHit
    if (this.phase !== 'placed') this.track(frame)
    this.debug(frame)
  }

  private track({ time, centerHit }: StageFrame) {
    // 수평면만 쓴다. 벽 등을 맞히면 놓친 것과 같다
    if (centerHit && isHorizontal(centerHit.normal)) {
      this.floor.observe(centerHit)
      this.spot = { center: centerHit.position, level: this.floor.levelOf(centerHit.position.y), seenAt: time }
    } else if (this.spot && time - this.spot.seenAt > LOST_GRACE_MS) {
      this.spot = null
    }
    const phase: PlacementPhase = !this.spot ? 'searching' : this.spot.level === 'raised' ? 'blocked' : 'placeable'
    this.stage.setRing(
      this.spot && { center: this.spot.center, radius: this.ringRadius, tone: phase === 'placeable' ? 'ok' : 'blocked' },
    )
    this.phase = phase
    this.report()
  }

  private report() {
    const snapshot: PlacementSnapshot = { phase: this.phase, floorKnown: this.floor.y !== null }
    const last = this.reported
    if (last && last.phase === snapshot.phase && last.floorKnown === snapshot.floorKnown) return
    this.reported = snapshot
    this.options.onChange(snapshot)
  }

  private debug({ time, camera }: StageFrame) {
    const { onDebug } = this.options
    if (!onDebug || time - this.lastDebugAt < DEBUG_INTERVAL_MS) return
    this.lastDebugAt = time
    const hit = this.lastHit
    const lines = [
      `바닥 ${meters(this.floor.y)} · 맞은 점 ${hit ? `${meters(hit.position.y)} (위 ${hit.normal.y.toFixed(2)})` : '없음'}`,
      `판정 ${this.phase}${this.spot ? ` · ${this.spot.level}` : ''} · 원 r ${this.ringRadius.toFixed(2)}`,
    ]
    if (this.placed) {
      const { position, yaw } = this.placed
      const foot = this.stage.dogFootCenter()
      lines.push(
        `yaw ${degrees(yaw)}° · 지금 폰 쪽 ${degrees(yawToward(position, camera))}° · 발밑-원 ${foot ? `${(distanceXZ(foot, position) * 100).toFixed(1)}cm` : '?'}`,
      )
    }
    onDebug(lines)
  }
}

const meters = (value: number | null) => (value === null ? '-' : value.toFixed(3))
const degrees = (radians: number) => Math.round((radians * 180) / Math.PI)
