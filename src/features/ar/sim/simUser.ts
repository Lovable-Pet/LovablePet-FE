import type { Vec3 } from '../placement/types'

// 개발용 PC 시뮬레이션(?sim=1)의 가상 사용자: 바닥 위 자리·바라보는 방향·폰(눈) 높이. 키 입력으로 한 프레임씩 옮긴다 (렌더러와 상관없는 계산).
// 좌표는 AR 과 같은 장면 좌표 (m, y 위). 개는 원점에 +z 를 보고 놓인다. 방향 heading 은 앞 = (sin h, 0, cos h) (0 이면 +z)

/** 걷기 빠르기 (m/s) · Shift 로 느리게 */
export const SIM_WALK_MPS = 1.0
export const SIM_SLOW_MPS = 0.4
/** Q/E 로 도는 빠르기 (°/s) */
export const SIM_TURN_DPS = 90
/** 마우스 드래그 1 px 당 도는 각 (rad) */
export const SIM_DRAG_RAD_PER_PX = 0.005
/** R/F 로 폰 높이를 바꾸는 빠르기 (m/s) 와 범위 (m) */
export const SIM_EYE_MPS = 0.5
export const SIM_EYE_MIN_M = 0.3
export const SIM_EYE_MAX_M = 2.0
/** 기본 폰(눈) 높이 (m, ?simeye 로 바꾼다) */
export const SIM_EYE_DEFAULT_M = 1.3
/**
 * L: 사용자가 이만큼(m) 아래 층에 선다 (폰 높이 R/F 와 따로). 다른 층 판단(walk/userLevel.ts)은 기준보다 LEVEL_ENTER_M(0.15) 을
 * '넘게' 달라야 해서, 손 떨림이 없는 시뮬레이션에서 딱 0.15 m 는 잡히지 않는다. 계단 한 칸쯤인 0.18 m 로 둔다.
 * 서 있는 채 켜면 폰을 내린 것으로 본다 (규칙대로): 걸으면서 켠다
 */
export const SIM_LOWER_FLOOR_M = 0.18
/** 위아래로 보는 각 (rad): 처음 값과 범위 (1인칭 화면만, 판단에는 쓰지 않는다) */
export const SIM_PITCH_DEFAULT = -0.35
export const SIM_PITCH_MIN = -1.3
export const SIM_PITCH_MAX = 0.6
/** 처음 자리: 개 앞 1.5 m 에서 개를 본다 */
export const SIM_START = { x: 0, z: 1.5, heading: Math.PI }

export interface SimUser {
  x: number
  z: number
  heading: number
  pitch: number
  /** 사용자 바닥에서 폰까지 (m) */
  eye: number
  /** 사용자가 개보다 SIM_LOWER_FLOOR_M 아래 층에 섰는지 */
  lower: boolean
}

/** 누르고 있는 키 */
export interface SimKeys {
  forward: boolean
  back: boolean
  left: boolean
  right: boolean
  slow: boolean
  turnLeft: boolean
  turnRight: boolean
  up: boolean
  down: boolean
}

export const NO_KEYS: SimKeys = {
  forward: false,
  back: false,
  left: false,
  right: false,
  slow: false,
  turnLeft: false,
  turnRight: false,
  up: false,
  down: false,
}

export const startUser = (eye = SIM_EYE_DEFAULT_M): SimUser => ({ ...SIM_START, pitch: SIM_PITCH_DEFAULT, eye, lower: false })

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

/** dt 초 동안 키대로 옮긴다. 앞뒤좌우는 바라보는 방향 기준 (대각선도 같은 빠르기) */
export function stepUser(user: SimUser, keys: SimKeys, dt: number): SimUser {
  const speed = keys.slow ? SIM_SLOW_MPS : SIM_WALK_MPS
  const ahead = (keys.forward ? 1 : 0) - (keys.back ? 1 : 0)
  const side = (keys.left ? 1 : 0) - (keys.right ? 1 : 0)
  let { x, z, heading, eye } = user
  if (ahead || side) {
    const scale = (speed * dt) / Math.hypot(ahead, side)
    const sin = Math.sin(heading)
    const cos = Math.cos(heading)
    // 앞 (sin, cos) · 왼쪽 (cos, −sin)
    x += (sin * ahead + cos * side) * scale
    z += (cos * ahead - sin * side) * scale
  }
  const turn = (keys.turnLeft ? 1 : 0) - (keys.turnRight ? 1 : 0)
  if (turn) heading += ((turn * SIM_TURN_DPS * Math.PI) / 180) * dt
  const lift = (keys.up ? 1 : 0) - (keys.down ? 1 : 0)
  if (lift) eye = clamp(eye + lift * SIM_EYE_MPS * dt, SIM_EYE_MIN_M, SIM_EYE_MAX_M)
  return { ...user, x, z, heading: Math.atan2(Math.sin(heading), Math.cos(heading)), eye }
}

/** 마우스 드래그: 오른쪽으로 끌면 오른쪽으로, 위로 끌면 위를 본다 */
export function dragUser(user: SimUser, dx: number, dy: number): SimUser {
  const heading = user.heading - dx * SIM_DRAG_RAD_PER_PX
  return {
    ...user,
    heading: Math.atan2(Math.sin(heading), Math.cos(heading)),
    pitch: clamp(user.pitch - dy * SIM_DRAG_RAD_PER_PX, SIM_PITCH_MIN, SIM_PITCH_MAX),
  }
}

/** 폰(카메라) 위치: 개 바닥(y 0) 기준. 아래 층이면 그만큼 낮다 */
export const userCamera = (user: SimUser): Vec3 => ({ x: user.x, y: user.eye - (user.lower ? SIM_LOWER_FLOOR_M : 0), z: user.z })

/** 바라보는 방향 (단위 벡터, pitch 포함) */
export const userLook = (user: SimUser): Vec3 => ({
  x: Math.cos(user.pitch) * Math.sin(user.heading),
  y: Math.sin(user.pitch),
  z: Math.cos(user.pitch) * Math.cos(user.heading),
})
