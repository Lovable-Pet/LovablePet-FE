// 개 방향 돌리기. 겨누는 점(발자취를 따라 앞 점)과의 방향 차이에 비례해 돌고, 차이를 넘어서 돌지 않는다 (지나침 0).
// - 회전 속도 = (차이 − YAW_DEADBAND) × YAW_GAIN, 상한 안에서. 빨라지는 것은 YAW_ACCEL 까지만, 느려지는 것은 바로
// - 한 프레임에 남은 차이보다 더 돌지 않는다
// - 겨누는 점이 거의 뒤(YAW_KEEP 넘게)에서 좌우가 바뀌면 돌던 쪽으로 계속 돈다 (±180° 근처에서 좌우로 흔들리지 않게)
// - 차이가 돌던 쪽과 반대가 되면 멈추고, YAW_REVERSE_HOLD 동안 이어질 때만 반대로 돈다 (짧게 뒤집힌 차이를 따라 흔들리지 않게)

/** 방향 차이 1 rad 에 이만큼(rad/s) 돈다 (상한 안에서) */
export const YAW_GAIN = 4
/** 회전 속도가 초당 이만큼(°/s²)까지만 빨라진다. 줄이는 것은 바로 (늦게 줄이면 지나친다) */
export const YAW_ACCEL_DEG = 400
/** 도는 중 방향 차이가 이보다(°) 크면 좌우가 바뀌어도 돌던 쪽으로 계속 돈다 */
export const YAW_KEEP_DEG = 150
/** 차이가 돌던 쪽과 반대로 이만큼(s) 이어져야 반대로 돈다 */
export const YAW_REVERSE_HOLD_S = 0.2
/** 이보다(°) 작은 차이는 맞춘 것으로 본다 (돌지 않고, 반대쪽 기다림·도는 쪽 기억을 하지 않는다) */
export const YAW_DEADBAND_DEG = 3

const RAD = Math.PI / 180

export interface TurnState {
  /** 지금 회전 속도 (rad/s, yaw 가 커지는 쪽 +) */
  rate: number
  /** 돌고 있는(돌려는) 쪽 +1 / −1. 맞췄으면 0 */
  direction: number
  /** 차이가 direction 과 반대로 이어진 시간 (s) */
  against: number
}

export const newTurnState = (): TurnState => ({ rate: 0, direction: 0, against: 0 })

/**
 * 이번 프레임의 회전 속도 (rad/s) 를 정하고 state 를 고친다.
 * error: 겨누는 점까지 방향 차이 (rad, −π~π, + 면 yaw 를 키워야 한다) · limit: 회전 속도 상한 (rad/s)
 */
export function turnStep(state: TurnState, error: number, limit: number, dt: number): number {
  if (dt <= 0) return 0
  let e = error
  if (state.direction === 0 && Math.abs(e) > YAW_DEADBAND_DEG * RAD) state.direction = Math.sign(e)
  const against = state.direction !== 0 && Math.sign(e) === -state.direction
  // 거의 뒤: 반대쪽으로 넘어가도 돌던 쪽으로 (긴 쪽이라도 2×(180°−YAW_KEEP) 안쪽만 더 돈다)
  if (against && Math.abs(e) > YAW_KEEP_DEG * RAD) e += 2 * Math.PI * state.direction
  let desired: number
  if (state.direction !== 0 && Math.sign(e) === -state.direction && Math.abs(e) > YAW_DEADBAND_DEG * RAD) {
    state.against += dt
    if (state.against < YAW_REVERSE_HOLD_S) {
      desired = 0
    } else {
      state.direction = -state.direction
      state.against = 0
      desired = clamp(soft(e) * YAW_GAIN, limit)
    }
  } else {
    state.against = 0
    desired = clamp(soft(e) * YAW_GAIN, limit)
  }
  const step = YAW_ACCEL_DEG * RAD * dt
  let rate: number
  if (desired === 0 || Math.sign(desired) !== Math.sign(state.rate)) {
    // 반대쪽이거나 멈춤: 지금 회전은 바로 멈추고 반대쪽은 가속 제한으로 올린다
    rate = Math.sign(desired) * Math.min(Math.abs(desired), step)
  } else if (Math.abs(desired) > Math.abs(state.rate)) {
    rate = Math.sign(desired) * Math.min(Math.abs(desired), Math.abs(state.rate) + step)
  } else {
    rate = desired
  }
  // 한 프레임에 남은 차이보다 더 돌지 않는다 (지나침 0)
  rate = Math.sign(rate) * Math.min(Math.abs(rate), Math.abs(e) / dt)
  state.rate = rate
  if (Math.abs(e) <= YAW_DEADBAND_DEG * RAD && state.against === 0) state.direction = 0
  return rate
}

const clamp = (value: number, limit: number) => Math.max(-limit, Math.min(limit, value))
/** 차이에서 YAW_DEADBAND 를 뺀다 (사용자 몸 흔들림으로 겨누는 점이 몇 도 흔들려도 따라 돌지 않게) */
const soft = (error: number) => Math.sign(error) * Math.max(0, Math.abs(error) - YAW_DEADBAND_DEG * RAD)
