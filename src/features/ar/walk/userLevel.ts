import type { Vec2 } from './trail'

// 사용자가 다른 층(턱·계단)으로 갔는지. 개 바닥에서 카메라까지 높이(걸음 흔들림을 LEVEL_SMOOTH_S 로 거른 값)를 본다.
// - 같은 층에 있는 동안의 카메라 높이를 기준으로 두고 (휴대폰 높이가 천천히 바뀌면 LEVEL_REF_TAU_S 로 따라간다),
//   기준보다 LEVEL_RISE_M 넘게 달라지기 시작한 자리를 경계 후보로 둔다
// - LEVEL_ENTER_M 넘게 LEVEL_HOLD_S 동안 다르면 판단한다: 후보 자리에서 LEVEL_MOVE_M 넘게 옮겨 왔으면 다른 층 (턱을 오르내리는 걸음),
//   아니면 서서 휴대폰을 들었거나 쪼그려 앉은 것이라 지금 높이를 새 기준으로 둔다.
//   걸으면서 휴대폰을 0.15m 넘게 들면 턱과 가를 수 없다 (다른 층으로 본다)
// - 다른 층에서 기준과 LEVEL_EXIT_M 안으로 LEVEL_HOLD_S 동안 돌아오면 같은 층이다
// - 기준은 그 높이로 LEVEL_TRUST_M 넘게 걸은 뒤에야 믿는다. 그 전에는 높이가 바뀌면 새 기준으로 둔다
//   (쪼그려 앉아 산책을 켜고 일어서며 걸어가면 쪼그린 높이가 기준으로 남아 내내 다른 층이 되지 않게)

/**
 * 기준보다 이만큼(m) 넘게 높거나 낮으면 다른 층. 바닥 층을 따라가는 범위(FLOOR_FOLLOW_RANGE_M 0.2m)보다 조금 작게 둔다:
 * 휴대폰 높이가 걸으며 ±3–5cm 흔들려 0.25m 턱이 0.2m 근처로 잡히고, 계단 한 칸(0.15–0.18m)도 개가 걸어 들어가면 안 된다
 */
export const LEVEL_ENTER_M = 0.15
/** 다른 층에서 기준과 이만큼(m) 안으로 오면 같은 층으로 돌아온 것 */
export const LEVEL_EXIT_M = 0.08
/** 높이가 이만큼(m) 넘게 달라지기 시작한 자리를 경계 후보로 둔다 (걸러도 남는 흔들림 ±1cm 보다 크게) */
export const LEVEL_RISE_M = 0.06
/** 다른 층·같은 층으로 정하기 전에 이어져야 하는 시간 (s) */
export const LEVEL_HOLD_S = 0.3
/** 후보 자리에서 이만큼(m) 넘게 옮겨 왔어야 다른 층이다 (천천히 걸어도 0.3초에 0.1m. 손 떨림은 몇 cm) */
export const LEVEL_MOVE_M = 0.1
/** 카메라 높이를 이 시간(s)으로 거른다 (걸음마다 ±1.5cm 오르내림) */
export const LEVEL_SMOOTH_S = 0.15
/**
 * 후보를 둔 뒤 이 시간(s) 안에 다른 층으로 정해지지 않으면 지금 높이를 새 기준으로 둔다 (휴대폰 높이가 조금 바뀐 채 머묾).
 * 그대로 두면 나중에 진짜 턱을 오를 때 경계가 한참 뒤(높이가 처음 바뀐 자리)에 잡힌다. 턱·계단은 1초 안에 오른다
 */
export const LEVEL_RISE_MAX_S = 1.5
/** 기준 높이로 이만큼(m) 걸어야 기준을 믿는다 (LEVEL_WALK_MPS 보다 빠르게 움직인 프레임만 센다. 손 떨림은 빼고) */
export const LEVEL_TRUST_M = 0.5
export const LEVEL_WALK_MPS = 0.2
/** 같은 층에서 기준이 카메라 높이를 따라가는 시간 (s). 기준과 LEVEL_REF_RANGE_M 안일 때만 */
export const LEVEL_REF_TAU_S = 4
export const LEVEL_REF_RANGE_M = 0.1

/** rise: 경계 후보를 둠 · cancel: 후보를 버림 · enter: 다른 층 (경계 = 후보) · exit: 같은 층으로 돌아옴 */
export type LevelEvent = 'rise' | 'cancel' | 'enter' | 'exit'

export class UserLevel {
  /** 같은 층일 때 개 바닥에서 카메라까지 높이 (m) */
  private ref: number | null = null
  /** 거른 높이 (m) */
  private smooth = 0
  /** 지금 높이 − 기준 (m) */
  private diff = 0
  /** 0 같은 층 · +1 위 · −1 아래 */
  private side = 0
  /** 경계 후보: 높이가 바뀌기 시작한 쪽·자리, ENTER 를 넘은 채 이어진 시간, 후보를 둔 뒤 지난 시간 */
  private rise: { sign: number; at: Vec2; held: number; age: number } | null = null
  /** 다른 층에서 기준 근처로 돌아온 채 이어진 시간 (s) */
  private back = 0
  /** 기준 높이로 걸은 거리 (m). LEVEL_TRUST_M 을 넘으면 기준을 믿는다 */
  private walked = 0
  private last: Vec2 | null = null

  /** 0 같은 층 · +1 위 · −1 아래 */
  get state() {
    return this.side
  }

  /** 지금 높이 − 기준 (m) */
  get offset() {
    return this.diff
  }

  /** 기준 높이 (m). 아직 모르면 null */
  get reference() {
    return this.ref
  }

  /** 경계 후보를 둔 채 높이가 바뀌는 중인지 */
  get rising() {
    return this.rise !== null
  }

  /** height: 개 바닥에서 카메라까지 (m) · user: 카메라를 바닥에 내린 점. 추적이 끊긴 프레임은 넣지 않는다 */
  update(height: number, user: Vec2, dt: number): LevelEvent | null {
    const step = this.last ? Math.hypot(user.x - this.last.x, user.z - this.last.z) : 0
    this.last = { ...user }
    if (this.ref === null) {
      this.ref = height
      this.smooth = height
      return null
    }
    this.smooth += (height - this.smooth) * (1 - Math.exp(-dt / LEVEL_SMOOTH_S))
    const diff = this.smooth - this.ref
    this.diff = diff
    if (this.side !== 0) {
      this.back = Math.abs(diff) < LEVEL_EXIT_M ? this.back + dt : 0
      if (this.back < LEVEL_HOLD_S) return null
      this.side = 0
      this.back = 0
      return 'exit'
    }
    const rise = this.rise
    if (!rise) {
      if (Math.abs(diff) > LEVEL_RISE_M) {
        this.rise = { sign: Math.sign(diff), at: { ...user }, held: 0, age: 0 }
        return 'rise'
      }
      if (Math.abs(diff) < LEVEL_REF_RANGE_M) {
        this.ref += (this.smooth - this.ref) * (1 - Math.exp(-dt / LEVEL_REF_TAU_S))
        if (dt > 0 && step / dt > LEVEL_WALK_MPS) this.walked += step
      }
      return null
    }
    rise.age += dt
    // 처음 쪽으로 반쯤 돌아오거나 반대로 바뀌면 후보를 버린다
    if (diff * rise.sign < LEVEL_RISE_M / 2) {
      this.rise = null
      return 'cancel'
    }
    rise.held = diff * rise.sign > LEVEL_ENTER_M ? rise.held + dt : 0
    if (rise.held >= LEVEL_HOLD_S) {
      const moved = Math.hypot(user.x - rise.at.x, user.z - rise.at.z)
      if (moved >= LEVEL_MOVE_M && this.walked >= LEVEL_TRUST_M) {
        this.side = rise.sign
        this.rise = null
        this.back = 0
        return 'enter'
      }
      // 제자리에서 높이만 바뀜 (휴대폰을 들거나 쪼그려 앉음), 또는 아직 기준을 믿지 못함: 새 기준
      return this.reanchor()
    }
    return rise.held === 0 && rise.age > LEVEL_RISE_MAX_S ? this.reanchor() : null
  }

  private reanchor(): LevelEvent {
    this.ref = this.smooth
    this.diff = 0
    this.rise = null
    this.walked = 0
    return 'cancel'
  }
}
