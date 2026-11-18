import type { Vec3 } from '../placement/types'

// 산책(걷기) 클립의 약속. AI 저장소 ar_pipeline/walk_clips.py 머리 주석 (앱 계약, 11-14)
// - 클립: walk (제자리 걷기 루프), walk_start (standing 첫 프레임 → walk 첫 프레임), walk_stop (walk 첫 프레임 → standing 첫 프레임).
//   이음매는 비트 단위로 같다. 앞으로 옮기는 것은 앱이 한다
// - scenes[0].extras.walk = { stride_m, cycle_s, speed_mps, ref_size_m } (크기 배율 1 의 템플릿 값)
// - 크기 배율 s = 서버가 GLB 루트 노드에 곱한 배율. 자연 속도 v0 = speed_mps·√s, 자연 재생 배율 r0 = 1/√s
// - walk 는 timeScale = r0·(v/v0) 로 틀고 개를 v 로 옮긴다 (한 바퀴에 stride_m·s, 속도와 상관없다)
// - walk_start·walk_stop 은 r0 로 틀고, 그동안 속도를 0 ↔ v0 로 고르게(선형) 바꾼다 (거리 = v0 × 재생 시간 / 2)
// - walk_stop 은 walk 루프 끝(첫 프레임)에서만 시작한다

/** GLB 의 scenes[0].extras.walk */
export interface WalkExtras {
  /** 한 걸음 주기(같은 발이 다시 닿을 때까지) 동안 가는 거리 (m, 배율 1) */
  stride_m: number
  /** walk 한 바퀴 길이 (s, 배율 1) */
  cycle_s: number
  /** stride_m / cycle_s (m/s, 배율 1) */
  speed_mps: number
  /** standing 첫 프레임의 크기 [가로, 높이, 앞뒤] (m, 배율 1) */
  ref_size_m: [number, number, number]
}

export const WALK_CLIPS = ['walk_start', 'walk', 'walk_stop'] as const
export type WalkClip = (typeof WALK_CLIPS)[number]
/** 걷기 앞뒤의 서기 루프 */
export const STANDING_CLIP = 'standing'

/** 클립 길이 (s, 클립 시간) */
export type WalkClipDurations = Record<WalkClip, number>

// 제자리 회전 클립의 약속 (AI-AR work/turn_v1/fe_contract.md, 11-17 진도 시험본)
// - 클립: turn_left_90 (+90°) · turn_right_90 (−90°) · turn_180 (+180°, 왼쪽으로). standing 첫 프레임에서 시작해
//   "angle 만큼 돌리고 end_offset 만큼 옮긴 standing 첫 프레임"으로 끝난다 (뼈 자세는 비트 단위로 같고 루트만 다르다)
// - scenes[0].extras.turn = { ref_size_m, clips: { 이름: { angle_deg, duration_s, end_offset_m: [x, z] } } } (크기 배율 1)
//   angle +: yaw 가 커지는 쪽 (three rotation.y +, 앞(+z)이 +x(개의 왼쪽) 쪽으로). end_offset_m: 회전 전 모델 축 기준 [x, z] (m)
// - 재생: 걷기처럼 1/√s 배율. 끝나는 프레임에서 크로스페이드 없이 위치 += R_y(회전 전 yaw)·(x, 0, z)·s, yaw += angle,
//   standing 첫 프레임으로 바꾼다 (섞으면 회전이 두 번 들어간다)
// - extras.turn 이나 클립이 없으면 회전 클립 없이 지금처럼 걸으며 돈다

export const TURN_CLIPS = ['turn_left_90', 'turn_right_90', 'turn_180'] as const
export type TurnClip = (typeof TURN_CLIPS)[number]

/** extras.turn.clips 의 한 클립 (크기 배율 1) */
export interface TurnClipExtras {
  angle_deg: number
  duration_s: number
  /** 끝났을 때 모델 원점이 옮겨진 거리 [x, z] (m). 회전 전 모델 축, +x 개의 왼쪽, +z 개의 앞 */
  end_offset_m: [number, number]
}

/** 모델에 있는 회전 클립 하나 (extras.turn 과 클립이 둘 다 있을 때만) */
export interface TurnClipSpec {
  clip: TurnClip
  /** 도는 각 (rad, yaw 가 커지는 쪽 +) */
  angle: number
  /** 클립 길이 (s, 클립 시간. GLB 클립의 길이) */
  duration: number
  /** end_offset_m (m, 크기 배율 1) */
  offset: [number, number]
}

const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)

/** extras.turn 에서 이름이 맞고 모양이 맞는 클립만. 없으면 빈 객체 */
export function parseTurnExtras(value: unknown): Partial<Record<TurnClip, TurnClipExtras>> {
  const out: Partial<Record<TurnClip, TurnClipExtras>> = {}
  if (typeof value !== 'object' || value === null) return out
  const clips = (value as Record<string, unknown>).clips
  if (typeof clips !== 'object' || clips === null) return out
  for (const name of TURN_CLIPS) {
    const clip = (clips as Record<string, unknown>)[name]
    if (typeof clip !== 'object' || clip === null) continue
    const { angle_deg, duration_s, end_offset_m } = clip as Record<string, unknown>
    if (!finite(angle_deg) || angle_deg === 0 || !(finite(duration_s) && duration_s > 0)) continue
    if (!Array.isArray(end_offset_m) || end_offset_m.length !== 2 || !end_offset_m.every(finite)) continue
    out[name] = { angle_deg, duration_s, end_offset_m: [end_offset_m[0], end_offset_m[1]] }
  }
  return out
}

/**
 * 회전 클립이 끝난 프레임의 개 자리·방향: 위치 += R_y(돌기 전 yaw)·(end_offset x, 0, z)·s, yaw += angle.
 * three R_y: x' = x cos + z sin, z' = −x sin + z cos (산책의 회전과 산책 밖 몸 돌리기가 같이 쓴다)
 */
export function turnEndPose(spec: TurnClipSpec, position: Vec3, yaw0: number, scale: number): { position: Vec3; yaw: number } {
  const [ox, oz] = spec.offset
  const cos = Math.cos(yaw0)
  const sin = Math.sin(yaw0)
  const yaw = yaw0 + spec.angle
  return {
    position: { x: position.x + (ox * cos + oz * sin) * scale, y: position.y, z: position.z + (-ox * sin + oz * cos) * scale },
    yaw: Math.atan2(Math.sin(yaw), Math.cos(yaw)),
  }
}

/** 90° 클립과 180° 클립을 가르는 각: 필요한 각이 이 안이면 같은 부호 90°, 넘으면 180° */
export const TURN_PICK_SPLIT_DEG = 135

/**
 * 돌아야 할 각(rad)에 쓸 회전 클립. |각| ≤ 135° 면 같은 부호의 90° 클립, 넘으면 180° 클립 (부호와 상관없이).
 * 그 클립이 없으면 남는 각이 지금보다 작아지는 클립 중 가장 맞는 것, 그것도 없으면 null. 남는 각은 출발 뒤 조향이 맞춘다
 */
export function pickTurnClip(turns: readonly TurnClipSpec[], need: number): TurnClipSpec | null {
  const split = (TURN_PICK_SPLIT_DEG * Math.PI) / 180
  const wrap = (angle: number) => Math.atan2(Math.sin(angle), Math.cos(angle))
  const preferred =
    Math.abs(need) <= split
      ? turns.find((turn) => Math.abs(turn.angle) <= split && Math.sign(turn.angle) === Math.sign(need))
      : turns.find((turn) => Math.abs(turn.angle) > split)
  if (preferred) return preferred
  let best: TurnClipSpec | null = null
  for (const turn of turns) {
    const left = Math.abs(wrap(need - turn.angle))
    if (left < Math.abs(need) && (!best || left < Math.abs(wrap(need - best.angle)))) best = turn
  }
  return best
}

/** s 를 어디서 읽었는지. root: GLB 루트 노드 배율 · size: 불러온 모델 크기 ÷ ref_size_m (루트 배율을 못 읽을 때) */
export type ScaleSource = 'root' | 'size'

/** extras.walk 를 어디서 읽었는지. userData: three 장면 · glb: GLB JSON 청크를 직접 */
export type ExtrasSource = 'userData' | 'glb'

/** 어댑터가 모델에서 읽어 오는 값 */
export interface WalkModelInfo {
  extras: WalkExtras
  extrasSource: ExtrasSource
  durations: WalkClipDurations
  scale: number
  scaleSource: ScaleSource
  /** 불러온 모델 크기 (m). x 가로, y 높이, z 앞뒤 */
  size: Vec3
  /** 제자리 회전 클립 (extras.turn 과 클립이 둘 다 있는 것만). 비면 걸으며 돈다 */
  turns: readonly TurnClipSpec[]
}

/** 산책 로직이 쓰는 수치 (모두 실제 크기·실제 시간) */
export interface WalkSpec extends WalkModelInfo {
  /** √s */
  sqrtScale: number
  /** 자연 속도 (m/s) = speed_mps·√s */
  v0: number
  /** 자연 재생 배율 = 1/√s */
  r0: number
  /** 클립 시간 1초에 가는 거리 (m) = v0 / r0 = speed_mps·s */
  metersPerClipSecond: number
  /** 한 바퀴에 가는 거리 (m) = stride_m·s */
  stride: number
  /** 자연 속도로 한 바퀴 도는 시간 (s) */
  loopSeconds: number
  /** walk_start·walk_stop 실제 재생 시간 (s) */
  startSeconds: number
  stopSeconds: number
  /** walk_start·walk_stop 동안 가는 거리 (m) */
  startDistance: number
  stopDistance: number
  /** 몸길이 (m): 불러온 모델의 앞뒤 길이 */
  bodyLength: number
  /** 따라갈 거리 D (m) */
  followDistance: number
  /** 출발 여유 (m): 거리 > D + 여유 면 출발 */
  startMargin: number
  /** 가장 좁게 도는 반지름 (m). 회전 속도 상한 = 속도 / 이 값 (서 있으면 돌지 않는다) */
  turnRadius: number
  /** 크게 돌 때(방향 차이 90° 넘게) 가장 좁게 도는 반지름 (m). 천천히 걸으며 제자리에 가깝게 돈다 */
  tightTurnRadius: number
  /** 발자취를 따라 이만큼 앞의 점을 겨눈다 (m, pure pursuit) */
  lookAhead: number
  /** 사용자가 개 둘레 이 반경(m) 안을 지나가면 발자취를 개 자리에서 다시 시작한다 */
  trailResetRadius: number
}

/** D = max(이 값, 몸길이 × FOLLOW_BODY_LENGTHS) */
export const FOLLOW_MIN_M = 0.8
export const FOLLOW_BODY_LENGTHS = 1.5
/** 출발 여유 = max(이 값, 가장 짧은 산책(walk_start + walk_stop) 거리의 절반) */
export const START_MARGIN_MIN_M = 0.3
/** 가장 좁게 도는 반지름 = 몸길이 × 이 값 */
export const TURN_RADIUS_BODY_LENGTHS = 0.45
/** 크게 돌 때 가장 좁게 도는 반지름 = 몸길이 × 이 값 */
export const TIGHT_TURN_RADIUS_BODY_LENGTHS = 0.25
/** 겨누는 점 = 발자취를 따라 max(LOOK_AHEAD_MIN_M, 몸길이 × LOOK_AHEAD_BODY_LENGTHS) 앞 */
export const LOOK_AHEAD_MIN_M = 0.3
export const LOOK_AHEAD_BODY_LENGTHS = 0.5
/** 발자취를 다시 시작하는 개 둘레 = max(TRAIL_RESET_MIN_M, 몸길이 / 2) */
export const TRAIL_RESET_MIN_M = 0.4

const positive = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0

/** extras.walk 모양이 맞으면 그 값, 아니면 null */
export function parseWalkExtras(value: unknown): WalkExtras | null {
  if (typeof value !== 'object' || value === null) return null
  const { stride_m, cycle_s, speed_mps, ref_size_m } = value as Record<string, unknown>
  if (!positive(stride_m) || !positive(cycle_s) || !positive(speed_mps)) return null
  if (!Array.isArray(ref_size_m) || ref_size_m.length !== 3 || !ref_size_m.every(positive)) return null
  return { stride_m, cycle_s, speed_mps, ref_size_m: [ref_size_m[0], ref_size_m[1], ref_size_m[2]] }
}

export function walkSpec(info: WalkModelInfo): WalkSpec {
  const { extras, durations, scale } = info
  const sqrtScale = Math.sqrt(scale)
  const v0 = extras.speed_mps * sqrtScale
  const r0 = 1 / sqrtScale
  const metersPerClipSecond = v0 / r0
  const startSeconds = durations.walk_start / r0
  const stopSeconds = durations.walk_stop / r0
  const startDistance = (v0 * startSeconds) / 2
  const stopDistance = (v0 * stopSeconds) / 2
  const bodyLength = info.size.z
  return {
    ...info,
    sqrtScale,
    v0,
    r0,
    metersPerClipSecond,
    // 한 바퀴 거리는 클립 길이로 잰다 (extras 의 stride_m 과 같아야 한다: stride_m = speed_mps × cycle_s)
    stride: metersPerClipSecond * durations.walk,
    loopSeconds: durations.walk / r0,
    startSeconds,
    stopSeconds,
    startDistance,
    stopDistance,
    bodyLength,
    followDistance: Math.max(FOLLOW_MIN_M, FOLLOW_BODY_LENGTHS * bodyLength),
    startMargin: Math.max(START_MARGIN_MIN_M, (startDistance + stopDistance) / 2),
    turnRadius: TURN_RADIUS_BODY_LENGTHS * bodyLength,
    tightTurnRadius: TIGHT_TURN_RADIUS_BODY_LENGTHS * bodyLength,
    lookAhead: Math.max(LOOK_AHEAD_MIN_M, LOOK_AHEAD_BODY_LENGTHS * bodyLength),
    trailResetRadius: Math.max(TRAIL_RESET_MIN_M, bodyLength / 2),
  }
}
