import type { Vec3 } from '../placement/types'
import {
  BODY_TURN_BEHIND_DEG,
  BODY_TURN_BEHIND_S,
  BODY_TURN_COOLDOWN_S,
  BODY_TURN_GRACE_S,
  BODY_TURN_MIN_M,
  BODY_TURN_S,
  CLOSE_SIT_DEFAULT,
  CLOSE_SIT_M,
  CLOSE_SIT_S,
  CLOSE_STAND_M,
  CLOSE_STAND_S,
  GAZE_ANGLE_TAU_S,
  GAZE_APPROACH_M,
  GAZE_AWAY_MEAN_S,
  GAZE_BEHIND_HOLD_DEG,
  GAZE_CLIP_WEIGHT,
  GAZE_GIVE_UP_S,
  GAZE_JAW_CLIPS,
  GAZE_LOOK_MEAN_S,
  GAZE_LOOP_CLIPS,
  GAZE_MAX_SPEED_DEG,
  GAZE_MOVE_OFF_MPS,
  GAZE_MOVE_ON_MPS,
  GAZE_NEAR_M,
  GAZE_OVERHEAD_DRIFT_DEG,
  GAZE_OVERHEAD_ENTER_M,
  GAZE_OVERHEAD_EXIT_M,
  GAZE_OVERHEAD_RELEASE_S,
  GAZE_REACTION_S,
  GAZE_SPEED_TAU_S,
  GAZE_SPREAD,
  GAZE_STILL_AWAY_SCALE,
  GAZE_STILL_LONG_S,
  GAZE_STILL_LOOK_SCALE,
  GAZE_STILL_MPS,
  GAZE_STUCK_EDGE_DEG,
  GAZE_STUCK_INSIDE_DEG,
  GAZE_STUCK_S,
  GAZE_TRIGGER_HOLD_S,
  GAZE_WALK_AWAY_MEAN_S,
  GAZE_WALK_LOOK_MEAN_S,
  GAZE_WEIGHT_IN_S,
  GAZE_WEIGHT_OUT_S,
  GAZE_WEIGHT_RELEASE_S,
  gazeJaw,
  gazeLimits,
  isTurnClip,
  type GazeTuning,
} from './gazeSpec'

// 고개 바라보기 판단. 렌더러를 모른다: 렌더 쪽(GazeRig)이 잰 눈 위치·개 방향·지금 클립과 카메라를 받아
// 머리가 볼 방향(몸 기준 yaw·pitch)과 세기(weight)를 돌려준다. 뼈를 돌리는 일은 ../neckAim.ts

export type GazePose = 'stand' | 'sit' | 'down'

/** 렌더 쪽에서 잰 이번 자세 */
export interface GazeSample {
  /** 두 눈 가운데 (월드, 고개를 돌린 뒤) */
  eye: Vec3
  /** 개 발밑 (pivot, 월드) */
  root: Vec3
  /** 개 방향 (rad). 앞 = (sin yaw, cos yaw) */
  yaw: number
  /** 지금 자세를 만든 클립. 모르면 null */
  clip: string | null
}

export interface GazeInput {
  /** XR 프레임 시각 (ms) */
  time: number
  camera: Vec3
  /** false 면 카메라 위치가 추정값이라 목표·움직임을 그대로 둔다 */
  tracking: boolean
  sample: GazeSample | null
  /** 명령·반응을 재생하거나 기다리는 중 */
  busy: boolean
  pose: GazePose
  /** 산책 모드 (걷는 중이면 바라보기를 짧고 드물게) */
  walking: boolean
  /** 몸 돌리기를 맡길 곳이 있는지 (제자리 회전 클립이 있고, 산책 중이면 서 있는 단계) */
  canTurn: boolean
  /**
   * need (rad) 만큼 돌 수 있는지: 회전 클립이 쓸고 지나가는 바닥 자리와 사용자 발이 겹치지 않으면 ok, 그 클립.
   * 겹치면 다른 클립(남는 각이 줄어드는 것)도 본다 (StandTurn.plan). 없거나 null 이면 개 발밑에서 BODY_TURN_MIN_M 안이면 못 돎
   */
  turnCheck?: (need: number) => GazeTurnCheck | null
}

export interface GazeTurnCheck {
  ok: boolean
  /** 돌 클립 (onTurn 에 넘긴다). 막혔으면 처음 고른 클립 */
  clip: string | null
  /** 막힌 까닭 */
  reason: string | null
}

/** 머리가 볼 방향 (몸 기준 rad, yaw + 왼쪽, pitch + 위) 과 세기 0~1. weight 0 이면 원래 자세 그대로 */
export interface GazeCommand {
  yaw: number
  pitch: number
  weight: number
  /**
   * 턱 남기는 비율 0~1 (1 = 루프 그대로, 0 = 쉼 자세로 입 다묾). 대기 루프에서 위로 든 만큼만 1 아래로.
   * weight 0 이거나 수평·아래면 정확히 1
   */
  jaw: number
}

/** 바로 바라보는 계기 */
export type GazeTrigger = 'tap' | 'mic' | 'move' | 'approach' | 'clipEnd' | 'back'

export const GAZE_TRIGGER_LABEL: Record<GazeTrigger, string> = {
  tap: '톡',
  mic: '마이크',
  move: '움직이기 시작',
  approach: '다가옴',
  clipEnd: '동작 끝',
  back: '한계 안으로',
}

export interface GazeDebug {
  /** look 보는 중 · react 반응 늦춤 · away 딴청 · out 한계 밖 포기 · hold 동작 세기 0 · off 꺼짐 */
  state: 'look' | 'react' | 'away' | 'out' | 'hold' | 'off'
  offReason: string | null
  /** 목표 (한계 안, °) · 원래 각 (°). 모르면 null */
  yaw: number | null
  pitch: number | null
  rawYaw: number | null
  rawPitch: number | null
  weight: number
  /** 턱 남기는 비율 (1 = 루프 그대로) */
  jaw: number
  clip: string | null
  /** 다음에 보기·딴청이 바뀔 때까지 (s) */
  nextIn: number | null
  /** 좌우 한계 밖에 있은 시간 (s) */
  outFor: number
  /** 몸 돌리기까지 남은 시간 (s). 기다리는 중이 아니면 null */
  bodyTurnIn: number | null
  /** 기다리는 시간의 기준: 개 몸 기준 사용자 각 (°) · 그 각에서 기다릴 시간 (s) */
  bodyTurnAngle: number | null
  bodyTurnWait: number | null
  /** 잠깐 범위 안 (s, BODY_TURN_GRACE_S 안이면 이어서 센다). 아니면 null */
  bodyTurnGrace: number | null
  /** 몸 돌리기를 하지 않는 까닭 (돌 수 있으면 null) */
  bodyTurnBlock: string | null
  /** 가까움: 머리 위 안정화 · 앉음 대기 · 스스로 앉음 등. 없으면 null */
  near: string | null
  /** 앉거나 엎드린 까닭 (스스로 = ?closesit, 명령). 서 있으면 null */
  sitReason: '스스로' | '명령' | null
  /** 지금 자세 (sitReason 표시용) */
  pose: GazePose
  /** 몸 돌려 따라보기 (꺼지면 몸 돌리기·가까이 앉기·일어나기 없이 고개만) */
  follow: boolean
  /** 눈에서 카메라까지 수평 거리 (m). 모르면 null */
  horizontal: number | null
  /** 이상 경고 (원래 yaw 는 한계 안인데 목표 yaw 가 한계에 붙어 있음 등). 없으면 null */
  warn: string | null

  lastTrigger: GazeTrigger | null
  /** 오래 가만히 (바라보기 짧게·딴청 길게) */
  still: boolean
}

interface TurnBlock {
  reason: string
  /** 곧 풀리지 않는 까닭 (앉음·명령 중·회전 클립 없음·너무 가까움 등) */
  hard: boolean
}

export interface GazeControllerOptions {
  /** 템플릿 이름 (템플릿별 한계, gazeSpec GAZE_LIMITS_BY_TEMPLATE) */
  template?: string | null
  tuning?: GazeTuning
  /** 몸 돌리기 요청. 받아서 돌기 시작했으면 true. need = 개 정면에서 사용자까지 각 (rad, + 왼쪽) */
  onTurn?: (need: number, reason: string, clip: string | null) => boolean
  /** 가까이 붙으면 앉기·물러나면 일어나기 요청 (?closesit). 받아서 시작했으면 true */
  onPose?: (pose: 'sit' | 'stand', reason: string) => boolean
  /** 몸 돌려 따라보기 처음 상태 (기본 켜짐). 바꾸기는 setFollow */
  follow?: boolean
  /** 0~1 (시험·가짜 스테이지용). 없으면 Math.random */
  random?: () => number
}

const RAD = Math.PI / 180
const toDeg = (radians: number) => radians / RAD
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))
const wrapAngle = (angle: number) => Math.atan2(Math.sin(angle), Math.cos(angle))
const smoothstep = (x: number) => x * x * (3 - 2 * x)
/** 프레임 사이가 이보다 길면 이만큼으로 자른다 (s) */
const MAX_FRAME_S = 0.1
/** 회전 요청을 거절당하면 이만큼(s) 뒤 다시 묻는다 */
const BODY_TURN_RETRY_S = 1
/** 돌려고 일어났는데 사용자가 쓸고 지나가는 자리에 있으면 선 채 이만큼(s) 기다린다 */
const STAND_TURN_WAIT_S = 3
/** 회전 요청 뒤 이만큼(s) 지나도 회전 클립이 안 보이면 기다림을 푼다 */
const TURN_START_TIMEOUT_S = 1
/** 포기한 고개를 다시 한계로 (몸 돌리기를 기다림) 되돌리려면 돌 수 있는 상태가 이만큼(s) 이어져야 한다 (막힘이 깜빡일 때 포기·보기가 번갈지 않게) */
const UNGIVE_UP_S = 0.3
/** 턱 남기는 비율이 1 에 이만큼 가까우면 1 (건드리지 않음) */
const JAW_SNAP = 1e-3

/**
 * 고개 바라보기 (계속 보지 않게):
 * - 바라보기 3~6초 ↔ 딴청 2~4초를 번갈아 (딴청 = weight 0, 원래 동작대로 앞을 본다). 바라보기는 0.2~0.4초 늦게 시작한다
 * - 바로 바라보는 계기: 사용자가 움직이기 시작 (수평 0.3m/s) · 0.5m 넘게 다가옴 · 톡 · 마이크 · 1회 동작이 끝나 루프로 돌아옴.
 *   이미 보는 중이면 적어도 1.5초 더 본다
 * - 사용자가 10초 넘게 거의 안 움직이면 바라보기를 반으로·딴청을 1.75배로
 * - 좌우 한계 밖이면 한계까지만 돌린다. 몸을 돌 수 있으면 그대로 한계에 둔 채 몸 돌리기를 기다리고, 돌 수 없으면
 *   (앉기·엎드리기·회전 클립 없음·명령 중·0.5 m 안·회전 요청을 거절당함) 1.5초 넘게 밖이면 포기 (weight 0). 다시 들어오면 계기.
 *   위·아래는 한계까지만 (포기하지 않는다: 개 바로 옆에 선 사용자를 끝까지 올려다본다)
 * - 머리 위 가까이 (눈에서 폰까지 수평 0.25 m 안): 좌우 목표를 그 순간 사용자 쪽 (월드 방향) 에 고정. 0.35 m 밖이거나 세기 0 인
 *   클립(회전·자세 전환)이 시작되거나 사용자 쪽이 고정값에서 30° 넘게 옮겨 가면 0.6초 동안 풀어 사용자 쪽으로, 세기 0 인 클립
 *   동안은 켜지 않는다. 고정된 동안 한계 밖·몸 돌리기 시간은 멈춘다
 * - 사용자가 거의 바로 뒤 (150° 밖) 면 좌우 한계 중 지금 쪽을 그대로 둔다 (뒤를 가로질러도 +70°↔−70° 로 휙 넘어가지 않게)
 * - 세기는 클립별 (GAZE_CLIP_WEIGHT): 0 인 클립(짖기·전환·walk_start·회전 등)이면 0.2초 안에 풀고 끝나면 다시 본다
 * - 몸 돌리기: 서기 루프만 돌 때 (명령 없음·서 있음) 사용자가 좌우 한계 밖이면 기다렸다가 onTurn 으로 제자리 회전을 맡긴다.
 *   기다리는 시간은 몸 기준 사용자 각 70° 이하 1.5초 ~ 120° 이상 0.6초 (선형, 진행률로 센다). 0.5초 안에 잠깐 범위 안으로
 *   들어왔다 나가면 이어서 센다. 회전 클립이 끝나면 2초 동안은 돌지 않는다 (기다리는 시간은 센다)
 * - 가까이 앉기 (?closesit): 서 있는 개 0.6 m 안에 2초 → 스스로 앉아 올려다봄, 스스로 앉았으면 1 m 밖 2초 → 일어남
 * - 따라보기 (setFollow, 기본 켜짐): 끄면 몸 돌리기·가까이 앉기·일어나기를 하지 않고 고개만 (한계 밖이면 1.5초 뒤 포기).
 *   켜는 순간 한계 밖이면 기다림 없이 바로 돌기를 시도한다
 * - 턱: 대기 루프(서기·앉기·엎드리기)의 헥헥거림을 위로 든 만큼 줄인다 (GAZE_JAW, 위 30° 에서 남기는 비율 0.3).
 *   수평·아래를 볼 때는 그대로
 */
export class GazeController {
  private readonly options: GazeControllerOptions
  private readonly random: () => number
  private readonly yawLimit: number
  private readonly upLimit: number
  private readonly downLimit: number
  private readonly lookMean: number
  private readonly awayMean: number
  private readonly bodyTurnS: number
  private readonly closeSit: boolean
  /** 턱: 위로 fullUp 이상 들었을 때 남기는 비율 · 그 각 (rad) */
  private readonly jawKeep: number
  private readonly jawFullUp: number
  private lastTime: number | null = null
  /** 처음부터 흐른 시간 (s) */
  private now = 0
  private mode: 'look' | 'away' = 'away'
  /** 지금 보기·딴청이 끝나는 때 (s). 처음 프레임에 바로 바라보기를 시작한다 */
  private modeUntil = 0
  /** 반응 늦춤이 끝나는 때 (s) */
  private lookFrom = 0
  private rawYaw: number | null = null
  private rawPitch: number | null = null
  private yaw = 0
  private pitch = 0
  private yawSpeed = 0
  private pitchSpeed = 0
  private angleReady = false
  private weight = 0
  private ramp: { from: number; to: number; start: number; duration: number } | null = null
  private speed = 0
  private moving = false
  private stillFor = 0
  private lastCamera: Vec3 | null = null
  /** 마지막 다가옴 계기 뒤 가장 멀었던 거리 (m) */
  private farthest = 0
  private outFor = 0
  private gaveUp = false
  /** 한계 밖에서 몸 돌리기를 기다릴 수 있는 상태가 이어진 시간 (s) */
  private holdFor = 0
  /** 이 때까지는 몸을 돌리지 않는다 (s) */
  private turnCooldownUntil = -Infinity
  /** 몸 돌리기 진행률 0~1 (dt / 기다릴 시간 을 더한다) */
  private turnProgress = 0
  /** 기다리는 중 잠깐 범위 안에 있은 시간 (s) */
  private inFor = 0
  /** 몸 돌리기를 요청했는데 거절당함 (범위 안으로 돌아올 때까지 포기 허용) */
  private turnRefused = false
  private turnRefusedAt: number | null = null
  /** 머리 위 안정화: on 고정 · release 푸는 중 */
  private overhead: 'on' | 'release' | null = null
  /** 고정한 사용자 쪽 (월드 yaw, rad: 한계로 자른 몸 기준 값 + 그때 개 방향) */
  private overheadWorldYaw = 0
  private overheadFrom = 0
  /** 눈에서 카메라까지 수평 거리 (m, 추적 중일 때 갱신) */
  private horizontal: number | null = null
  /** 원래 yaw 는 한계 안인데 목표 yaw 가 한계에 붙어 있은 시간 (s) */
  private stuckFor = 0
  /** 좌우 한계 밖일 때 고개를 둔 쪽 (+1 왼쪽, −1 오른쪽, 0 한계 안) */
  private outSide = 0
  /** 가까이 앉기: 스스로 앉음 · 다시 앉을 수 있음 (명령 뒤 물러날 때까지 false) · 가까이·멀리 있은 시간 (s) */
  private selfSat = false
  private closeSitArmed = true
  private closeFor = 0
  private farFor = 0
  /** 스스로 앉은 채 몸을 돌려야 해서 일어나는 중 (서면 바로 돈다) */
  private standToTurn = false
  /** 스스로 앉았다가 돌려고 일어남: 회전이 끝나면 사용자가 아직 가까우면 바로 다시 앉는다 */
  private resitAfterTurn = false
  /** 돌려고 일어나 선 때 (s) · 선 채 기다리는 까닭 */
  private standReadyAt: number | null = null
  private standWaitReason: string | null = null
  /** 이번 프레임 turnCheck 가 고른 클립 (돌 수 있을 때) */
  private turnClip: string | null = null
  /** 회전 요청이 받아들여져 회전 클립이 끝나기를 기다리는 중 (요청 시각, s) */
  private turnRequestedAt: number | null = null
  /** 몸 돌려 따라보기 (꺼지면 고개만: 몸 돌리기·스스로 앉기·일어나기 없음) */
  private followOn: boolean
  /** 따라보기를 막 켬: 다음 update 에서 사용자가 좌우 한계 밖이면 기다림 없이 바로 돌기를 시도한다 */
  private followKick = false
  private lastClip: string | null = null
  private readonly pending: GazeTrigger[] = []
  private lastTrigger: GazeTrigger | null = null
  private snapshot: GazeDebug = {
    state: 'off',
    offReason: '시작 전',
    yaw: null,
    pitch: null,
    rawYaw: null,
    rawPitch: null,
    weight: 0,
    jaw: 1,
    clip: null,
    nextIn: null,
    outFor: 0,
    bodyTurnIn: null,
    bodyTurnAngle: null,
    bodyTurnWait: null,
    bodyTurnGrace: null,
    bodyTurnBlock: null,
    near: null,
    sitReason: null,
    pose: 'stand',
    follow: true,
    horizontal: null,
    warn: null,
    lastTrigger: null,
    still: false,
  }

  constructor(options: GazeControllerOptions = {}) {
    this.options = options
    this.random = options.random ?? Math.random
    const limits = gazeLimits(options.template)
    const tuning = options.tuning ?? {}
    this.yawLimit = (tuning.yawDeg ?? limits.yawDeg) * RAD
    this.upLimit = (tuning.upDeg ?? limits.upDeg) * RAD
    this.downLimit = limits.downDeg * RAD
    this.lookMean = tuning.lookMeanS ?? GAZE_LOOK_MEAN_S
    this.awayMean = tuning.awayMeanS ?? GAZE_AWAY_MEAN_S
    this.bodyTurnS = tuning.bodyTurnS ?? BODY_TURN_S
    this.closeSit = tuning.closeSit ?? CLOSE_SIT_DEFAULT
    this.followOn = options.follow ?? true
    this.snapshot.follow = this.followOn
    const jaw = gazeJaw(options.template)
    this.jawKeep = clamp(tuning.jawKeep ?? jaw.keep, 0, 1)
    this.jawFullUp = Math.max(1, tuning.jawFullUpDeg ?? jaw.fullUpDeg) * RAD
  }

  /** 바로 바라보는 계기 (톡·마이크). 다음 update 에서 반영한다 */
  trigger(kind: GazeTrigger) {
    this.pending.push(kind)
  }

  /** 사용자가 명령을 내림: '스스로 앉음' 을 지우고, 1 m 밖으로 한 번 물러날 때까지 스스로 앉지 않는다 */
  userCommand() {
    this.selfSat = false
    this.endStandToTurn()
    this.resitAfterTurn = false
    this.closeSitArmed = false
    this.closeFor = 0
    this.farFor = 0
  }

  /**
   * 몸 돌려 따라보기 켜고 끄기. 끄면 몸 돌리기·스스로 앉기·일어나기를 하지 않는다 (이미 스스로 앉았으면 그대로 앉아 있고,
   * 도는 중인 회전은 끝까지 간다). 켜는 순간 사용자가 좌우 한계 밖이면 기다림 없이 바로 돌기를 시도한다
   */
  setFollow(on: boolean) {
    if (on === this.followOn) return
    this.followOn = on
    this.snapshot = { ...this.snapshot, follow: on }
    this.closeFor = 0
    this.farFor = 0
    this.turnProgress = 0
    this.inFor = 0
    this.turnRefused = false
    this.turnRefusedAt = null
    if (on) {
      this.followKick = true
      // 회전이 이미 시작됐으면 그 쉼은 그대로
      if (this.turnRequestedAt === null) this.turnCooldownUntil = -Infinity
    } else {
      this.followKick = false
      // 돌려고 일어나는 중이었으면 돌지 않는다 (resitAfterTurn: 서고 나서 아직 가까우면 다시 앉아 원래 자세로)
      this.endStandToTurn()
    }
  }

  get following(): boolean {
    return this.followOn
  }

  get debug(): GazeDebug {
    return this.snapshot
  }

  /** 꺼짐 (놓기 전·?gaze=0 등). 고개는 원래 자세로 (null), 다시 켜지면 처음처럼 바로 바라본다 */
  off(reason: string): null {
    this.lastTime = null
    this.weight = 0
    this.ramp = null
    this.angleReady = false
    this.mode = 'away'
    this.modeUntil = 0
    this.outFor = 0
    this.gaveUp = false
    this.turnProgress = 0
    this.inFor = 0
    this.turnRefused = false
    this.turnRefusedAt = null
    this.overhead = null
    this.horizontal = null
    this.stuckFor = 0
    this.outSide = 0
    this.closeFor = 0
    this.farFor = 0
    this.endStandToTurn()
    this.turnRequestedAt = null
    this.lastCamera = null
    this.lastClip = null
    this.pending.length = 0
    this.snapshot = {
      ...this.snapshot,
      state: 'off',
      offReason: reason,
      weight: 0,
      jaw: 1,
      bodyTurnIn: null,
      bodyTurnGrace: null,
      near: null,
      nextIn: null,
    }
    return null
  }

  update(input: GazeInput): GazeCommand | null {
    const { sample } = input
    if (!sample) return this.off('뼈 자세를 아직 못 읽음')
    const rawDt = this.lastTime === null ? 0 : (input.time - this.lastTime) / 1000
    this.lastTime = input.time
    const dt = clamp(rawDt, 0, MAX_FRAME_S)
    this.now += dt
    const { now } = this

    this.watchUser(input, sample, dt)
    this.watchClip(sample.clip)
    // 몸을 돌 수 있으면 한계 밖이어도 고개를 포기하지 않는다
    const turnedAfterStand = this.standThenTurn(input, sample)
    const block = this.turnBlock(input, sample)
    const outOfRange = this.aim(input, sample, dt, !block?.hard && !this.turnRefused)
    this.watchStuck(dt)
    this.schedule(input)

    const clipWeight = sample.clip ? (GAZE_CLIP_WEIGHT[sample.clip] ?? 0) : 0
    const looking = this.mode === 'look' && now >= this.lookFrom && !this.gaveUp && this.rawYaw !== null
    this.follow(looking ? clipWeight : 0, clipWeight === 0)

    const turn = turnedAfterStand
      ? { waitFor: null, angle: null, wait: null, grace: null, block: '일어나서 도는 중', started: true }
      : this.bodyTurn(input, sample, outOfRange, block, dt)
    const sit = turn.started ? this.describeCloseSit() : this.closeSitStep(input, sample, dt)
    this.followKick = false
    const jaw = this.jaw(sample.clip)
    this.snapshot = {
      state: this.gaveUp
        ? 'out'
        : this.mode === 'away'
          ? 'away'
          : now < this.lookFrom
            ? 'react'
            : clipWeight === 0
              ? 'hold'
              : 'look',
      offReason: null,
      yaw: this.angleReady ? toDeg(this.yaw) : null,
      pitch: this.angleReady ? toDeg(this.pitch) : null,
      rawYaw: this.rawYaw === null ? null : toDeg(this.rawYaw),
      rawPitch: this.rawPitch === null ? null : toDeg(this.rawPitch),
      weight: this.weight,
      jaw,
      clip: sample.clip,
      nextIn: Math.max(0, this.modeUntil - now),
      outFor: this.outFor,
      bodyTurnIn: turn.waitFor,
      bodyTurnAngle: turn.angle,
      bodyTurnWait: turn.wait,
      bodyTurnGrace: turn.grace,
      bodyTurnBlock: turn.block,
      near:
        [this.overhead === 'on' ? '머리 위 안정화' : this.overhead === 'release' ? '안정화 푸는 중' : null, sit]
          .filter(Boolean)
          .join(' · ') || null,
      sitReason: input.pose === 'stand' ? null : this.selfSat ? '스스로' : '명령',
      pose: input.pose,
      follow: this.followOn,
      horizontal: this.horizontal,
      warn:
        this.stuckFor > GAZE_STUCK_S ? `목표 yaw 가 한계에 붙음 (원래 yaw 는 한계 안, ${this.stuckFor.toFixed(1)}초)` : null,
      lastTrigger: this.lastTrigger,
      still: this.stillFor > GAZE_STILL_LONG_S,
    }
    return this.angleReady ? { yaw: this.yaw, pitch: this.pitch, weight: this.weight, jaw } : null
  }

  /** 턱 남기는 비율: 대기 루프에서 1 − weight × 위로 든 정도 × (1 − keep). 수평·아래·weight 0 이면 정확히 1 */
  private jaw(clip: string | null): number {
    if (!clip || !GAZE_JAW_CLIPS.has(clip) || !this.angleReady || !(this.weight > 0) || !(this.pitch > 0)) return 1
    const up = Math.min(1, this.pitch / this.jawFullUp)
    const jaw = 1 - this.weight * up * (1 - this.jawKeep)
    // 고개가 수평으로 돌아오는 동안 pitch 는 0 에 다가가기만 한다: 거의 1 이면 1 (턱 0.02° 안, 루프와 비트까지 같게)
    return jaw > 1 - JAW_SNAP ? 1 : jaw
  }

  /** 사용자 움직임: 움직이기 시작·다가옴 계기, 오래 가만히 */
  private watchUser(input: GazeInput, sample: GazeSample, dt: number) {
    const { camera } = input
    if (!input.tracking) {
      this.lastCamera = null
      return
    }
    if (this.lastCamera && dt > 0) {
      const v = Math.hypot(camera.x - this.lastCamera.x, camera.z - this.lastCamera.z) / dt
      this.speed += (v - this.speed) * (1 - Math.exp(-dt / GAZE_SPEED_TAU_S))
    }
    this.lastCamera = { ...camera }
    if (!this.moving && this.speed > GAZE_MOVE_ON_MPS) {
      this.moving = true
      this.trigger('move')
    } else if (this.moving && this.speed < GAZE_MOVE_OFF_MPS) {
      this.moving = false
    }
    this.stillFor = this.speed < GAZE_STILL_MPS ? this.stillFor + dt : 0
    const distance = Math.hypot(camera.x - sample.root.x, camera.z - sample.root.z)
    this.farthest = Math.max(this.farthest, distance)
    if (this.farthest - distance > GAZE_APPROACH_M) {
      this.trigger('approach')
      this.farthest = distance
    }
  }

  /** 1회 동작이 루프로 돌아오면 계기, 회전 클립이 끝나면 몸 돌리기 쉼 */
  private watchClip(clip: string | null) {
    const last = this.lastClip
    if (clip === last) return
    if (last !== null && !GAZE_LOOP_CLIPS.has(last) && clip !== null && GAZE_LOOP_CLIPS.has(clip)) this.trigger('clipEnd')
    if (isTurnClip(last) && !isTurnClip(clip)) {
      this.turnCooldownUntil = this.now + BODY_TURN_COOLDOWN_S
      this.outFor = 0
      this.gaveUp = false
      this.turnProgress = 0
      this.inFor = 0
      this.turnRequestedAt = null
    }
    this.lastClip = clip
  }

  /**
   * 눈에서 카메라까지 방향 (몸 기준) → 한계 안 목표로 각을 따라간다. 좌우 한계 밖이면 true (머리 위 안정화 중이면 false).
   * holdForTurn 이면 한계 밖에서도 포기하지 않는다 (몸 돌리기를 기다린다)
   */
  private aim(input: GazeInput, sample: GazeSample, dt: number, holdForTurn: boolean): boolean {
    const { camera } = input
    const { eye } = sample
    const dx = camera.x - eye.x
    const dz = camera.z - eye.z
    const horizontal = Math.hypot(dx, dz)
    if (input.tracking) this.horizontal = horizontal
    if (input.tracking && horizontal >= GAZE_NEAR_M) {
      this.rawYaw = wrapAngle(Math.atan2(dx, dz) - sample.yaw)
      this.rawPitch = Math.atan2(camera.y - eye.y, horizontal)
    }
    if (this.rawYaw === null || this.rawPitch === null) return false
    // 좌우 한계로 자른 사용자 쪽. 거의 바로 뒤면 지금 쪽을 그대로 (뒤를 가로질러도 반대 한계로 휙 넘어가지 않게)
    let userYaw = clamp(this.rawYaw, -this.yawLimit, this.yawLimit)
    if (Math.abs(this.rawYaw) > this.yawLimit) {
      const side = Math.sign(this.rawYaw)
      if (this.outSide !== 0 && side !== this.outSide && Math.abs(this.rawYaw) > Math.PI - GAZE_BEHIND_HOLD_DEG * RAD) {
        userYaw = this.outSide * this.yawLimit
      } else {
        this.outSide = side
      }
    } else {
      this.outSide = 0
    }
    // 머리 위 가까이: 좌우 목표를 고정 (폰을 조금 흔들어도 고개가 휙휙 돌지 않게). 세기 0 인 클립(회전·자세 전환 등)은 몸이 움직여
    // 고정한 방향이 뜻을 잃으니 풀고, 그동안은 켜지 않는다 (끝나면 새 몸 기준으로 다시 판단)
    const bodyMoving = !(sample.clip && (GAZE_CLIP_WEIGHT[sample.clip] ?? 0) > 0)
    if (this.overhead !== 'on' && !bodyMoving && input.tracking && horizontal < GAZE_OVERHEAD_ENTER_M) {
      this.overhead = 'on'
      // 그 순간의 목표 (머리 위로 들어오는 길의 사용자 쪽). 고개는 거기까지 부드럽게 간 뒤 멈춘다
      this.overheadWorldYaw = userYaw + sample.yaw
    } else if (
      this.overhead === 'on' &&
      (bodyMoving ||
        (input.tracking && horizontal > GAZE_OVERHEAD_EXIT_M) ||
        // 방향을 믿을 만한 거리에서 사용자가 고정한 쪽에서 크게 옮겨 감 (옆 → 앞 등)
        (input.tracking &&
          horizontal >= GAZE_NEAR_M &&
          Math.abs(wrapAngle(userYaw + sample.yaw - this.overheadWorldYaw)) > GAZE_OVERHEAD_DRIFT_DEG * RAD))
    ) {
      this.overhead = 'release'
      this.overheadFrom = this.now
    }
    let hold = 0
    if (this.overhead === 'on') hold = 1
    else if (this.overhead === 'release') {
      const progress = (this.now - this.overheadFrom) / GAZE_OVERHEAD_RELEASE_S
      if (progress >= 1) this.overhead = null
      else hold = 1 - smoothstep(progress)
    }
    const overhead = this.overhead === 'on'
    const outOfRange = !overhead && Math.abs(this.rawYaw) > this.yawLimit
    if (input.tracking && !overhead) {
      if (outOfRange) {
        this.outFor += dt
        this.holdFor = holdForTurn ? this.holdFor + dt : 0
        if (this.outFor > GAZE_GIVE_UP_S && !holdForTurn) this.gaveUp = true
        // 잠깐 못 돌던 때 (전환 클립 등) 포기했어도, 다시 몸 돌리기를 기다리는 동안은 한계에 둔다
        else if (holdForTurn && (!this.gaveUp || this.holdFor >= UNGIVE_UP_S)) this.gaveUp = false
      } else {
        if (this.gaveUp) this.trigger('back')
        this.outFor = 0
        this.gaveUp = false
      }
    }
    const lockedYaw = clamp(wrapAngle(this.overheadWorldYaw - sample.yaw), -this.yawLimit, this.yawLimit)
    const targetYaw = hold > 0 ? userYaw + (lockedYaw - userYaw) * hold : userYaw
    const targetPitch = clamp(this.rawPitch, -this.downLimit, this.upLimit)
    if (!this.angleReady) {
      this.yaw = targetYaw
      this.pitch = targetPitch
      this.yawSpeed = 0
      this.pitchSpeed = 0
      this.angleReady = true
      return outOfRange
    }
    // 임계 감쇠 (시간상수 GAZE_ANGLE_TAU_S) 정확해: 목표가 이 프레임 동안 그대로라고 보고 푼다
    const omega = 1 / GAZE_ANGLE_TAU_S
    const decay = Math.exp(-omega * dt)
    const step = (x: number, v: number, target: number) => {
      const offset = x - target
      const k = v + omega * offset
      return [target + (offset + k * dt) * decay, (v - omega * k * dt) * decay] as const
    }
    let [yaw, yawSpeed] = step(this.yaw, this.yawSpeed, targetYaw)
    let [pitch, pitchSpeed] = step(this.pitch, this.pitchSpeed, targetPitch)
    // 최고 각속도: 넘으면 이 프레임 움직임을 그 비율로 줄인다
    const maxSpeed = GAZE_MAX_SPEED_DEG * RAD
    const moved = dt > 0 ? Math.hypot(yaw - this.yaw, pitch - this.pitch) / dt : 0
    if (moved > maxSpeed) {
      const ratio = maxSpeed / moved
      yaw = this.yaw + (yaw - this.yaw) * ratio
      pitch = this.pitch + (pitch - this.pitch) * ratio
      yawSpeed *= ratio
      pitchSpeed *= ratio
    }
    this.yaw = yaw
    this.pitch = pitch
    this.yawSpeed = yawSpeed
    this.pitchSpeed = pitchSpeed
    return outOfRange
  }

  /** 원래 yaw 는 한계 안쪽인데 목표 yaw 가 한계에 붙어 있는 시간 (debug 경고: 머리 위 고정이 남는 것 같은 버그를 바로 보게) */
  private watchStuck(dt: number) {
    const inside = this.rawYaw !== null && Math.abs(this.rawYaw) < this.yawLimit - GAZE_STUCK_INSIDE_DEG * RAD
    const atEdge = this.angleReady && Math.abs(this.yaw) > this.yawLimit - GAZE_STUCK_EDGE_DEG * RAD
    this.stuckFor = inside && atEdge ? this.stuckFor + dt : 0
  }

  /** 계기·시간으로 보기·딴청을 바꾼다 */
  private schedule(input: GazeInput) {
    const { now } = this
    if (this.pending.length) {
      this.lastTrigger = this.pending[this.pending.length - 1]
      this.pending.length = 0
      if (this.mode === 'away') this.startLook(input)
      else this.modeUntil = Math.max(this.modeUntil, Math.max(now, this.lookFrom) + GAZE_TRIGGER_HOLD_S)
    }
    if (now < this.modeUntil) return
    if (this.mode === 'look') {
      this.mode = 'away'
      this.modeUntil = now + this.duration(input, 'away')
    } else {
      this.startLook(input)
    }
  }

  private startLook(input: GazeInput) {
    const [min, max] = GAZE_REACTION_S
    this.mode = 'look'
    this.lookFrom = this.now + min + (max - min) * this.random()
    this.modeUntil = this.lookFrom + this.duration(input, 'look')
  }

  /** 보기·딴청 길이 (s): 평균 × [2/3, 4/3] 무작위. 산책 중·오래 가만히면 다르게 */
  private duration(input: GazeInput, kind: 'look' | 'away') {
    let mean: number
    if (input.walking && this.lastClip === 'walk') {
      mean = kind === 'look' ? GAZE_WALK_LOOK_MEAN_S : GAZE_WALK_AWAY_MEAN_S
    } else {
      mean = kind === 'look' ? this.lookMean : this.awayMean
      if (this.stillFor > GAZE_STILL_LONG_S) mean *= kind === 'look' ? GAZE_STILL_LOOK_SCALE : GAZE_STILL_AWAY_SCALE
    }
    const [low, high] = GAZE_SPREAD
    return mean * (low + (high - low) * this.random())
  }

  /** weight 를 목표로 smoothstep (올릴 때 0.4초, 내릴 때 0.6초, 세기 0 인 클립이면 0.2초) */
  private follow(target: number, release: boolean) {
    const { now } = this
    if (!this.ramp || this.ramp.to !== target) {
      const duration =
        target > this.weight ? GAZE_WEIGHT_IN_S : release ? GAZE_WEIGHT_RELEASE_S : GAZE_WEIGHT_OUT_S
      this.ramp = { from: this.weight, to: target, start: now, duration }
    }
    const { from, to, start, duration } = this.ramp
    const progress = duration > 0 ? clamp((now - start) / duration, 0, 1) : 1
    this.weight = progress >= 1 ? to : from + (to - from) * smoothstep(progress)
  }

  /** 몸 기준 사용자 각 (rad, 절댓값) 에서 기다릴 시간 (s): 좌우 한계 이하 bodyTurnS ~ 120° 이상 그 0.4 배, 선형 */
  private turnWait(angle: number) {
    const behind = BODY_TURN_BEHIND_DEG * RAD
    const f =
      behind > this.yawLimit ? clamp((angle - this.yawLimit) / (behind - this.yawLimit), 0, 1) : angle >= behind ? 1 : 0
    return this.bodyTurnS * (1 + (BODY_TURN_BEHIND_S / BODY_TURN_S - 1) * f)
  }

  /**
   * 몸 돌리기: 서기 루프만 돌 때 좌우 한계 밖이면 진행률을 dt / 기다릴 시간 만큼 올려 1 이 되면 onTurn.
   * 0.5초 넘게 범위 안에 있어야 처음부터. 회전 뒤 쉼 동안에도 진행률은 오르고 (쉼이 끝나면 바로 돈다), 추적이 끊기면 멈춘다
   */
  private bodyTurn(input: GazeInput, sample: GazeSample, outOfRange: boolean, block: TurnBlock | null, dt: number) {
    const none = { waitFor: null, angle: null, wait: null, grace: null, started: false }
    if (block?.hard) {
      this.turnProgress = 0
      this.inFor = 0
      return { ...none, block: block.reason }
    }
    if (this.overhead === 'on') return { ...none, block: '머리 위 (시간 멈춤)' }
    if (!input.tracking) return { ...none, block: block?.reason ?? '추적 끊김' }
    if (!outOfRange) {
      if (this.turnProgress > 0 || this.turnRefused) {
        this.inFor += dt
        if (this.inFor >= BODY_TURN_GRACE_S) {
          this.turnProgress = 0
          this.inFor = 0
          this.turnRefused = false
          this.turnRefusedAt = null
        }
      }
      return { ...none, grace: this.turnProgress > 0 ? this.inFor : null, block: block?.reason ?? null }
    }
    this.inFor = 0
    // 따라보기를 막 켰다: 기다림 없이 (자리 검사·쉼은 그대로)
    if (this.followKick) this.turnProgress = 1
    const { camera } = input
    const { root } = sample
    const need = wrapAngle(Math.atan2(camera.x - root.x, camera.z - root.z) - sample.yaw)
    const angle = Math.abs(need)
    const wait = this.turnWait(angle)
    this.turnProgress = Math.min(1, this.turnProgress + (wait > 0 ? dt / wait : 1))
    const waitFor = (1 - this.turnProgress) * wait
    const info = { waitFor, angle: toDeg(angle), wait, grace: null, block: block?.reason ?? null, started: false }
    // 거절당했으면 BODY_TURN_RETRY_S 마다 다시 묻는다 (그동안 고개는 포기할 수 있다)
    const retryIn = this.turnRefusedAt === null ? 0 : this.turnRefusedAt + BODY_TURN_RETRY_S - this.now
    if (waitFor > 0 || block) return info
    if (retryIn > 0) return { ...info, block: `회전 요청 거절 (${retryIn.toFixed(1)}초 뒤 다시)` }
    const reason = `사용자가 몸 기준 ${Math.round(toDeg(angle))}° (좌우 한계 밖, ${wait.toFixed(1)}초)`
    if (input.pose === 'sit') {
      // 스스로 앉은 개: 회전 클립은 서기 자세 전용이라 먼저 일어난다. 서면 바로 돌고, 끝나면 아직 가까우면 다시 앉는다
      if (this.options.onPose?.('stand', `${reason} → 일어나서 돌기`)) {
        this.standToTurn = true
        this.resitAfterTurn = true
        this.turnProgress = 0
        this.outFor = 0
        this.gaveUp = false
        return { ...info, waitFor: 0, started: true }
      }
      this.refuse()
      return { ...info, waitFor: 0, block: '일어나기 요청 거절' }
    }
    if (this.options.onTurn?.(need, reason, this.turnClip)) {
      this.turnRefused = false
      this.turnRefusedAt = null
      this.turnRequestedAt = this.now
      // 회전 클립이 보이기 전에 다시 부르지 않게. 회전이 끝나면 그때부터 다시 BODY_TURN_COOLDOWN_S
      this.turnCooldownUntil = this.now + BODY_TURN_COOLDOWN_S
      this.turnProgress = 0
      this.outFor = 0
      this.gaveUp = false
      return { ...info, waitFor: 0, started: true }
    }
    // 거절 (산책 쪽 조건 등): 고개는 포기할 수 있게 하고, 잠시 뒤 다시 묻는다
    this.refuse()
    return { ...info, waitFor: 0, block: '회전 요청 거절' }
  }

  private refuse() {
    this.turnRefused = true
    this.turnRefusedAt = this.now
  }

  /** 몸 돌리기를 못 하는 까닭. hard 면 고개를 한계에서 포기할 수 있다 (곧 풀리는 쉼·추적 끊김은 hard 아님) */
  private turnBlock(input: GazeInput, sample: GazeSample): TurnBlock | null {
    const hard = (reason: string) => ({ reason, hard: true })
    if (!(this.bodyTurnS > 0)) return hard('끔')
    // 돌려고 일어나는 중·도는 중 (곧 끝난다: 고개는 클립 세기 0 으로 쉬고, 포기 표시는 하지 않는다)
    if (this.standToTurn) {
      return { reason: this.standWaitReason ? `일어나서 기다림 · ${this.standWaitReason}` : '돌려고 일어나는 중', hard: false }
    }
    if (this.turnRequestedAt !== null) return { reason: '도는 중', hard: false }
    if (!this.followOn) return hard('따라보기 꺼짐')
    if (!this.options.onTurn || !input.canTurn) return hard('회전 클립 없음·돌 수 없는 단계')
    // 스스로 앉은 개(?closesit)는 일어나서 돈다. 명령으로 앉거나 엎드린 개는 고개만
    const selfSit = this.selfSitTurnable(input, sample)
    if (input.pose !== 'stand' && !selfSit) return hard(input.pose === 'sit' ? '앉아 있음 (명령)' : '엎드려 있음')
    if (input.busy || (sample.clip !== 'standing' && !selfSit)) return hard('동작 중')
    if (!input.turnCheck && this.userDistance(input, sample) < BODY_TURN_MIN_M) return hard('너무 가까움')
    if (!input.tracking) return { reason: '추적 끊김', hard: false }
    if (this.now < this.turnCooldownUntil) {
      return { reason: `회전 뒤 쉼 ${(this.turnCooldownUntil - this.now).toFixed(1)}초`, hard: false }
    }
    // 쓸고 지나가는 자리와 사용자 발이 겹치면 기다린다 (고개는 한계에서 포기하지 않고, 비켜서면 바로 돈다)
    const check = this.check(input, sample)
    if (check && !check.ok) return { reason: check.reason ?? '쓸고 지나가는 자리와 겹침', hard: false }
    return null
  }

  /** 지금 사용자 쪽으로 돌 수 있는지 (turnCheck). 이번 프레임 값을 this.turnClip 에 둔다 */
  private check(input: GazeInput, sample: GazeSample): GazeTurnCheck | null {
    const need = wrapAngle(Math.atan2(input.camera.x - sample.root.x, input.camera.z - sample.root.z) - sample.yaw)
    const check = input.turnCheck?.(need) ?? null
    this.turnClip = check?.ok ? check.clip : null
    return check
  }

  private selfSitTurnable(input: GazeInput, sample: GazeSample) {
    return this.closeSit && this.selfSat && input.pose === 'sit' && sample.clip === 'sitting' && !input.busy && !input.walking
  }

  /** 개 발밑에서 사용자(카메라)까지 수평 거리 (m) */
  private userDistance(input: GazeInput, sample: GazeSample) {
    return Math.hypot(input.camera.x - sample.root.x, input.camera.z - sample.root.z)
  }


  /**
   * 스스로 앉았다가 돌려고 일어난 개: 서기 루프로 돌아오면 바로 돈다 (기다림은 이미 찼다). 못 돌면 (사용자가 너무 가까워짐 등)
   * 회전 없이 끝내고 closeSitStep 이 다시 앉힌다. 이번 프레임에 회전을 시작했으면 true
   */
  private standThenTurn(input: GazeInput, sample: GazeSample): boolean {
    // 회전 요청 뒤 클립이 끝내 안 보이면 (거의 없음) 기다림을 푼다
    if (this.turnRequestedAt !== null && this.now - this.turnRequestedAt > TURN_START_TIMEOUT_S && !isTurnClip(sample.clip)) {
      this.turnRequestedAt = null
    }
    if (!this.standToTurn) return false
    if (input.walking) {
      this.endStandToTurn()
      this.resitAfterTurn = false
      return false
    }
    if (input.busy || input.pose !== 'stand' || sample.clip !== 'standing') {
      this.standReadyAt = null
      return false
    }
    this.standReadyAt ??= this.now
    const need = wrapAngle(Math.atan2(input.camera.x - sample.root.x, input.camera.z - sample.root.z) - sample.yaw)
    // 일어나는 동안 사용자가 쓸고 지나가는 자리로 들어왔으면 선 채 STAND_TURN_WAIT_S 까지 기다린다 (비켜서면 바로 돈다).
    // 그래도 막히면 돌지 않고 끝낸다 (closeSitStep 이 가까우면 다시 앉힌다)
    const check = input.canTurn && input.tracking ? this.check(input, sample) : null
    const blocked = !input.canTurn || !input.tracking || (check ? !check.ok : this.userDistance(input, sample) < BODY_TURN_MIN_M)
    if (blocked) {
      this.standWaitReason = check?.reason ?? (input.tracking ? '너무 가까움' : '추적 끊김')
      if (this.now - this.standReadyAt >= STAND_TURN_WAIT_S) this.endStandToTurn()
      return false
    }
    this.endStandToTurn()
    if (!this.options.onTurn?.(need, `일어난 뒤 사용자 쪽으로 (몸 기준 ${Math.round(toDeg(Math.abs(need)))}°)`, this.turnClip)) return false
    this.turnRequestedAt = this.now
    this.turnCooldownUntil = this.now + BODY_TURN_COOLDOWN_S
    this.turnProgress = 0
    this.outFor = 0
    this.gaveUp = false
    return true
  }

  private endStandToTurn() {
    this.standToTurn = false
    this.standReadyAt = null
    this.standWaitReason = null
  }

  /** 가까이 앉기 (?closesit). 상태 한 줄 (없으면 null) */
  private closeSitStep(input: GazeInput, sample: GazeSample, dt: number): string | null {
    const request = this.options.onPose
    if (!this.closeSit || !request) return null
    const distance = this.userDistance(input, sample)
    // 돌려고 일어났던 개: 회전이 끝나 서기 루프로 돌아오면 사용자가 아직 1 m 안이면 기다림 없이 바로 다시 앉는다
    if (
      this.resitAfterTurn &&
      !this.standToTurn &&
      this.turnRequestedAt === null &&
      !input.busy &&
      input.pose === 'stand' &&
      sample.clip === 'standing'
    ) {
      this.resitAfterTurn = false
      this.selfSat = !input.walking && input.tracking && distance < CLOSE_STAND_M && request('sit', '돈 뒤 아직 가까움')
      return this.describeCloseSit()
    }
    // 다른 길로 일어났으면 (명령 등) 스스로 앉음이 아니다
    if (this.selfSat && !this.standToTurn && !this.resitAfterTurn && input.pose === 'stand' && !input.busy) this.selfSat = false
    if (!input.tracking) return this.describeCloseSit()
    if (distance > CLOSE_STAND_M) this.closeSitArmed = true
    // 따라보기 꺼짐: 가까이 살펴보는 동안 자세를 바꾸지 않는다 (스스로 앉았으면 물러나도 그대로)
    if (!this.followOn) {
      this.closeFor = 0
      this.farFor = 0
      return this.describeCloseSit()
    }
    const free = !input.busy && !input.walking
    // 돌려고 일어나 선 채 기다리는 동안은 앉지 않는다 (기다림이 끝나면 위에서 바로 다시 앉힌다)
    const waitingToTurn = this.standToTurn || this.resitAfterTurn
    if (free && !waitingToTurn && input.pose === 'stand' && sample.clip === 'standing' && this.closeSitArmed && distance < CLOSE_SIT_M) {
      this.closeFor += dt
      if (this.closeFor > CLOSE_SIT_S) {
        this.closeFor = 0
        if (request('sit', `사용자가 ${CLOSE_SIT_M} m 안에 ${CLOSE_SIT_S}초`)) this.selfSat = true
      }
    } else {
      this.closeFor = 0
    }
    if (free && this.selfSat && input.pose === 'sit' && sample.clip === 'sitting' && distance > CLOSE_STAND_M) {
      this.farFor += dt
      if (this.farFor > CLOSE_STAND_S) {
        this.farFor = 0
        if (request('stand', `사용자가 ${CLOSE_STAND_M} m 밖에 ${CLOSE_STAND_S}초`)) this.selfSat = false
      }
    } else {
      this.farFor = 0
    }
    return this.describeCloseSit()
  }

  private describeCloseSit(): string | null {
    if (!this.closeSit) return null
    if (this.standToTurn) return '돌려고 일어나는 중'
    if (this.resitAfterTurn) return '도는 중 (끝나면 가까우면 다시 앉음)'
    if (this.selfSat) {
      return this.farFor > 0 ? `스스로 앉음 · 일어남 ${(CLOSE_STAND_S - this.farFor).toFixed(1)}초 뒤` : '스스로 앉음'
    }
    if (this.closeFor > 0) return `앉음 대기 ${(CLOSE_SIT_S - this.closeFor).toFixed(1)}초`
    return this.closeSitArmed ? null : '명령 뒤 (1 m 밖으로 물러나면 다시 앉음)'
  }
}

/** ?debug 한 줄 */
export function describeGaze(debug: GazeDebug): string {
  const state = {
    look: '보는 중',
    react: '반응 늦춤',
    away: '딴청',
    out: '한계 밖 포기',
    hold: '동작 세기 0',
    off: '꺼짐',
  }[debug.state]
  if (debug.state === 'off') return `고개: 꺼짐 (${debug.offReason ?? '?'})`
  const deg = (value: number | null) => (value === null ? '?' : `${Math.round(value)}°`)
  const parts = [
    debug.warn ? `⚠ ${debug.warn}` : '',
    `고개: ${state}`,
    `목표 yaw ${deg(debug.yaw)} pitch ${deg(debug.pitch)}` +
      (debug.rawYaw !== null && (debug.rawYaw !== debug.yaw || debug.rawPitch !== debug.pitch)
        ? ` (원래 ${deg(debug.rawYaw)} ${deg(debug.rawPitch)})`
        : ''),
    `w ${debug.weight.toFixed(2)}${debug.clip ? ` ${debug.clip}` : ''}`,
    `따라보기 ${debug.follow ? '켜짐' : '꺼짐'}`,
    `턱 ${debug.jaw.toFixed(2)}`,
    debug.nextIn === null ? '' : `다음 ${debug.nextIn.toFixed(1)}초`,
    debug.outFor > 0 ? `한계 밖 ${debug.outFor.toFixed(1)}초` : '',
    debug.bodyTurnIn !== null
      ? `몸 회전 ${debug.bodyTurnIn.toFixed(1)}초 뒤 (몸 ${Math.round(debug.bodyTurnAngle ?? 0)}° 기준 ${(debug.bodyTurnWait ?? 0).toFixed(1)}초)` +
        (debug.bodyTurnBlock ? ` ${debug.bodyTurnBlock}` : '')
      : debug.bodyTurnGrace !== null
        ? `잠깐 범위 안 ${debug.bodyTurnGrace.toFixed(1)}초 (이어서 셈)`
        : debug.bodyTurnBlock
          ? `몸 회전 안 함 (${debug.bodyTurnBlock})`
          : '몸 회전 대기 아님',
    debug.near ? `가까움: ${debug.near}${debug.horizontal !== null && debug.horizontal < 0.5 ? ` (눈~폰 수평 ${debug.horizontal.toFixed(2)} m)` : ''}` : '',
    debug.sitReason ? `${debug.pose === 'down' ? '엎드림' : '앉음'}: ${debug.sitReason}` : '',
    debug.lastTrigger ? `계기 ${GAZE_TRIGGER_LABEL[debug.lastTrigger]}` : '',
    debug.still ? '오래 가만히' : '',
  ]
  return parts.filter(Boolean).join(' · ')
}
