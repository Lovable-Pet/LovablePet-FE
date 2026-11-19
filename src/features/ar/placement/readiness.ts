import type { Vec3 } from './types'

// 준비 단계: AR 을 켜자마자 바닥을 겨누면 추적·바닥·깊이가 아직 덜 맞춰져 처음부터 틀어진 채로 굳기 쉽다.
// 원을 보이기 전에 휴대폰을 좌우로 움직이게 해서 아래가 모두 될 때까지 기다린다.
// a) 추적 정상(뷰어 포즈가 있고 emulatedPosition 이 아님) 1초 이상
// b) 카메라 이동 누적 30cm 이상 (좌우 성분 위주)
// c) 바닥 층 확정 (임시 바닥이 아님)
// d) 깊이 센서가 있으면 깊이 보정이 맞음 (없으면 건너뜀). 8초가 지나도 d 만 안 되면 깊이 판정을 끈 채(특징점) 진행한다
// 한 번 준비되면 이 세션 동안 다시 준비 단계로 돌아가지 않는다. 렌더러를 모르는 순수 계산이다

/** a) 추적이 이만큼(ms) 이어져야 한다 */
export const READY_TRACKING_MS = 1000
/** b) 카메라를 이만큼(m) 움직여야 한다 */
export const READY_MOVE_M = 0.3
/** d) 깊이 보정을 이만큼(ms)까지 기다린다 (AR 시작부터). 넘으면 깊이 없이 진행 */
export const READY_DEPTH_TIMEOUT_MS = 8000
/** 손 떨림은 세지 않는다: 마지막 기준점에서 이만큼(m) 움직일 때마다 더한다 */
export const MOVE_STEP_M = 0.02
/** 앞뒤 이동은 이만큼만 친다 (좌우 이동이 바닥·깊이를 더 잘 맞춘다) */
export const FORWARD_MOVE_WEIGHT = 0.5
/** 프레임이 이만큼(ms) 넘게 끊기면 추적이 끊긴 것으로 본다 (포즈가 없는 프레임은 오지 않는다) */
const TRACKING_GAP_MS = 500

export interface ReadinessInput {
  time: number
  /** 뷰어 포즈가 있고 emulatedPosition 이 아님 */
  tracking: boolean
  camera: Vec3
  /** 카메라가 보는 방향 (기준 공간). 좌우 이동을 가르는 데 쓴다 */
  forward: Vec3
  /** 바닥 층이 확정됨 (임시 바닥이 아님) */
  floorConfirmed: boolean
  /** 깊이 센서가 있음 */
  depthSensor: boolean
  /** 깊이 보정이 맞음 */
  depthOk: boolean
}

/** ok: 맞음 · waiting: 기다리는 중 · skipped: 깊이 센서 없음 · timeout: 8초가 지나 깊이 없이 진행 */
export type DepthReadiness = 'ok' | 'waiting' | 'skipped' | 'timeout'

export interface ReadinessReport {
  ready: boolean
  /** a) 추적이 이어진 시간 (ms) */
  trackingMs: number
  /** b) 움직인 거리 (m) */
  moved: number
  /** c) 바닥 층 확정 */
  floor: boolean
  /** d) 깊이 보정 */
  depth: DepthReadiness
  /** AR 시작부터 지난 시간 (ms) */
  elapsedMs: number
  /** a·b 를 채웠는지. 채웠는데 바닥이 없으면 '바닥 못 찾음' 안내를 쓴다 */
  moving: boolean
}

export class Readiness {
  private startedAt: number | null = null
  private lastTime: number | null = null
  private trackingSince: number | null = null
  private anchor: Vec3 | null = null
  private moved = 0
  private done = false

  update(input: ReadinessInput): ReadinessReport {
    const { time } = input
    this.startedAt ??= time
    const gap = this.lastTime !== null && time - this.lastTime > TRACKING_GAP_MS
    this.lastTime = time
    if (!input.tracking || gap) {
      this.trackingSince = null
      this.anchor = null
    } else {
      this.trackingSince ??= time
      this.accumulate(input.camera, input.forward)
    }
    const trackingMs = this.trackingSince === null ? 0 : time - this.trackingSince
    const elapsedMs = time - this.startedAt
    const moving = trackingMs >= READY_TRACKING_MS && this.moved >= READY_MOVE_M
    const depth: DepthReadiness = !input.depthSensor
      ? 'skipped'
      : input.depthOk
        ? 'ok'
        : elapsedMs >= READY_DEPTH_TIMEOUT_MS
          ? 'timeout'
          : 'waiting'
    if (!this.done && moving && input.floorConfirmed && depth !== 'waiting') this.done = true
    return { ready: this.done, trackingMs, moved: this.moved, floor: input.floorConfirmed, depth, elapsedMs, moving }
  }

  private accumulate(camera: Vec3, forward: Vec3) {
    const anchor = this.anchor
    if (!anchor) {
      this.anchor = camera
      return
    }
    const dx = camera.x - anchor.x
    const dz = camera.z - anchor.z
    if (Math.hypot(dx, dz) < MOVE_STEP_M) return
    const length = Math.hypot(forward.x, forward.z)
    if (length > 1e-6) {
      const fx = forward.x / length
      const fz = forward.z / length
      // 좌우(보는 방향에 수직)는 다, 앞뒤는 반만 친다
      const lateral = Math.abs(-dx * fz + dz * fx)
      const along = Math.abs(dx * fx + dz * fz)
      this.moved += lateral + FORWARD_MOVE_WEIGHT * along
    } else {
      this.moved += Math.hypot(dx, dz)
    }
    this.anchor = camera
  }
}
