import type { Vec3 } from '../placement/types'
import {
  BODY_TURN_COOLDOWN_S,
  BODY_TURN_MIN_M,
  BODY_TURN_S,
  GAZE_ANGLE_TAU_S,
  GAZE_APPROACH_M,
  GAZE_AWAY_MEAN_S,
  GAZE_CLIP_WEIGHT,
  GAZE_GIVE_UP_S,
  GAZE_LOOK_MEAN_S,
  GAZE_LOOP_CLIPS,
  GAZE_MAX_SPEED_DEG,
  GAZE_MOVE_OFF_MPS,
  GAZE_MOVE_ON_MPS,
  GAZE_NEAR_M,
  GAZE_REACTION_S,
  GAZE_SPEED_TAU_S,
  GAZE_SPREAD,
  GAZE_STILL_AWAY_SCALE,
  GAZE_STILL_LONG_S,
  GAZE_STILL_LOOK_SCALE,
  GAZE_STILL_MPS,
  GAZE_TRIGGER_HOLD_S,
  GAZE_WALK_AWAY_MEAN_S,
  GAZE_WALK_LOOK_MEAN_S,
  GAZE_WEIGHT_IN_S,
  GAZE_WEIGHT_OUT_S,
  GAZE_WEIGHT_RELEASE_S,
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
}

/** 머리가 볼 방향 (몸 기준 rad, yaw + 왼쪽, pitch + 위) 과 세기 0~1. weight 0 이면 원래 자세 그대로 */
export interface GazeCommand {
  yaw: number
  pitch: number
  weight: number
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
  clip: string | null
  /** 다음에 보기·딴청이 바뀔 때까지 (s) */
  nextIn: number | null
  /** 좌우 한계 밖에 있은 시간 (s) */
  outFor: number
  /** 몸 돌리기까지 남은 시간 (s). 기다리는 중이 아니면 null */
  bodyTurnIn: number | null
  /** 몸 돌리기를 하지 않는 까닭 (돌 수 있으면 null) */
  bodyTurnBlock: string | null
  lastTrigger: GazeTrigger | null
  /** 오래 가만히 (바라보기 짧게·딴청 길게) */
  still: boolean
}

export interface GazeControllerOptions {
  /** 템플릿 이름 (템플릿별 한계, gazeSpec GAZE_LIMITS_BY_TEMPLATE) */
  template?: string | null
  tuning?: GazeTuning
  /** 몸 돌리기 요청. 받아서 돌기 시작했으면 true. need = 개 정면에서 사용자까지 각 (rad, + 왼쪽) */
  onTurn?: (need: number, reason: string) => boolean
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

/**
 * 고개 바라보기 (계속 보지 않게):
 * - 바라보기 3~6초 ↔ 딴청 2~4초를 번갈아 (딴청 = weight 0, 원래 동작대로 앞을 본다). 바라보기는 0.2~0.4초 늦게 시작한다
 * - 바로 바라보는 계기: 사용자가 움직이기 시작 (수평 0.3m/s) · 0.5m 넘게 다가옴 · 톡 · 마이크 · 1회 동작이 끝나 루프로 돌아옴.
 *   이미 보는 중이면 적어도 1.5초 더 본다
 * - 사용자가 10초 넘게 거의 안 움직이면 바라보기를 반으로·딴청을 1.75배로
 * - 좌우 한계 밖이면 한계까지만 돌리고 1.5초 넘게 밖이면 포기 (weight 0). 다시 들어오면 계기. 위·아래는 한계까지만 (포기하지 않는다:
 *   개 바로 옆에 선 사용자를 끝까지 올려다본다)
 * - 세기는 클립별 (GAZE_CLIP_WEIGHT): 0 인 클립(짖기·전환·walk_start·회전 등)이면 0.2초 안에 풀고 끝나면 다시 본다
 * - 몸 돌리기: 서기 루프만 돌 때 (명령 없음·서 있음) 사용자가 좌우 한계 밖에 2.5초 넘게 있으면 onTurn 으로 제자리 회전을 맡긴다.
 *   회전 클립이 끝나면 3초 동안은 다시 돌지 않는다
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
  /** 이 때까지는 몸을 돌리지 않는다 (s) */
  private turnCooldownUntil = -Infinity
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
    clip: null,
    nextIn: null,
    outFor: 0,
    bodyTurnIn: null,
    bodyTurnBlock: null,
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
  }

  /** 바로 바라보는 계기 (톡·마이크). 다음 update 에서 반영한다 */
  trigger(kind: GazeTrigger) {
    this.pending.push(kind)
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
    this.lastCamera = null
    this.lastClip = null
    this.pending.length = 0
    this.snapshot = { ...this.snapshot, state: 'off', offReason: reason, weight: 0, bodyTurnIn: null, nextIn: null }
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
    const outOfRange = this.aim(input, sample, dt)
    this.schedule(input)

    const clipWeight = sample.clip ? (GAZE_CLIP_WEIGHT[sample.clip] ?? 0) : 0
    const looking = this.mode === 'look' && now >= this.lookFrom && !this.gaveUp && this.rawYaw !== null
    this.follow(looking ? clipWeight : 0, clipWeight === 0)

    const turn = this.bodyTurn(input, sample, outOfRange)
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
      clip: sample.clip,
      nextIn: Math.max(0, this.modeUntil - now),
      outFor: this.outFor,
      bodyTurnIn: turn.waitFor,
      bodyTurnBlock: turn.block,
      lastTrigger: this.lastTrigger,
      still: this.stillFor > GAZE_STILL_LONG_S,
    }
    return this.angleReady ? { yaw: this.yaw, pitch: this.pitch, weight: this.weight } : null
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
    }
    this.lastClip = clip
  }

  /** 눈에서 카메라까지 방향 (몸 기준) → 한계 안 목표로 각을 따라간다. 좌우 한계 밖이면 true */
  private aim(input: GazeInput, sample: GazeSample, dt: number): boolean {
    const { camera } = input
    const { eye } = sample
    const dx = camera.x - eye.x
    const dz = camera.z - eye.z
    const horizontal = Math.hypot(dx, dz)
    if (input.tracking && horizontal >= GAZE_NEAR_M) {
      this.rawYaw = wrapAngle(Math.atan2(dx, dz) - sample.yaw)
      this.rawPitch = Math.atan2(camera.y - eye.y, horizontal)
    }
    if (this.rawYaw === null || this.rawPitch === null) return false
    const outOfRange = Math.abs(this.rawYaw) > this.yawLimit
    if (input.tracking) {
      if (outOfRange) {
        this.outFor += dt
        if (this.outFor > GAZE_GIVE_UP_S) this.gaveUp = true
      } else {
        if (this.gaveUp) this.trigger('back')
        this.outFor = 0
        this.gaveUp = false
      }
    }
    const targetYaw = clamp(this.rawYaw, -this.yawLimit, this.yawLimit)
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

  /** 몸 돌리기: 서기 루프만 돌 때 좌우 한계 밖에 bodyTurnS 넘게 있으면 onTurn */
  private bodyTurn(input: GazeInput, sample: GazeSample, outOfRange: boolean) {
    const block = this.turnBlock(input, sample)
    if (block || !outOfRange) return { waitFor: null, block }
    const waitFor = Math.max(0, this.bodyTurnS - this.outFor)
    if (waitFor > 0) return { waitFor, block }
    const { camera, root } = { camera: input.camera, root: sample.root }
    const need = wrapAngle(Math.atan2(camera.x - root.x, camera.z - root.z) - sample.yaw)
    const reason = `사용자가 좌우 ${Math.round(toDeg(this.yawLimit))}° 밖에 ${this.bodyTurnS}초`
    if (this.options.onTurn?.(need, reason)) {
      // 회전 클립이 보이기 전에 다시 부르지 않게. 회전이 끝나면 그때부터 다시 BODY_TURN_COOLDOWN_S
      this.turnCooldownUntil = this.now + BODY_TURN_COOLDOWN_S
      this.outFor = 0
      this.gaveUp = false
    }
    return { waitFor: 0, block }
  }

  private turnBlock(input: GazeInput, sample: GazeSample): string | null {
    if (!(this.bodyTurnS > 0)) return '끔'
    if (!this.options.onTurn || !input.canTurn) return '회전 클립 없음·돌 수 없는 단계'
    if (input.pose !== 'stand') return input.pose === 'sit' ? '앉아 있음' : '엎드려 있음'
    if (input.busy || sample.clip !== 'standing') return '동작 중'
    if (!input.tracking) return '추적 끊김'
    if (this.now < this.turnCooldownUntil) return `회전 뒤 쉼 ${(this.turnCooldownUntil - this.now).toFixed(1)}초`
    if (Math.hypot(input.camera.x - sample.root.x, input.camera.z - sample.root.z) < BODY_TURN_MIN_M) return '너무 가까움'
    return null
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
    `고개: ${state}`,
    `목표 yaw ${deg(debug.yaw)} pitch ${deg(debug.pitch)}` +
      (debug.rawYaw !== null && (debug.rawYaw !== debug.yaw || debug.rawPitch !== debug.pitch)
        ? ` (원래 ${deg(debug.rawYaw)} ${deg(debug.rawPitch)})`
        : ''),
    `w ${debug.weight.toFixed(2)}${debug.clip ? ` ${debug.clip}` : ''}`,
    debug.nextIn === null ? '' : `다음 ${debug.nextIn.toFixed(1)}초`,
    debug.outFor > 0 ? `한계 밖 ${debug.outFor.toFixed(1)}초` : '',
    debug.bodyTurnIn !== null ? `몸 회전 ${debug.bodyTurnIn.toFixed(1)}초 뒤` : debug.bodyTurnBlock ? `몸 회전 안 함 (${debug.bodyTurnBlock})` : '몸 회전 대기 아님',
    debug.lastTrigger ? `계기 ${GAZE_TRIGGER_LABEL[debug.lastTrigger]}` : '',
    debug.still ? '오래 가만히' : '',
  ]
  return parts.filter(Boolean).join(' · ')
}
