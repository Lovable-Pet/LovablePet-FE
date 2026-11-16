import type { StageFrame } from '../placement/arStage'
import type { Vec3 } from '../placement/types'
import { clipDistance, GaitClock } from './gait'
import { newTurnState, turnStep } from './steering'
import { Trail, type Vec2 } from './trail'
import { UserLevel, type LevelEvent } from './userLevel'
import type { FloorLevel, WalkHost } from './walkStage'
import { walkSpec, type WalkClip, type WalkSpec } from './walkSpec'

/**
 * standing: 서 있음 (model-viewer 가 서기 루프를 돌린다) · start: walk_start · walk: walk 루프 · stop: walk_stop ·
 * turn: 출발 전 제자리 회전 클립 (나중 자리, 지금은 어댑터에 클립이 없어 오지 않는다)
 */
export type WalkPhase = 'standing' | 'turn' | 'start' | 'walk' | 'stop'

/** slowDown: 사용자가 3m 넘게 앞서감 → '천천히 걸어 주세요' · otherLevel: 사용자가 턱·계단으로 다른 층에 감 → '여기는 따라갈 수 없어요' */
export type WalkNotice = 'slowDown' | 'otherLevel'

/** 멈춘 까닭. distance: D 에 맞춰 · ending: 산책 끝 · tracking: 추적 끊김 · level: 사용자가 다른 층이라 경계 앞에서 */
export type StopReason = 'distance' | 'ending' | 'tracking' | 'level'

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
  /** 사용자가 지금 멈춘다면 한 바퀴 더 가고 멈췄을 때 설 거리 (m). D × MIN_STOP_RATIO 보다 짧으면 지금 멈춘다 */
  oneMoreIfUserStops: number
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
    /** 사용자가 걸어가는 중 (멀어지는 속도가 이어지고 멈추느라 느려지는 중이 아님) */
    userWalking: boolean
    /** 서 있을 때 출발하는 남은 길 (m) */
    startAt: number
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
    /** 사용자 층: state 0 같은 층 · ±1 위·아래, offset 카메라 높이 − 기준 (m), rising 경계 후보를 둠, edge 경계까지 남은 길 (m, 같은 층이면 null) */
    level: { state: number; offset: number; rising: boolean; edge: number | null }
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
  /** 개발용 (주소 ?floor·?keep·?tight): 값을 바꿔 폰에서 견준다. 없으면 MIN_STOP_RATIO·FLOOR_KEEP_EXTRA_M·TIGHT_TURN_RADIUS_BODY_LENGTHS */
  tuning?: WalkTuning
}

export interface WalkTuning {
  /** MIN_STOP_RATIO 대신. 0 이면 최저선을 끈다 (멈춤 판단·걷는 중 지킬 길·출발 거리 모두) */
  minStopRatio?: number
  /** FLOOR_KEEP_EXTRA_M 대신 (m) */
  floorKeepExtra?: number
  /** 크게 돌 때 가장 좁게 도는 반지름 (몸길이 배, TIGHT_TURN_RADIUS_BODY_LENGTHS 대신). 좁히면 발이 옆으로 더 미끄러진다 */
  tightTurnRatio?: number
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
 * 사용자가 걸어가는 중: 멀어지는 속도가 USER_WALK_ON_MPS 를 USER_WALK_HOLD_S 넘게 넘으면 켜고, USER_WALK_OFF_MPS 아래로 오면 끈다.
 * 걸어가는 중이면 일찍 출발하고 (startThreshold), walk_start 끝에서 멈추지 않으며, 루프 끝에서도 너무 가까워질 때만 멈춘다 (wantsStop)
 */
export const USER_WALK_ON_MPS = 0.15
export const USER_WALK_HOLD_S = 0.3
export const USER_WALK_OFF_MPS = 0.1
/**
 * 사용자 속도가 최근 최고 속도의 이 배 아래로 떨어지면 멈추는 중으로 보고 (걸어가는 중이 아니다), 앞으로 갈 거리를
 * u²/(2·USER_STOP_DECEL) 로 친다. 평균 속도는 늦게 따라와서, 남은 속도로 계속 간다고 보면 사용자가 선 뒤에도 한 바퀴 더 가 너무 가까이 선다.
 * 최고 속도는 USER_PEAK_TAU_S 로 잊는다 (천천히 꾸준히 걸으면 걸어가는 중이다)
 */
export const USER_SLOWING_RATIO = 0.75
export const USER_PEAK_TAU_S = 2
/**
 * 거리에 맞춰 멈춘 뒤 적어도 이만큼(s) 서 있다가 다시 출발한다 (걷다 서다를 되풀이하는 사용자를 따라 멈추자마자 다시 출발하지 않게).
 * 추적 끊김·앞 막힘으로 멈췄으면 기다리지 않는다
 */
export const MIN_STAND_S = 0.8
/**
 * walk_start 끝에서 사용자가 이 시간(s) 안에 걸어가는 중이었으면 (걷다 잠깐 섬) 멈추지 않고 한 바퀴 더 간다.
 * 한 바퀴 더 가면 D × WALK_START_CLOSE_RATIO 보다 가까워지면 멈춘다
 */
export const RECENT_WALK_S = 1
export const WALK_START_CLOSE_RATIO = 0.6
/** 사람이 걷다 멈출 때 감속 (m/s²) */
export const USER_STOP_DECEL = 1.2
/** 사용자가 이보다(m/s) 빨리 다가오면 마지막 루프 속도를 다가오는 만큼 맞춘다 */
export const USER_APPROACH_MPS = 0.25
/**
 * 사용자가 걸어가는 중이면 남은 길이 D + 이만큼 넘을 때 출발한다 (서 있으면 D + startMargin).
 * 0 이면 개보다 천천히 걷는 사용자를 따라 D 근처에서 서자마자 다시 출발한다
 */
export const WALKING_START_MARGIN_M = 0.1
/**
 * 사용자가 걸어가는 중이면 walk_start 동안 사용자가 개보다 더 갈 거리(속도 × walk_start 시간 − walk_start 거리)만큼
 * 일찍 출발한다 (D × 이 값까지). 그러면 walk_start 끝에 남은 길이 사용자 빠르기와 상관없이 D + WALKING_START_MARGIN_M 쯤이다.
 * 개보다 천천히 걸으면 일찍 출발하지 않는다 (walk_start 동안 거리가 줄어 가까이 따라붙는다)
 */
export const WALKING_START_LEAD_RATIO = 0.4
/**
 * 사용자가 걸어가는 중이면 개가 서 있는 거리(선 뒤 가장 가까웠던 남은 길) + 이만큼(m) 넘어도 출발한다 (D × WALKING_START_MIN_RATIO 아래로는
 * 안 내린다). 천천히 걷다 멈춘 개는 D 보다 가까이(1m 쯤) 서는데, D 근처까지 기다리면 사용자가 0.5m 넘게 걸어간 뒤에야 따라온다
 */
export const WALKING_START_ABOVE_STAND_M = 0.3
export const WALKING_START_MIN_RATIO = 0.8
/**
 * 사용자가 걸어가는 중이면 한 바퀴 더 가면 D × 이 값보다 가까워질 때만 멈춘다 (아니면 v/v0 를 낮춰 계속 걷는다).
 * 사용자가 개의 가장 느린 걸음(v/v0 0.6)보다 천천히 걸으면 개는 걷다 서기를 되풀이하는데, 이 폭만큼 서 있다
 */
export const WALKING_STOP_RATIO = 0.8
/**
 * 최저선: 루프 끝에서 사용자가 지금 멈춘다면 한 바퀴 더 가고 설 거리가 D × 이 값보다 짧으면 지금 멈춘다 (크게 돌기·walk_start 직후 예외 뒤,
 * 다른 규칙보다 먼저). 걸어가는 중이라도 그 사이 사용자가 서면 개는 한 바퀴와 walk_stop 만큼 (진도 0.76m) 더 가서 너무 가까이 선다.
 * 폰에서 0·0.75·0.85 를 견줘 0.75 로 정했다. 0.85 는 너무 가까운 정지가 더 적지만 천천히 걷다 다시 걸을 때 출발이 더 늦다
 * (개발 모드에서 주소 ?floor 로 바꿀 수 있다)
 */
export const MIN_STOP_RATIO = 0.75
/**
 * 사용자가 걸어가는 중이면 루프 끝 남은 길을 최저선 + 한 바퀴 + 정지 거리 + 이만큼(m) 으로 지킨다 (followRatio).
 * 출발도 첫 walk 루프 끝에 그만큼 남을 때 한다 (startThreshold). 0 이면 최저선에 딱 맞춰 걷다 조금만 흔들려도 멈춘다
 */
export const FLOOR_KEEP_EXTRA_M = 0.1
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
/**
 * 사용자가 다른 층이면 개 코가 경계 점보다 이만큼(m) 앞에서 서도록 루프 끝에서 멈춘다.
 * 경계 점은 카메라 높이가 바뀌기 시작한 자리라 실제 턱 면과 ±0.2m 쯤 어긋난다
 */
export const LEVEL_EDGE_MARGIN_M = 0.3

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
 * - 서 있다가 출발 (walk_start, 서기 루프 지금 프레임에서 300ms 크로스페이드): 사용자가 서 있으면 남은 길 > D + 여유,
 *   걸어가는 중이면 (멀어지는 속도가 이어짐) 개가 서 있는 거리 + 0.3m (0.8 D 아래로는 안 내림) 와,
 *   D + 0.1m 에서 walk_start 동안 사용자가 개보다 더 갈 거리를 뺀 것 중 짧은 쪽만 넘어도.
 *   거리에 맞춰 멈춘 뒤에는 0.8초 넘게 선 뒤에 출발한다
 * - walk_start·walk 끝마다 '지금 멈춤'과 '한 바퀴 더' 중 D 에 더 가깝게 서는 쪽을 고른다.
 *   한 바퀴는 속도와 상관없이 stride_m·s 를 가서, 사용자가 서 있으면 v/v0 는 멈추는 자리를 바꾸지 못한다 (시간만 바뀐다).
 *   사용자가 걸어가는 중이면 v/v0 를 낮춰 (0.6 까지) 계속 걷고, 한 바퀴 더 가면 너무 가까워질 때만 멈춘다 (wantsStop)
 * - 방향은 겨누는 점까지 차이에 비례해 돌리고 넘어서 돌지 않는다 (steering.ts). 상한은 초당 최대 회전각과
 *   (속도 / 가장 좁게 도는 반지름). 서 있는 채로는 돌지 않는다. 차이가 90° 를 넘으면 천천히 좁게 돈다 (크게 돌기)
 * - 사용자가 3m 넘게 앞서가면 '천천히 걸어 주세요' · 추적이 끊기거나 산책 끝을 누르면 다음 루프 끝에서 멈춘다
 * - 사용자가 턱·계단으로 다른 층에 서면 (카메라 높이, userLevel.ts) 개는 경계 앞 루프 끝에서 멈추고 '여기는 따라갈 수 없어요'.
 *   같은 층으로 돌아오면 다시 따라간다
 */
export class WalkController {
  readonly spec: WalkSpec
  private readonly host: WalkHost
  private readonly options: WalkControllerOptions
  private readonly clock: GaitClock
  private readonly trail: Trail
  /** 사용자가 턱·계단으로 다른 층에 갔는지 (카메라 높이) */
  private readonly level = new UserLevel()
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
  /** 최근 최고 사용자 속도 (USER_PEAK_TAU_S 로 잊는다) */
  private userPeak = 0
  /** 사용자 속도가 USER_WALK_ON_MPS 를 넘은 채 이어진 시간 (s) */
  private userFastFor = 0
  private userWalking = false
  /** 거리에 맞춰 멈춘 뒤 서 있는 시간 (s). 처음과 다른 까닭으로 멈춘 뒤에는 Infinity */
  private standingFor = Infinity
  /** 서 있는 동안 가장 짧았던 남은 길 (m). 걷는 중이면 Infinity */
  private standGap = Infinity
  /** 사용자가 걸어가는 중이 아니게 된 뒤 지난 시간 (s). 걸어가는 중이면 0 */
  private sinceWalking = Infinity
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
  /** 최저선 비율 (0 이면 끔)과 걷는 중 지킬 길 여유 (m) */
  private readonly minStopRatio: number
  private readonly floorKeep: number

  constructor(host: WalkHost, options: WalkControllerOptions) {
    this.host = host
    this.options = options
    this.minStopRatio = Math.max(0, options.tuning?.minStopRatio ?? MIN_STOP_RATIO)
    this.floorKeep = Math.max(0, options.tuning?.floorKeepExtra ?? FLOOR_KEEP_EXTRA_M)
    const spec = walkSpec(host.rig.info)
    const tight = options.tuning?.tightTurnRatio
    this.spec = tight && tight > 0 ? { ...spec, tightTurnRadius: tight * spec.bodyLength } : spec
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
    // 추적이 끊긴 동안 카메라 위치는 추정값이라 발자취에도 층 판단에도 넣지 않는다
    if (frame.tracking) {
      this.trail.record(flat(frame.camera), dog)
      this.onLevel(this.level.update(frame.camera.y - this.position.y, flat(frame.camera), dt))
    }
    this.trail.locate(dog)
    this.gap = this.trail.length(dog, this.spec.lookAhead)
    this.updateUserSpeed(dt, frame.tracking && !this.trail.cut)
    const floorMoved = this.followFloor(floor, dt)

    this.movedThisFrame = 0
    if (this.phase === 'standing') {
      this.yawRate = 0
      if (this.ending) {
        this.finish()
        return
      }
      this.standingFor += dt
      this.standGap = Math.min(this.standGap, this.gap)
      // 다른 층 경계 앞에서는 가장 짧은 산책(walk_start + walk_stop)을 할 자리가 있어야 출발한다
      const room = this.edgeRoom() >= this.spec.startDistance + this.spec.stopDistance
      if (!this.lost && room && this.standingFor >= MIN_STAND_S && this.gap > this.startThreshold()) this.startBout()
      else if (floorMoved) this.host.rig.moveDog(this.position, this.yaw)
    }
    if (this.phase === 'start' || this.phase === 'walk' || this.phase === 'stop') this.walkFrame(frame, dt)
    else this.aimError()
    this.lastMoved = this.movedThisFrame
    if (this.phase !== 'standing' && this.phase !== 'turn') {
      this.maxOffTrail = Math.max(this.maxOffTrail, this.trail.offset)
    }

    const slow = this.notice === 'slowDown' ? this.gap >= SLOW_DOWN_CLEAR_M : this.gap > SLOW_DOWN_M
    this.notice = this.level.state !== 0 ? 'otherLevel' : slow ? 'slowDown' : null
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

  /** 사용자 층 판단을 발자취에 옮긴다 (경계 후보·경계·같은 층으로 돌아옴) */
  private onLevel(event: LevelEvent | null) {
    if (event === 'rise') this.trail.markRise()
    else if (event === 'cancel') this.trail.cancelRise()
    else if (event === 'enter') this.trail.enterOtherLevel()
    else if (event === 'exit') this.trail.exitOtherLevel()
  }

  /** 다른 층 경계까지 개 중심이 더 갈 수 있는 거리 (m): 경계까지 길 − 몸길이 절반 − 여유. 사용자가 같은 층이면 Infinity. locate 뒤에 맞다 */
  private edgeRoom() {
    const edge = this.trail.edgeDistance()
    return edge === null ? Infinity : edge - this.spec.bodyLength / 2 - LEVEL_EDGE_MARGIN_M
  }

  /** 길을 따라 사용자가 멀어지는 속도. 남은 길의 변화에 개가 간 거리를 더한다 */
  private updateUserSpeed(dt: number, usable: boolean) {
    const previous = this.lastGap
    this.lastGap = this.gap
    if (previous === null || !usable || dt <= 0) return
    const sample = clamp((this.gap - previous + this.lastMoved) / dt, -3, 3)
    this.userSpeed += (sample - this.userSpeed) * (1 - Math.exp(-dt / USER_SPEED_TAU_S))
    this.userPeak = Math.max(this.userSpeed, this.userPeak * Math.exp(-dt / USER_PEAK_TAU_S))
    if (this.userSpeed > USER_WALK_ON_MPS) {
      this.userFastFor += dt
      if (this.userFastFor >= USER_WALK_HOLD_S) this.userWalking = true
    } else {
      this.userFastFor = 0
      if (this.userSpeed < USER_WALK_OFF_MPS) this.userWalking = false
    }
    this.sinceWalking = this.walkingAway() ? 0 : this.sinceWalking + dt
  }

  /** 사용자가 걸어가는 중인지 (멀어지는 속도가 이어지고, 멈추느라 느려지는 중이 아님) */
  private walkingAway() {
    return this.userWalking && this.userSpeed >= USER_SLOWING_RATIO * this.userPeak
  }

  /**
   * 서 있다가 출발하는 남은 길. 사용자가 서 있으면 D + 여유,
   * 걸어가는 중이면 둘 중 짧은 쪽:
   * - 개가 서 있는 거리 + WALKING_START_ABOVE_STAND_M (D × WALKING_START_MIN_RATIO 아래로는 안 내림.
   *   가장 짧은 산책 동안 개가 사용자보다 이보다 더 가면 그만큼: 다음에 지금보다 가까이 서지 않게)
   * - D + WALKING_START_MARGIN_M − (walk_start 동안 사용자가 개보다 더 갈 거리, D × WALKING_START_LEAD_RATIO 까지)
   * 다만 멀어지는 사용자(걸어가는 중이거나 막 걷기 시작함)면 최저선 출발 거리(floorStart)보다 이르게는 안 한다:
   * 천천히 걷는 사용자를 따라 짧게 걷고 서기를 되풀이하지 않게
   */
  private startThreshold() {
    const { followDistance: D, startMargin, startSeconds, startDistance, stride, stopDistance, loopSeconds, stopSeconds } = this.spec
    const u = Math.max(0, this.userSpeed)
    // 최저선: 출발한 뒤 첫 walk 루프 끝에서 '사용자가 지금 멈춘다면 한 바퀴 더'가 최저선 아래면 바로 멈춘다 (짧게 걷고 서기).
    // 그 루프 끝에 최저선 + 한 바퀴 + 정지 거리 + 여유가 남게, walk_start 와 첫 루프 동안 사용자가 갈 거리를 빼고 출발한다.
    // 첫 루프는 자연 속도로 친다 (walk_start 끝에 v/v0 가 1 이고 천천히 내려온다)
    const floorStart =
      this.minStopRatio > 0
        ? this.minStopRatio * D + this.floorKeep + 2 * stride + stopDistance + startDistance - u * (startSeconds + loopSeconds)
        : -Infinity
    if (!this.walkingAway()) {
      // 막 걷기 시작해 아직 '걸어가는 중'이 아니어도 멀어지고 있으면 최저선을 지킨다
      return this.userSpeed > USER_WALK_ON_MPS ? Math.max(D + startMargin, floorStart) : D + startMargin
    }
    const lead = clamp(this.userSpeed * startSeconds - startDistance, 0, WALKING_START_LEAD_RATIO * D)
    // 가장 짧은 산책(walk_start + 한 바퀴 + walk_stop) 동안 개가 사용자보다 더 가는 거리가 WALKING_START_ABOVE_STAND_M 보다 크면
    // 그만큼 더 기다린다: 개의 가장 느린 걸음보다 천천히 걸으면 (0.2m/s) 출발할 때마다 지난번보다 가까이 선다
    const gain = startDistance + stride + stopDistance - u * (startSeconds + loopSeconds + stopSeconds)
    const fromStand = Math.max(WALKING_START_MIN_RATIO * D, this.standGap + Math.max(WALKING_START_ABOVE_STAND_M, gain))
    return Math.max(Math.min(D + WALKING_START_MARGIN_M - lead, fromStand), floorStart)
  }


  /**
   * 루프 끝에서 거리 때문에 멈출지 (끝내기·추적 끊김·앞 막힘은 따로). stopNow·oneMore: 지금 멈춤·한 바퀴 더 가고 멈춤일 때 설 거리.
   * 둘 중 D 에 더 가까운 쪽을 고르되,
   * - 크게 도는 중에는 멈추지 않는다: 사용자와 어긋난 채 서고, v/v0 0.6 에서 walk_stop 으로 넘어가 걸음이 툭 빨라진다
   * - walk_start 끝: 사용자가 걸어가는 중이거나 RECENT_WALK_S 안에 그랬으면 (걷다 잠깐 섬) 멈추지 않는다.
   *   한 바퀴 더 가면 D × WALK_START_CLOSE_RATIO 보다 가까워질 때만 예외 (걷다 선 바로 뒤)
   * - 최저선: 사용자가 지금 멈춘다면 한 바퀴 더 가고 설 거리(ifUserStops)가 D × MIN_STOP_RATIO 보다 짧으면 멈춘다
   * - 사용자가 걸어가는 중이면 루프 끝에서도 한 바퀴 더 가면 D × WALKING_STOP_RATIO 보다 가까워질 때만 멈춘다
   *   (아니면 서자마자 다시 출발한다)
   * - 아니면 (섰거나 다가옴) 지금 멈춰도 D + 반 걸음보다 멀면 멈추지 않는다. walk_start 끝에서 바로 멈추는 것은
   *   사용자가 1초 넘게 섰거나 다가올 때다 (선 사용자에게 한 바퀴를 더 가면 D 보다 한 바퀴만큼 가까이 선다)
   */
  private wantsStop(stopNow: number, oneMore: number, ifUserStops: number, ended: WalkClip) {
    const { followDistance: D, stride } = this.spec
    if (this.bigTurn) return false
    const closer = Math.abs(stopNow - D) <= Math.abs(oneMore - D)
    if (ended === 'walk_start' && this.sinceWalking < RECENT_WALK_S && oneMore >= WALK_START_CLOSE_RATIO * D) return false
    if (ifUserStops < this.minStopRatio * D) return true
    // 걸어가는 중에 한 바퀴 더 가면 너무 가까우면 멈춘다. D 에 더 가까운 쪽을 견주지 않는다: 사용자가 개 걸음과 비슷하게 걸으면
    // 둘이 거의 같아 '한 바퀴 더'를 고르고, 그 사이 v/v0 1 로 걸어 사용자에게 붙는다
    if (this.walkingAway()) return ended !== 'walk_start' && oneMore < WALKING_STOP_RATIO * D && stopNow <= D + stride / 2
    return stopNow <= D + stride / 2 && closer
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
    this.standGap = Infinity
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
      // 따라가는 v/v0 로 이 루프를 끝내도 멈출 것 같은지 본다. 지금 v/v0 로 보면, 1 로 올려 둔 탓에 루프 끝 남은 길이 짧아져
      // 최저선에 걸리고, 그래서 또 1 로 두는 것이 되풀이된다 (천천히 걷는 사용자를 따라 걷다 서기)
      const follow = this.followRatio()
      const oneMore = this.liveOneMoreEstimate(follow)
      const { spec } = this
      // 이 루프 끝에서 다른 층 경계 앞이라 멈출지 (루프 끝에 남는 자리가 한 바퀴 + 정지 거리보다 짧음)
      const edgeStop = this.edgeRoom() - clipDistance(spec, 'walk', clock.time, spec.durations.walk) < spec.stride + spec.stopDistance
      const stopLikely =
        this.ending ||
        this.lost ||
        edgeStop ||
        this.wantsStop(this.liveStopEstimate(follow), oneMore, Math.min(oneMore, this.liveOneMoreIfUserStops(follow)), 'walk')
      this.kTarget = this.bigTurn ? BIG_TURN_SPEED_RATIO : this.plan?.last ? this.plan.k : stopLikely ? 1 : follow
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
      this.standingFor = this.stopReason === 'distance' ? 0 : Infinity
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

  /**
   * 따라가는 속도 배율: 사용자 속도에, 남은 길이 지킬 길보다 긴 만큼 CATCH_UP_S 안에 따라잡는 속도를 더한다.
   * 지킬 길 = D + 정지 거리. 사용자가 걸어가는 중이면 최저선 + 한 바퀴 + 정지 거리 + FLOOR_KEEP_EXTRA_M 보다 짧지 않게
   * (루프 끝마다 '사용자가 지금 멈춘다면'이 최저선에 걸리지 않게. 이미 선 사용자에게 다가갈 때는 늦추지 않는다)
   */
  private followRatio() {
    const { v0, followDistance, stopDistance, stride } = this.spec
    const floor = this.minStopRatio > 0 && this.walkingAway() ? this.minStopRatio * followDistance + stride + this.floorKeep : 0
    const keep = Math.max(followDistance, floor) + stopDistance
    const wanted = this.userSpeed + (this.gap - keep) / CATCH_UP_S
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
    // 사용자가 다른 층: 한 바퀴 더 가고 멈추면 경계를 넘으면 지금 멈춘다
    if (!reason && this.edgeRoom() < stride + stopDistance) reason = 'level'
    const stopNow = gap + this.userTravel(stopSeconds) - stopDistance
    const oneMoreK = this.lastLoopRatio(gap)
    const oneMoreSeconds = loopSeconds / oneMoreK + stopSeconds
    const oneMore = gap + this.userTravel(oneMoreSeconds) - stride - stopDistance
    const twoMore = gap + this.userTravel(oneMoreSeconds + loopSeconds) - 2 * stride - stopDistance
    // 사용자가 지금 멈춘다면 (다가오는 중이면 그대로 다가온다고 친 쪽)
    const oneMoreIfUserStops = Math.min(oneMore, gap - stride - stopDistance)
    const choice = reason || this.wantsStop(stopNow, oneMore, oneMoreIfUserStops, ended) ? 'stop' : 'walk'
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
      oneMoreIfUserStops,
      choice,
      last,
      reason,
    })
    if (this.decisions.length > HISTORY) this.decisions.shift()
    return choice === 'stop' ? 'walk_stop' : 'walk'
  }

  /**
   * 앞으로 seconds 동안 사용자가 길을 따라 더 갈 거리 (다가오면 −).
   * 걸어가는 중이면 지금 속도로 계속 간다고, 아니면 (멈추는 중·막 걷기 시작함) 곧 선다고 친다
   */
  private userTravel(seconds: number) {
    const u = this.userSpeed
    if (u <= 0 || this.walkingAway()) return u * seconds
    return Math.min(u * seconds, (u * u) / (2 * USER_STOP_DECEL))
  }

  /**
   * 마지막 루프의 v/v0. 사용자가 서 있거나 멈추는 중이면 1 (한 바퀴 거리는 속도와 상관없고, walk_stop 이 자연 속도에서 시작한다).
   * 걷고 있으면 그 사이 사용자가 가는 거리까지 쳐서 D 에 서도록 루프 시간을 맞춘다
   */
  private lastLoopRatio(gap: number) {
    const u = this.userSpeed
    if (!this.walkingAway() && u > -USER_APPROACH_MPS) return 1
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

  /** 다음 루프 끝에서 멈추면 설 거리 (남은 루프를 v/v0 k 로) */
  private liveStopEstimate(k = this.k) {
    const { spec, clock } = this
    const rate = clock.rate(k)
    const left = spec.durations[clock.clip] - clock.time
    const ahead = clipDistance(spec, clock.clip, clock.time, spec.durations[clock.clip])
    if (clock.clip === 'walk_stop') return this.gap - ahead + this.userTravel(left / rate)
    return this.gap - ahead - spec.stopDistance + this.userTravel(left / rate + spec.stopSeconds)
  }

  /** 이번 walk 루프 끝에서 한 바퀴 더 가고 멈추면 설 거리 (지금 v/v0 로) */
  private liveOneMoreEstimate(k = this.k) {
    const { spec, clock } = this
    const left = (spec.durations.walk - clock.time) / clock.rate(k)
    // 루프 끝 판단(decide)과 같은 v/v0 로 한 바퀴 더를 친다 (다르면 여기서는 멈출 것 같아 v/v0 를 1 로 올리고, 판단에서는 한 바퀴 더를 고른다)
    const ahead = clipDistance(spec, 'walk', clock.time, spec.durations.walk)
    const more = spec.loopSeconds / this.lastLoopRatio(this.gap - ahead)
    return this.liveStopEstimate(k) - spec.stride + this.userTravel(left + more + spec.stopSeconds) - this.userTravel(left + spec.stopSeconds)
  }

  /** 이번 walk 루프 끝(v/v0 k 로)에서 판단할 때 '사용자가 지금 멈춘다면 한 바퀴 더 가고 설 거리' (루프 끝까지는 사용자가 지금처럼 간다) */
  private liveOneMoreIfUserStops(k = this.k) {
    const { spec, clock } = this
    const left = (spec.durations.walk - clock.time) / clock.rate(k)
    const ahead = clipDistance(spec, 'walk', clock.time, spec.durations.walk)
    return this.gap - ahead + this.userTravel(left) - spec.stride - spec.stopDistance
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
    const edge = this.trail.edgeDistance()
    const lines = [
      `산책 ${this.phase}${this.ending ? ' · 끝내는 중' : ''}${this.lost ? ' · 추적 끊김' : ''}${this.notice === 'slowDown' ? ' · 천천히' : this.notice === 'otherLevel' ? ' · 다른 층' : ''} · ${this.bouts}번째 출발 · 루프 ${walking ? clock.loop : '-'} · floor ${this.minStopRatio > 0 ? this.minStopRatio.toFixed(2) : '끔'} · keep ${this.floorKeep.toFixed(2)}m · tight ${(spec.tightTurnRadius / spec.bodyLength).toFixed(2)}`,
      `s ${spec.scale.toFixed(4)} (${spec.scaleSource === 'root' ? '루트 배율' : '모델 크기÷ref'}) · v0 ${spec.v0.toFixed(3)}m/s · r0 ${spec.r0.toFixed(3)} · extras ${spec.extrasSource}`,
      `v/v0 ${this.k.toFixed(2)}→${this.kTarget.toFixed(2)}${this.plan?.last ? ' (마지막 루프)' : ''} · timeScale ${timeScale.toFixed(3)} · 속도 ${(walking ? clock.speed(this.k) : 0).toFixed(2)}m/s`,
      `한 바퀴 ${spec.stride.toFixed(3)}m/${spec.loopSeconds.toFixed(3)}s · 출발 ${spec.startDistance.toFixed(3)}m · 정지 ${spec.stopDistance.toFixed(3)}m/${spec.stopSeconds.toFixed(2)}s`,
      `사용자까지 ${this.gap.toFixed(2)}m (직선 ${straight.toFixed(2)}) · D ${D.toFixed(2)} · 출발 ${this.startThreshold().toFixed(2)}m${this.standingFor < MIN_STAND_S ? ' (서 있는 중)' : ''}`,
      `사용자 속도 ${this.userSpeed.toFixed(2)}m/s (${this.walkingAway() ? '걸어가는 중' : this.userWalking ? '느려지는 중' : this.userSpeed < -USER_WALK_OFF_MPS ? '다가옴' : '서 있음'})`,
      `발자취 ${this.trail.count}점 · 겨누는 점 ${spec.lookAhead.toFixed(2)}m 앞 · 발자취에서 벗어남 ${this.trail.offset.toFixed(2)}m (최대 ${this.maxOffTrail.toFixed(2)})`,
      `사용자 층 ${LEVEL_LABEL[this.level.state]} · 카메라 높이 차 ${signed(this.level.offset)}m (기준 ${this.level.reference?.toFixed(2) ?? '-'}m)${this.level.rising ? ' · 높이 바뀌는 중' : ''}${edge !== null ? ` · 경계까지 ${edge.toFixed(2)}m (개가 더 갈 자리 ${this.edgeRoom().toFixed(2)})` : ''}`,
      `바닥 y ${this.position.y.toFixed(3)} (따라갈 층 ${this.floorTarget.toFixed(3)})`,
      live !== null ? `다음 루프 끝에 멈추면 ${live.toFixed(2)}m (D ${signed(live - D)})` : '다음 루프 끝 -',
      decision
        ? `지난 판단 ${decision.ended} 끝: 지금 멈춤 ${decision.stopNow.toFixed(2)} (${signed(decision.stopNow - D)}) · 한 바퀴 더 ${decision.oneMore.toFixed(2)} (${signed(decision.oneMore - D)}, v/v0 ${decision.oneMoreK.toFixed(2)}) · 사용자 멈추면 한 바퀴 더 ${decision.oneMoreIfUserStops.toFixed(2)} (최저 ${this.minStopRatio > 0 ? (this.minStopRatio * D).toFixed(2) : '끔'}) → ${decision.choice === 'stop' ? '멈춤' : decision.last ? '한 바퀴 더(마지막)' : '계속'}${decision.reason ? ` (${decision.reason})` : ''}`
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
        userWalking: this.walkingAway(),
        startAt: this.startThreshold(),
        yawRate: this.yawRate,
        maxYawRate: this.maxYawRate,
        bigTurn: this.bigTurn,
        trailPoints: this.trail.count,
        trail: this.trail.ahead,
        aim: this.aim,
        offTrail: this.trail.offset,
        maxOffTrail: this.maxOffTrail,
        level: { state: this.level.state, offset: this.level.offset, rising: this.level.rising, edge },
        decisions: this.decisions,
        stops: this.stops,
      },
    })
  }
}

const signed = (value: number) => `${value >= 0 ? '+' : ''}${value.toFixed(2)}`
const LEVEL_LABEL: Record<number, string> = { 0: '같은 층', 1: '위', [-1]: '아래' }
