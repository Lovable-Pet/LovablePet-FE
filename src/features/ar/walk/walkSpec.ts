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
  /** 발자취 위에서 이만큼 앞의 점을 보고 방향을 잡는다 (m) */
  lookAhead: number
}

/** D = max(이 값, 몸길이 × FOLLOW_BODY_LENGTHS) */
export const FOLLOW_MIN_M = 0.8
export const FOLLOW_BODY_LENGTHS = 1.5
/** 출발 여유 = max(이 값, 가장 짧은 산책(walk_start + walk_stop) 거리의 절반) */
export const START_MARGIN_MIN_M = 0.3
/** 가장 좁게 도는 반지름 = 몸길이 × 이 값 */
export const TURN_RADIUS_BODY_LENGTHS = 0.45
/** 방향을 잡을 앞 점 = max(LOOK_AHEAD_MIN_M, 몸길이 × LOOK_AHEAD_BODY_LENGTHS) */
export const LOOK_AHEAD_MIN_M = 0.3
export const LOOK_AHEAD_BODY_LENGTHS = 0.5

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
    lookAhead: Math.max(LOOK_AHEAD_MIN_M, LOOK_AHEAD_BODY_LENGTHS * bodyLength),
  }
}
