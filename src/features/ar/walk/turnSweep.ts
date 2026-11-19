// 제자리 회전 클립이 도는 동안 개 몸이 쓸고 지나가는 바닥 자리 (몸 돌리기를 할 수 있는지: 사용자 발과 겹치는지).
// 몸 캡슐(../bodyProxy.ts)을 클립의 여러 프레임에서 바닥에 내려 그린 2D 캡슐 모음으로 둔다. 좌표는 회전을 시작할 때의 개 기준
// (m, 발밑 원점, u = 개 왼쪽 (need + 쪽, yaw 0 이면 월드 +x), v = 개 앞). 계산은 렌더 쪽(modelViewerArStage)이 클립을 복제한 뼈에
// 재생해 한 번 한다

/** 바닥에 내린 캡슐: 선분 (au,av)–(bu,bv) 와 반지름 r (m) */
export interface SweepCapsule {
  au: number
  av: number
  bu: number
  bv: number
  r: number
}

export interface TurnSweep {
  capsules: readonly SweepCapsule[]
  /** 가장 멀리 닿는 거리 (m, 발밑에서 수평) */
  reach: number
}

/** 사용자 발 = 폰에서 개 반대쪽으로 수평 이만큼(m) 뒤, 반지름 (m) */
export const USER_FEET_BACK_M = 0.2
export const USER_FEET_RADIUS_M = 0.15
/** 클립에서 볼 프레임 수 (처음·끝 포함) */
export const SWEEP_FRAMES = 41

type Vec2 = { u: number; v: number }

function segmentDistance2D(pu: number, pv: number, c: SweepCapsule): number {
  const du = c.bu - c.au
  const dv = c.bv - c.av
  const len2 = du * du + dv * dv
  const t = len2 > 0 ? Math.min(1, Math.max(0, ((pu - c.au) * du + (pv - c.av) * dv) / len2)) : 0
  return Math.hypot(pu - c.au - du * t, pv - c.av - dv * t)
}

/**
 * 프레임마다 뼈 캡슐을 읽어 쓸고 지나가는 자리를 만든다.
 * pose(t): 클립 시간 t 의 자세로 (복제 뼈). segments(): 지금 자세의 캡슐 (개 기준 바닥 좌표, m)
 */
export function computeTurnSweep(duration: number, pose: (time: number) => void, segments: () => SweepCapsule[]): TurnSweep {
  const capsules: SweepCapsule[] = []
  let reach = 0
  for (let i = 0; i < SWEEP_FRAMES; i++) {
    pose((duration * i) / (SWEEP_FRAMES - 1))
    for (const c of segments()) {
      capsules.push(c)
      reach = Math.max(reach, Math.hypot(c.au, c.av) + c.r, Math.hypot(c.bu, c.bv) + c.r)
    }
  }
  return { capsules, reach }
}

/** 개 기준 점 (u, v) 에 반지름 radius 원이 쓸고 지나가는 자리와 겹치는지 */
export function sweepHits(sweep: TurnSweep, u: number, v: number, radius: number): boolean {
  if (Math.hypot(u, v) - radius > sweep.reach) return false
  return sweep.capsules.some((c) => segmentDistance2D(u, v, c) < c.r + radius)
}

/** 윤곽 (?debug 바닥 점): 발밑에서 steps 방향마다 가장 멀리 닿는 점 */
export function sweepOutline(sweep: TurnSweep, steps = 36): Vec2[] {
  const out: Vec2[] = []
  for (let i = 0; i < steps; i++) {
    const a = (2 * Math.PI * i) / steps
    const du = Math.sin(a)
    const dv = Math.cos(a)
    // 그 방향 반직선 위에서 캡슐 안인 가장 먼 거리 (0.01 m 간격)
    let far = 0
    for (let d = 0.01; d <= sweep.reach + 0.01; d += 0.01) {
      if (sweep.capsules.some((c) => segmentDistance2D(du * d, dv * d, c) < c.r)) far = d
    }
    out.push({ u: du * far, v: dv * far })
  }
  return out
}

/** 월드 점 → 개 기준 (u, v). yaw: 개 방향 (앞 = (sin yaw, cos yaw)) */
export function toDogFrame(point: { x: number; z: number }, dog: { x: number; z: number }, yaw: number): Vec2 {
  const dx = point.x - dog.x
  const dz = point.z - dog.z
  const cos = Math.cos(yaw)
  const sin = Math.sin(yaw)
  return { u: dx * cos - dz * sin, v: dx * sin + dz * cos }
}

/** 개 기준 (u, v) → 월드 (x, z) */
export function fromDogFrame(p: Vec2, dog: { x: number; z: number }, yaw: number): { x: number; z: number } {
  const cos = Math.cos(yaw)
  const sin = Math.sin(yaw)
  return { x: dog.x + p.u * cos + p.v * sin, z: dog.z - p.u * sin + p.v * cos }
}

/** 폰 자리 → 사용자 발 원 가운데 (개 반대쪽으로 USER_FEET_BACK_M), 개 기준 */
export function userFeet(camera: { x: number; z: number }, dog: { x: number; z: number }, yaw: number): Vec2 {
  const dx = camera.x - dog.x
  const dz = camera.z - dog.z
  const length = Math.hypot(dx, dz) || 1
  return toDogFrame({ x: camera.x + (dx / length) * USER_FEET_BACK_M, z: camera.z + (dz / length) * USER_FEET_BACK_M }, dog, yaw)
}
