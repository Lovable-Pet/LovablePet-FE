import type { StageFrame } from '../placement/arStage'
import type { Vec3 } from '../placement/types'
import { clipDistance, GaitClock } from './gait'
import { newTurnState, turnStep } from './steering'
import { Trail, type Vec2 } from './trail'
import type { AheadCheck, FloorLevel, WalkHost } from './walkStage'
import { walkSpec, type WalkClip, type WalkSpec } from './walkSpec'

/**
 * standing: 서 있음 (model-viewer 가 서기 루프를 돌린다) · start: walk_start · walk: walk 루프 · stop: walk_stop ·
 * turn: 출발 전 제자리 회전 클립 (나중 자리, 지금은 어댑터에 클립이 없어 오지 않는다)
 */
export type WalkPhase = 'standing' | 'turn' | 'start' | 'walk' | 'stop'

/** slowDown: 사용자가 3m 넘게 앞서감 → '천천히 걸어 주세요' */
export type WalkNotice = 'slowDown'

/** 멈춘 까닭. distance: D 에 맞춰 · ending: 산책 끝 · tracking: 추적 끊김 · ahead: 앞이 막힘 (4단계) */
export type StopReason = 'distance' | 'ending' | 'tracking' | 'ahead'

export interface WalkSnapshot {
  phase: WalkPhase
  /** 산책 끝을 눌러 멈추는 중 */
  ending: boolean
  notice: WalkNotice | null
}

/** 루프 끝에서 한 판단 */
export interface WalkDecision {
  /** 끝난 클립 */
  ended: WalkClip
  time: number
  /** 그때 남은 길 (m) */
  gap: number
  /** 사용자 속도 (길을 따라 멀어지는 쪽 +, m/s) */
  userSpeed: number
  /** 지금 멈추면 설 거리 (m, 사용자까지 길) */
  stopNow: number
  /** 한 바퀴 더 가고 멈추면 설 거리 (m) */
  oneMore: number
  /** 한 바퀴 더일 때 그 바퀴의 v/v0 */
  oneMoreK: number
  choice: 'stop' | 'walk'
  /** 한 바퀴 더인데 그 다음 루프 끝에서 멈출 것 같은지 (마지막 루프) */
  last: boolean
  reason: StopReason | null
}

/** 산책 한 번(출발 → 정지)의 결과 */
export interface WalkStopResult {
  time: number
  reason: StopReason
  /** 멈추기 시작할 때 예상한 거리 (m) */
  predicted: number
  /** 멈춘 뒤 사용자까지 길 (m) */
  gap: number
  /** 멈춘 뒤 사용자까지 직선 거리 (m) */
  straight: number
  /** gap − D */
  error: number
}

export interface WalkDebug {
  summary: string
  lines: string[]
  /** 가짜 스테이지·디버그용 값 */
  values: {
    phase: WalkPhase
    k: number
    timeScale: number
    gap: number
    straight: number
    userSpeed: number
    yawRate: number
    maxYawRate: number
    /** 크게 돌기 (방향 차이 90° 넘음: v/v0 0.6, 좁게 돈다) */
    bigTurn: boolean
    trailPoints: number
    /** 개 앞에 남은 발자취 점 */
    trail: readonly Vec2[]
    /** 개가 겨누는 점 */
    aim: Vec2 | null
    /** 개 중심이 발자취에서 벗어난 거리 (m): 지금, 산책 모드 동안 최대 */
    offTrail: number
    maxOffTrail: number
    decisions: readonly WalkDecision[]
    stops: readonly WalkStopResult[]
  }
}

export interface WalkControllerOptions {
  /** 상태가 바뀔 때만 */
  onChange(snapshot: WalkSnapshot): void
  /** 산책을 끝냈다 (산책 끝을 누른 뒤 멈추고 서기 루프로 돌아왔다) */
  onFinished(): void
  onDebug?(debug: WalkDebug): void
  /** 디버그 글 간격 (ms). 가짜 스테이지는 0 */
  debugIntervalMs?: number
  /** 4단계: 걷는 중 앞 바닥 검사. 없으면 보지 않는다 */
  ahead?: AheadCheck
}

/** v/v0 범위 (재생 배율과 이동 속도에 같이 곱한다) */
export const SPEED_RATIO_MIN = 0.6
export const SPEED_RATIO_MAX = 1.4
/** v/v0 가 초당 이만큼까지만 바뀐다 (걸음 빠르기가 툭 바뀌지 않게) */
export const SPEED_RATIO_RATE = 0.8
/** 남은 길이 D + 정지 거리보다 길면 이 시간(s) 안에 따라잡을 만큼 빨리 걷는다 */
export const CATCH_UP_S = 1.5
/** 서기 루프 지금 프레임에서 walk_start 로 섞는 시간 (s). 기존 명령(앉기 등)과 같다 */
export const STANDING_FADE_S = 0.3
/** 초당 최대 회전각 (°/s). 이것과 (속도 / 가장 좁게 도는 반지름) 중 작은 쪽 */
export const YAW_RATE_MAX_DEG = 100
/**
 * 크게 돌기: 겨누는 점까지 방향 차이가 BIG_TURN_DEG 를 넘으면 (출발 때 포함) v/v0 를 BIG_TURN_SPEED_RATIO 로 낮추고
 * 가장 좁게 도는 반지름을 tightTurnRadius 로 줄인다. BIG_TURN_EXIT_DEG 아래로 오면 푼다
 */
export const BIG_TURN_DEG = 90
export const BIG_TURN_EXIT_DEG = 60
export const BIG_TURN_SPEED_RATIO = 0.6
/**
 * 멈추는 중(walk_stop)에는 사용자까지 남은 길이 직선의 이 배보다 짧으면 (길이 거의 곧으면) 사용자를 겨눈다.
 * 발자취로 다시 들어가는 중에 멈추면 발자취 쪽을 보고 서서 사용자와 어긋난다 (책상 너머처럼 길이 휘면 그대로 발자취를 따른다)
 */
export const STOP_FACE_PATH_RATIO = 1.15
/** 사용자가 이만큼(m) 넘게 앞서가면 '천천히 걸어 주세요', SLOW_DOWN_CLEAR_M 아래로 오면 끈다 */
export const SLOW_DOWN_M = 3
export const SLOW_DOWN_CLEAR_M = 2.6
/** 사용자 속도 평균 시간 (s) */
export const USER_SPEED_TAU_S = 0.3
/**
 * 사용자가 이보다(m/s) 느리게 멀어지면 멈추는 중으로 보고, 앞으로 갈 거리를 u²/(2·USER_STOP_DECEL) 로 친다.
 * 평균 속도는 늦게 따라와서, 남은 속도로 계속 간다고 보면 사용자가 선 뒤에도 한 바퀴 더 가 너무 가까이 선다
 */
export const USER_WALKING_MPS = 0.25
/** 사람이 걷다 멈출 때 감속 (m/s²) */
export const USER_STOP_DECEL = 1.2
/** 프레임 사이가 이보다(s) 길면 한 프레임으로 이만큼만 돌린다 */
export const MAX_FRAME_S = 0.1
/** 프레임 사이가 이보다(s) 길면 추적이 끊긴 것으로 본다 */
export const FRAME_GAP_LOST_S = 0.25
/** 추적이 이만큼(s) 이어져야 끊김을 푼다 */
export const TRACKING_RECOVER_S = 0.5
/** 바닥 층이 바뀌면 이 시간(s)으로 천천히 따라간다. 초당 FLOOR_FOLLOW_MPS 까지 */
export const FLOOR_FOLLOW_TAU_S = 1
export const FLOOR_FOLLOW_MPS = 0.1
/** 놓은 높이에서 이만큼(m) 넘게 다른 바닥 층은 따라가지 않는다 (잘못 잡힌 층) */
export const FLOOR_FOLLOW_RANGE_M = 0.2

const DEFAULT_DEBUG_INTERVAL_MS = 200
/** 디버그·가짜 스테이지용 기록 개수 */
const HISTORY = 50

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))
const wrapAngle = (angle: number) => Math.atan2(Math.sin(angle), Math.cos(angle))
const toDeg = (radians: number) => (radians * 180) / Math.PI
const RAD = Math.PI / 180
const flat = (point: Vec3): Vec2 => ({ x: point.x, z: point.z })

/**
 * AR 산책: 개가 사용자를 따라 걷는다. 렌더러는 WalkHost·WalkRig 로만 만진다.
 * - 휴대폰을 바닥에 투영한 점을 18cm 마다 발자취로 남기고 (Trail), 개는 발자취를 따라 lookAhead 앞 점을 겨누며 걷는다 (pure pursuit)
 * - 서 있다가 남은 길이 D + 여유보다 길면 출발 (walk_start, 서기 루프 지금 프레임에서 300ms 크로스페이드)
 * - walk_start·walk 끝마다 '지금 멈춤'과 '한 바퀴 더' 중 D 에 더 가깝게 서는 쪽을 고른다.
 *   한 바퀴는 속도와 상관없이 stride_m·s 를 가서, 사용자가 서 있으면 v/v0 는 멈추는 자리를 바꾸지 못한다 (시간만 바뀐다)
 * - 방향은 겨누는 점까지 차이에 비례해 돌리고 넘어서 돌지 않는다 (steering.ts). 상한은 초당 최대 회전각과
 *   (속도 / 가장 좁게 도는 반지름). 서 있는 채로는 돌지 않는다. 차이가 90° 를 넘으면 천천히 좁게 돈다 (크게 돌기)
 * - 사용자가 3m 넘게 앞서가면 '천천히 걸어 주세요' · 추적이 끊기거나 산책 끝을 누르면 다음 루프 끝에서 멈춘다
 */
export class WalkController {
  readonly spec: WalkSpec
  private readonly host: WalkHost
  private readonly options: WalkControllerOptions
  private readonly clock: GaitClock
  private readonly trail: Trail
  private turn = newTurnState()
  private bigTurn = false
  /** 겨누는 점 (발자취를 따라 lookAhead 앞) */
  private aim: Vec2 | null = null
  private maxOffTrail = 0
  private unsubscribe: (() => void) | null = null
  private phase: WalkPhase = 'standing'
  private ending = false
  private finished = false
  private notice: WalkNotice | null = null
  private reported: WalkSnapshot | null = null
  private readonly position: Vec3
  private yaw: number
  /** 놓을 때 바닥 높이 */
  private readonly baseY: number
  private floorTarget: number
  /** v/v0 */
  private k = 1
  private kTarget = 1
  /** 한 바퀴 더를 고를 때 정한 계획 (마지막 루프면 그 속도로) */
  private plan: { last: boolean; k: number } | null = null
  private standingFade = 0
  private lastTime: number | null = null
  private lost = false
  private goodFor = 0
  private userSpeed = 0
  private lastGap: number | null = null
  /** 지난 프레임에 개가 간 거리 (사용자 속도 추정에서 뺀다) */
  private lastMoved = 0
  private movedThisFrame = 0
  private yawRate = 0
  private maxYawRate = 0
  private yawError = 0
  private gap = 0
  private stopPrediction = 0
  private stopReason: StopReason = 'distance'
  private bouts = 0
  private readonly decisions: WalkDecision[] = []
  private readonly stops: WalkStopResult[] = []
  private lastDebugAt = -Infinity

  constructor(host: WalkHost, options: WalkControllerOptions) {
    this.host = host
    this.options = options
    this.spec = walkSpec(host.rig.info)
    this.clock = new GaitClock(this.spec)
    this.trail = new Trail(this.spec.trailResetRadius)
    const pose = host.dogPose()
    this.position = pose ? { ...pose.position } : { x: 0, y: 0, z: 0 }
    this.yaw = pose?.yaw ?? 0
    this.baseY = this.position.y
    this.floorTarget = this.baseY
  }

  start() {
    if (this.unsubscribe || this.finished) return
    this.unsubscribe = this.host.subscribe((frame, floor) => this.onFrame(frame, floor))
    this.report()
  }

  /** 산책 끝: 서 있으면 바로, 걷는 중이면 다음 루프 끝에서 멈춘 뒤 */
  end() {
    if (this.finished) return
    this.ending = true
    if (this.phase === 'standing') this.finish()
    else this.report()
  }

  /** 그만둔다 (AR 이 끝남 등). 걷는 중이었으면 서기 루프로 바로 돌려준다 */
  dispose() {
    if (this.phase !== 'standing') this.host.rig.release()
    if (!this.finished && this.options.onDebug) this.host.showPath?.(null)
    this.phase = 'standing'
    this.finished = true
    this.unsubscribe?.()
    this.unsubscribe = null
  }

  private finish() {
    if (this.finished) return
    this.finished = true
    this.unsubscribe?.()
    this.unsubscribe = null
    if (this.options.onDebug) this.host.showPath?.(null)
    this.report()
    this.options.onFinished()
  }

  private onFrame(frame: StageFrame, floor: FloorLevel) {
    if (this.finished) return
    const rawDt = this.lastTime === null ? 0 : (frame.time - this.lastTime) / 1000
    this.lastTime = frame.time
    const dt = clamp(rawDt, 0, MAX_FRAME_S)
    this.updateTracking(frame.tracking && rawDt <= FRAME_GAP_LOST_S, dt)

    const dog = flat(this.position)
    // 추적이 끊긴 동안 카메라 위치는 추정값이라 발자취에 넣지 않는다
    if (frame.tracking) this.trail.record(flat(frame.camera), dog)
    this.trail.locate(dog)
    this.gap = this.trail.length(dog, this.spec.lookAhead)
    this.updateUserSpeed(dt, frame.tracking && !this.trail.cut)
    const floorMoved = this.followFloor(floor, dt)

    this.movedThisFrame = 0
    if (this.phase === 'standing') {
      this.yawRate = 0
      const { followDistance, startMargin } = this.spec
      if (this.ending) {
        this.finish()
        return
      }
      if (!this.lost && this.gap > followDistance + startMargin) this.startBout()
      else if (floorMoved) this.host.rig.moveDog(this.position, this.yaw)
    }
    if (this.phase === 'start' || this.phase === 'walk' || this.phase === 'stop') this.walkFrame(frame, dt)
    else this.aimError()
    this.lastMoved = this.movedThisFrame
    if (this.phase !== 'standing' && this.phase !== 'turn') {
      this.maxOffTrail = Math.max(this.maxOffTrail, this.trail.offset)
    }

    if (this.notice === null && this.gap > SLOW_DOWN_M) this.notice = 'slowDown'
    else if (this.notice === 'slowDown' && this.gap < SLOW_DOWN_CLEAR_M) this.notice = null
    this.options.ahead?.update?.(this.aheadInput(frame))
    this.report()
    if (this.options.onDebug) this.host.showPath?.({ points: this.trail.ahead, aim: this.aim, y: this.position.y })
    this.debug(frame)
  }

  private updateTracking(good: boolean, dt: number) {
    if (!good) {
      this.lost = true
      this.goodFor = 0
      return
    }
    if (!this.lost) return
    this.goodFor += dt
    if (this.goodFor >= TRACKING_RECOVER_S) this.lost = false
  }

  /** 길을 따라 사용자가 멀어지는 속도. 남은 길의 변화에 개가 간 거리를 더한다 */
  private updateUserSpeed(dt: number, usable: boolean) {
    const previous = this.lastGap
    this.lastGap = this.gap
    if (previous === null || !usable || dt <= 0) return
    const sample = clamp((this.gap - previous + this.lastMoved) / dt, -3, 3)
    this.userSpeed += (sample - this.userSpeed) * (1 - Math.exp(-dt / USER_SPEED_TAU_S))
  }

  /** 바닥 층이 바뀌면 천천히 따라간다. 높이를 바꿨으면 true */
  private followFloor(floor: FloorLevel, dt: number) {
    if (floor.y !== null && !floor.provisional && Math.abs(floor.y - this.baseY) <= FLOOR_FOLLOW_RANGE_M) {
      this.floorTarget = floor.y
    }
    const diff = this.floorTarget - this.position.y
    if (Math.abs(diff) < 1e-4) return false
    const step = clamp(diff * (1 - Math.exp(-dt / FLOOR_FOLLOW_TAU_S)), -FLOOR_FOLLOW_MPS * dt, FLOOR_FOLLOW_MPS * dt)
    this.position.y += step
    return Math.abs(step) > 0
  }

  private startBout() {
    const error = this.aimError()
    // 나중 자리: 제자리 회전 클립이 있으면 크게 돌아야 할 때 walk_start 전에 튼다
    if (error !== null && Math.abs(error) > BIG_TURN_DEG * RAD && this.turnInPlace(error)) return
    this.host.rig.takeOver()
    this.clock.restart()
    this.k = 1
    this.kTarget = 1
    this.plan = null
    this.standingFade = 0
    this.turn = newTurnState()
    this.bigTurn = error !== null && Math.abs(error) > BIG_TURN_DEG * RAD
    this.phase = 'start'
    this.bouts++
  }

  /** 제자리 회전 클립을 틀기 시작했으면 true. 다 돌면 개 방향을 돌리고 서기로 (다음 프레임에 walk_start) */
  private turnInPlace(angle: number) {
    const { rig } = this.host
    if (!rig.turnInPlace) return false
    const started = rig.turnInPlace(angle, (turned) => {
      if (this.finished || this.phase !== 'turn') return
      this.yaw = wrapAngle(this.yaw + turned)
      rig.moveDog(this.position, this.yaw)
      this.host.dogMoved(this.position, this.yaw)
      this.phase = 'standing'
      if (this.ending) this.finish()
      else this.report()
    })
    if (started) this.phase = 'turn'
    return started
  }

  /**
   * 겨누는 점을 다시 구하고 그 점까지 방향 차이 (rad). 겨눌 점이 없으면 null.
   * 발자취를 따라 lookAhead 앞 점. 멈추는 중(walk_stop)이고 사용자까지 길이 거의 곧으면 사용자 (사용자를 보며 선다)
   */
  private aimError(): number | null {
    let aim = this.trail.pointAhead(this.spec.lookAhead)
    const user = this.trail.userPosition
    if (aim && user && this.phase === 'stop') {
      const straight = Math.hypot(user.x - this.position.x, user.z - this.position.z)
      if (straight > 1e-3 && this.gap <= STOP_FACE_PATH_RATIO * straight) aim = { ...user }
    }
    this.aim = aim
    if (!aim) return null
    const dx = aim.x - this.position.x
    const dz = aim.z - this.position.z
    if (Math.hypot(dx, dz) < 1e-3) return null
    return wrapAngle(Math.atan2(dx, dz) - this.yaw)
  }

  private walkFrame(frame: StageFrame, dt: number) {
    const { clock } = this
    const error = this.aimError()
    if (error !== null) {
      this.yawError = error
      if (Math.abs(error) > BIG_TURN_DEG * RAD) this.bigTurn = true
      else if (Math.abs(error) < BIG_TURN_EXIT_DEG * RAD) this.bigTurn = false
    }
    // walk_start·walk_stop 은 자연 배율(k = 1)이다. walk 에서만 v/v0 를 천천히 바꾼다.
    // 크게 돌 때는 0.6 으로 낮춘다. 이 루프 끝에서 멈출 것 같으면 1 로 돌려 둔다
    // (walk_stop 이 v0 에서 시작해서, 0.6 이나 1.4 로 가다 멈추면 걸음 빠르기가 툭 바뀐다)
    if (clock.clip === 'walk') {
      const { followDistance, stride } = this.spec
      const stopLikely = this.ending || this.lost || this.liveStopEstimate() <= followDistance + stride / 2
      this.kTarget = this.bigTurn
        ? BIG_TURN_SPEED_RATIO
        : this.plan?.last
          ? this.plan.k
          : stopLikely
            ? 1
            : this.followRatio()
      this.k += clamp(this.kTarget - this.k, -SPEED_RATIO_RATE * dt, SPEED_RATIO_RATE * dt)
    } else {
      this.k = 1
      this.kTarget = 1
    }
    this.steer(error, dt)
    const step = clock.advance(
      dt,
      this.k,
      (ended) => this.decide(ended, frame),
      (meters) => this.move(meters),
    )
    this.standingFade += dt
    this.host.rig.moveDog(this.position, this.yaw)
    this.host.dogMoved(this.position, this.yaw)
    if (step.standingAfter !== null) {
      this.host.rig.release()
      this.phase = 'standing'
      this.yawRate = 0
      this.recordStop(frame.time)
      if (this.ending) this.finish()
      return
    }
    this.phase = clock.clip === 'walk_start' ? 'start' : clock.clip === 'walk' ? 'walk' : 'stop'
    this.host.rig.show({
      clip: clock.clip,
      time: clock.time,
      standingWeight: Math.max(0, 1 - this.standingFade / STANDING_FADE_S),
    })
  }

  /** 따라가는 속도 배율: 사용자 속도에, 남은 길이 D + 정지 거리보다 긴 만큼 CATCH_UP_S 안에 따라잡는 속도를 더한다 */
  private followRatio() {
    const { v0, followDistance, stopDistance } = this.spec
    const wanted = this.userSpeed + (this.gap - followDistance - stopDistance) / CATCH_UP_S
    return clamp(wanted / v0, SPEED_RATIO_MIN, SPEED_RATIO_MAX)
  }

  /** 회전 속도 상한 (rad/s): min(최대 회전각, 속도 / 가장 좁게 도는 반지름). 크게 돌 때는 반지름이 작다 */
  private yawLimit() {
    const { spec, clock } = this
    const radius = this.bigTurn ? spec.tightTurnRadius : spec.turnRadius
    return Math.min(YAW_RATE_MAX_DEG * RAD, clock.speed(this.k) / radius)
  }

  /** 겨누는 점 쪽으로 돈다 (차이에 비례, 넘어서 돌지 않음, 짧게 뒤집힌 차이는 따라가지 않음: steering.ts) */
  private steer(error: number | null, dt: number) {
    if (error === null || dt <= 0) {
      this.turn.rate = 0
      this.yawRate = 0
      return
    }
    const rate = turnStep(this.turn, error, this.yawLimit(), dt)
    this.yaw = wrapAngle(this.yaw + rate * dt)
    this.yawRate = rate
    this.maxYawRate = Math.max(this.maxYawRate, Math.abs(rate))
  }

  private move(meters: number) {
    this.position.x += Math.sin(this.yaw) * meters
    this.position.z += Math.cos(this.yaw) * meters
    this.movedThisFrame += meters
  }

  /** walk_start·walk 끝에서: 지금 멈출지 한 바퀴 더 갈지 */
  private decide(ended: WalkClip, frame: StageFrame): 'walk' | 'walk_stop' {
    const { followDistance: D, stopSeconds, stopDistance, stride, loopSeconds } = this.spec
    const dog = flat(this.position)
    this.trail.locate(dog)
    const gap = this.trail.length(dog, this.spec.lookAhead)
    // 사용자가 멀어지는 중이면 그만큼 더 가고, 다가오는 중이면 덜 간다 (u < 0)
    const u = this.userSpeed
    let reason: StopReason | null = this.ending ? 'ending' : this.lost ? 'tracking' : null
    if (!reason && this.options.ahead?.blocked(this.aheadInput(frame))) reason = 'ahead'
    const stopNow = gap + this.userTravel(stopSeconds) - stopDistance
    const oneMoreK = this.lastLoopRatio(gap)
    const oneMoreSeconds = loopSeconds / oneMoreK + stopSeconds
    const oneMore = gap + this.userTravel(oneMoreSeconds) - stride - stopDistance
    const twoMore = gap + this.userTravel(oneMoreSeconds + loopSeconds) - 2 * stride - stopDistance
    // 지금 멈춰도 D + 반 걸음보다 멀면 멈출 까닭이 없다 (사용자가 계속 멀어지면 '한 바퀴 더'도 멀어서 둘만 견주면 멈춰 버린다)
    const tooFar = stopNow > D + stride / 2
    // 크게 도는 중에는 (끝내기·추적 끊김이 아니면) 멈추지 않는다: 사용자와 어긋난 채 서고, v/v0 0.6 에서 walk_stop 으로 넘어가 걸음이 툭 빨라진다
    const turning = this.bigTurn
    const choice = reason || (!turning && !tooFar && Math.abs(stopNow - D) <= Math.abs(oneMore - D)) ? 'stop' : 'walk'
    // 마지막 루프: 한 바퀴 더 가면 D 에서 반 걸음 안에 서고, 두 바퀴보다 낫다. 아니면 따라가는 속도(followRatio)로
    const last = choice === 'walk' && Math.abs(oneMore - D) <= stride / 2 && Math.abs(oneMore - D) <= Math.abs(twoMore - D)
    this.plan = choice === 'walk' ? { last, k: oneMoreK } : null
    if (choice === 'stop') {
      this.stopPrediction = stopNow
      this.stopReason = reason ?? 'distance'
    }
    this.decisions.push({
      ended,
      time: frame.time,
      gap,
      userSpeed: u,
      stopNow,
      oneMore,
      oneMoreK,
      choice,
      last,
      reason,
    })
    if (this.decisions.length > HISTORY) this.decisions.shift()
    return choice === 'stop' ? 'walk_stop' : 'walk'
  }

  /**
   * 앞으로 seconds 동안 사용자가 길을 따라 더 갈 거리 (다가오면 −).
   * 걷는 빠르기보다 느리게 멀어지면 멈추는 중으로 보고 곧 선다고 친다 (USER_WALKING_MPS)
   */
  private userTravel(seconds: number) {
    const u = this.userSpeed
    if (u <= 0 || u >= USER_WALKING_MPS) return u * seconds
    return Math.min(u * seconds, (u * u) / (2 * USER_STOP_DECEL))
  }

  /**
   * 마지막 루프의 v/v0. 사용자가 서 있거나 멈추는 중이면 1 (한 바퀴 거리는 속도와 상관없고, walk_stop 이 자연 속도에서 시작한다).
   * 걷고 있으면 그 사이 사용자가 가는 거리까지 쳐서 D 에 서도록 루프 시간을 맞춘다
   */
  private lastLoopRatio(gap: number) {
    const u = this.userSpeed
    if (Math.abs(u) < USER_WALKING_MPS) return 1
    const { followDistance: D, stopSeconds, stopDistance, stride, loopSeconds } = this.spec
    const loopTime = (D - gap + stride + stopDistance) / u - stopSeconds
    // 한 바퀴를 아무리 빨리 돌아도 D 보다 멀리(사용자가 빨리 멀어짐) 또는 가까이(다가옴) 선다: 빨리 돈다
    if (!(loopTime > 0)) return SPEED_RATIO_MAX
    return clamp(loopSeconds / loopTime, SPEED_RATIO_MIN, SPEED_RATIO_MAX)
  }

  private recordStop(time: number) {
    const dog = flat(this.position)
    this.trail.locate(dog)
    const gap = this.trail.length(dog, this.spec.lookAhead)
    const user = this.trail.userPosition
    this.stops.push({
      time,
      reason: this.stopReason,
      predicted: this.stopPrediction,
      gap,
      straight: user ? Math.hypot(user.x - dog.x, user.z - dog.z) : 0,
      error: gap - this.spec.followDistance,
    })
    if (this.stops.length > HISTORY) this.stops.shift()
  }

  private aheadInput(frame: StageFrame) {
    const user = this.trail.userPosition
    return {
      frame,
      position: { ...this.position },
      yaw: this.yaw,
      path: user ? [...this.trail.ahead, user] : [...this.trail.ahead],
      distance: this.spec.stride + this.spec.stopDistance,
    }
  }

  /** 다음 루프 끝에서 멈추면 설 거리 (디버그) */
  private liveStopEstimate() {
    const { spec, clock } = this
    const rate = clock.rate(this.k)
    const left = spec.durations[clock.clip] - clock.time
    const ahead = clipDistance(spec, clock.clip, clock.time, spec.durations[clock.clip])
    if (clock.clip === 'walk_stop') return this.gap - ahead + this.userTravel(left / rate)
    return this.gap - ahead - spec.stopDistance + this.userTravel(left / rate + spec.stopSeconds)
  }

  private report() {
    const snapshot: WalkSnapshot = { phase: this.phase, ending: this.ending, notice: this.notice }
    const last = this.reported
    if (last && last.phase === snapshot.phase && last.ending === snapshot.ending && last.notice === snapshot.notice) return
    this.reported = snapshot
    this.options.onChange(snapshot)
  }

  private debug(frame: StageFrame) {
    const { onDebug } = this.options
    const interval = this.options.debugIntervalMs ?? DEFAULT_DEBUG_INTERVAL_MS
    if (!onDebug || frame.time - this.lastDebugAt < interval) return
    this.lastDebugAt = frame.time
    const { spec, clock } = this
    const walking = this.phase === 'start' || this.phase === 'walk' || this.phase === 'stop'
    const timeScale = walking ? clock.rate(this.k) : 0
    const user = this.trail.userPosition
    const straight = user ? Math.hypot(user.x - this.position.x, user.z - this.position.z) : 0
    const D = spec.followDistance
    const decision = this.decisions.at(-1)
    const stop = this.stops.at(-1)
    const limit = walking ? toDeg(this.yawLimit()) : 0
    const radius = this.bigTurn ? spec.tightTurnRadius : spec.turnRadius
    const live = walking ? this.liveStopEstimate() : null
    const lines = [
      `산책 ${this.phase}${this.ending ? ' · 끝내는 중' : ''}${this.lost ? ' · 추적 끊김' : ''}${this.notice ? ' · 천천히' : ''} · ${this.bouts}번째 출발 · 루프 ${walking ? clock.loop : '-'}`,
      `s ${spec.scale.toFixed(4)} (${spec.scaleSource === 'root' ? '루트 배율' : '모델 크기÷ref'}) · v0 ${spec.v0.toFixed(3)}m/s · r0 ${spec.r0.toFixed(3)} · extras ${spec.extrasSource}`,
      `v/v0 ${this.k.toFixed(2)}→${this.kTarget.toFixed(2)}${this.plan?.last ? ' (마지막 루프)' : ''} · timeScale ${timeScale.toFixed(3)} · 속도 ${(walking ? clock.speed(this.k) : 0).toFixed(2)}m/s`,
      `한 바퀴 ${spec.stride.toFixed(3)}m/${spec.loopSeconds.toFixed(3)}s · 출발 ${spec.startDistance.toFixed(3)}m · 정지 ${spec.stopDistance.toFixed(3)}m/${spec.stopSeconds.toFixed(2)}s`,
      `사용자까지 ${this.gap.toFixed(2)}m (직선 ${straight.toFixed(2)}) · D ${D.toFixed(2)} + 여유 ${spec.startMargin.toFixed(2)} · 사용자 속도 ${this.userSpeed.toFixed(2)}m/s`,
      `발자취 ${this.trail.count}점 · 겨누는 점 ${spec.lookAhead.toFixed(2)}m 앞 · 발자취에서 벗어남 ${this.trail.offset.toFixed(2)}m (최대 ${this.maxOffTrail.toFixed(2)})`,
      `바닥 y ${this.position.y.toFixed(3)} (따라갈 층 ${this.floorTarget.toFixed(3)})`,
      live !== null ? `다음 루프 끝에 멈추면 ${live.toFixed(2)}m (D ${signed(live - D)})` : '다음 루프 끝 -',
      decision
        ? `지난 판단 ${decision.ended} 끝: 지금 멈춤 ${decision.stopNow.toFixed(2)} (${signed(decision.stopNow - D)}) · 한 바퀴 더 ${decision.oneMore.toFixed(2)} (${signed(decision.oneMore - D)}, v/v0 ${decision.oneMoreK.toFixed(2)}) → ${decision.choice === 'stop' ? '멈춤' : decision.last ? '한 바퀴 더(마지막)' : '계속'}${decision.reason ? ` (${decision.reason})` : ''}`
        : '지난 판단 -',
      stop
        ? `지난 정지 ${stop.gap.toFixed(2)}m (D ${signed(stop.error)}, 예상 ${stop.predicted.toFixed(2)}, 직선 ${stop.straight.toFixed(2)}) · ${stop.reason}`
        : '지난 정지 -',
      `회전 ${toDeg(this.yawRate).toFixed(0)}°/s (상한 ${limit.toFixed(0)}, 반지름 ${radius.toFixed(2)}m${this.bigTurn ? ' · 크게 돌기' : ''}) · 최대 ${toDeg(this.maxYawRate).toFixed(0)}°/s · 방향 차이 ${toDeg(this.yawError).toFixed(0)}°`,
    ]
    onDebug({
      summary: `산책 ${this.phase} · v/v0 ${this.k.toFixed(2)} · 거리 ${this.gap.toFixed(2)}/D ${D.toFixed(2)}`,
      lines,
      values: {
        phase: this.phase,
        k: this.k,
        timeScale,
        gap: this.gap,
        straight,
        userSpeed: this.userSpeed,
        yawRate: this.yawRate,
        maxYawRate: this.maxYawRate,
        bigTurn: this.bigTurn,
        trailPoints: this.trail.count,
        trail: this.trail.ahead,
        aim: this.aim,
        offTrail: this.trail.offset,
        maxOffTrail: this.maxOffTrail,
        decisions: this.decisions,
        stops: this.stops,
      },
    })
  }
}

const signed = (value: number) => `${value >= 0 ? '+' : ''}${value.toFixed(2)}`
