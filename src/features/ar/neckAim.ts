import type { Vec3 } from './placement/types'
import type { GazeCommand } from './gaze/gazeController'
import { GAZE_BONES, GAZE_EYE_BONES, GAZE_NOSE_BONE, GAZE_SHARE } from './gaze/gazeSpec'

// 고개 바라보기의 뼈 돌리기. 애니메이션(믹서)이 이번 프레임 자세를 쓴 뒤·그리기 전에 목 아래·목 가운데·머리 뼈의
// 로컬 회전에 추가 회전을 곱한다. 원래 동작(숨쉬기·갸우뚱 등)은 그 위에 그대로 남는다.
// three 의 Object3D 를 구조로만 받는다 (three 타입 없음, ./three-min.d.ts). 렌더 직전에 끼우는 일은 ./modelViewerArStage.ts
//
// - 머리 방향 = 머리 뼈에 붙은 '바라보는 축'. 두 눈 가운데 → 코 선은 템플릿마다 40~50° 아래를 향해서 (주둥이가 기울어 있다),
//   스킨의 바인드 자세(서기 자세)에서 그 선을 수평으로 눕힌 방향을 머리 로컬 축으로 잡는다. 그래서 pitch 0 = 서기 자세의 머리
// - 원래 자세의 머리 방향을 목표 방향으로 돌리는 회전 Q 를 몸(루트) 기준 yaw·pitch 로 만든다
//   (Q = R_y(목표 yaw)·R_x(−목표 pitch)·R_x(원래 pitch)·R_y(−원래 yaw), 갸우뚱 같은 좌우 기울기는 남는다).
//   서기 루프는 그 자체로 고개를 좌우 ±50° 넘게 돌리는데, 바라보는 동안은 머리가 목표에 고정된다 (딴청이면 원래 동작대로)
// - weight 로 Q 를 줄이고 (slerp(I, Q, weight)) 뼈마다 몫(0.25·0.35·0.4)만큼 나눠 월드 회전으로 더한다. 몫의 합이 1 이라
//   머리는 정확히 Q·weight 만큼 돈다
// - 믹서는 값이 바뀐 프레임에만 뼈를 쓴다 (three PropertyMixer.apply). 그래서 지금 값이 지난번에 우리가 쓴 값과 같으면
//   (아무도 다시 안 씀) 원래 자세로 되돌린 뒤 더하고, 다르면 그 값을 새 원래 자세로 삼는다. 더하지 않을 때(weight 0)는
//   원래 자세 그대로 둔다 (비트까지 같다)

interface QuaternionLike {
  readonly x: number
  readonly y: number
  readonly z: number
  readonly w: number
  set(x: number, y: number, z: number, w: number): unknown
}

export interface BoneLike {
  readonly name: string
  readonly quaternion: QuaternionLike
  readonly matrixWorld: { readonly elements: ArrayLike<number> }
  readonly parent: BoneLike | null
  readonly children: readonly BoneLike[]
  updateWorldMatrix(updateParents: boolean, updateChildren: boolean): void
  /** SkinnedMesh 만: 뼈와 바인드 역행렬 (glTF inverseBindMatrices, 장면 공간 +Y 위) */
  readonly skeleton?: { readonly bones: readonly unknown[]; readonly boneInverses: readonly { readonly elements: ArrayLike<number> }[] }
}

/** 개 몸(루트) 기준: pivot (위치·yaw 만). 월드 행렬의 +z 열이 개 앞 */
export interface FrameLike {
  readonly matrixWorld: { readonly elements: ArrayLike<number> }
}

/** [x, y, z, w] */
type Quat = [number, number, number, number]

const IDENTITY: Quat = [0, 0, 0, 1]

function multiply(a: Quat, b: Quat): Quat {
  const [ax, ay, az, aw] = a
  const [bx, by, bz, bw] = b
  return [
    aw * bx + ax * bw + ay * bz - az * by,
    aw * by - ax * bz + ay * bw + az * bx,
    aw * bz + ax * by - ay * bx + az * bw,
    aw * bw - ax * bx - ay * by - az * bz,
  ]
}

const conjugate = ([x, y, z, w]: Quat): Quat => [-x, -y, -z, w]

function normalize(q: Quat): Quat {
  const length = Math.hypot(q[0], q[1], q[2], q[3])
  return length > 0 ? [q[0] / length, q[1] / length, q[2] / length, q[3] / length] : [...IDENTITY]
}

function rotate(q: Quat, [x, y, z]: readonly [number, number, number]): [number, number, number] {
  const [qx, qy, qz, qw] = q
  // v + 2w(q×v) + 2q×(q×v)
  const tx = 2 * (qy * z - qz * y)
  const ty = 2 * (qz * x - qx * z)
  const tz = 2 * (qx * y - qy * x)
  return [x + qw * tx + (qy * tz - qz * ty), y + qw * ty + (qz * tx - qx * tz), z + qw * tz + (qx * ty - qy * tx)]
}

const axisAngle = (axis: 'x' | 'y', angle: number): Quat => {
  const s = Math.sin(angle / 2)
  return axis === 'x' ? [s, 0, 0, Math.cos(angle / 2)] : [0, s, 0, Math.cos(angle / 2)]
}

/** slerp(I, q, t) = q^t */
function power(q: Quat, t: number): Quat {
  const [x, y, z, w] = w0(q)
  const half = Math.acos(Math.min(1, w))
  const s = Math.sin(half)
  if (s < 1e-9) return [...IDENTITY]
  const k = Math.sin(half * t) / s
  return [x * k, y * k, z * k, Math.cos(half * t)]
}

/** 같은 회전 중 w ≥ 0 인 쪽 (짧은 길) */
const w0 = (q: Quat): Quat => (q[3] < 0 ? [-q[0], -q[1], -q[2], -q[3]] : q)

/** 열 우선 4x4 의 회전 (배율은 열마다 나눠 뺀다) */
function rotationOf(e: ArrayLike<number>): Quat {
  const sx = Math.hypot(e[0], e[1], e[2]) || 1
  const sy = Math.hypot(e[4], e[5], e[6]) || 1
  const sz = Math.hypot(e[8], e[9], e[10]) || 1
  const m11 = e[0] / sx, m21 = e[1] / sx, m31 = e[2] / sx
  const m12 = e[4] / sy, m22 = e[5] / sy, m32 = e[6] / sy
  const m13 = e[8] / sz, m23 = e[9] / sz, m33 = e[10] / sz
  const trace = m11 + m22 + m33
  if (trace > 0) {
    const s = 0.5 / Math.sqrt(trace + 1)
    return normalize([(m32 - m23) * s, (m13 - m31) * s, (m21 - m12) * s, 0.25 / s])
  }
  if (m11 > m22 && m11 > m33) {
    const s = 2 * Math.sqrt(1 + m11 - m22 - m33)
    return normalize([0.25 * s, (m12 + m21) / s, (m13 + m31) / s, (m32 - m23) / s])
  }
  if (m22 > m33) {
    const s = 2 * Math.sqrt(1 + m22 - m11 - m33)
    return normalize([(m12 + m21) / s, 0.25 * s, (m23 + m32) / s, (m13 - m31) / s])
  }
  const s = 2 * Math.sqrt(1 + m33 - m11 - m22)
  return normalize([(m13 + m31) / s, (m23 + m32) / s, 0.25 * s, (m21 - m12) / s])
}

const positionOf = (node: { matrixWorld: { elements: ArrayLike<number> } }): [number, number, number] => {
  const e = node.matrixWorld.elements
  return [e[12], e[13], e[14]]
}

/** 바인드 역행렬 → 바인드 자세의 회전·위치 (회전·같은 배율·이동만 있는 행렬) */
function bindPoseOf(inverse: ArrayLike<number>): { rotation: Quat; position: [number, number, number] } {
  const r = rotationOf(inverse)
  const s = Math.hypot(inverse[0], inverse[1], inverse[2]) || 1
  const back = conjugate(r)
  const [x, y, z] = rotate(back, [inverse[12], inverse[13], inverse[14]])
  return { rotation: back, position: [-x / s, -y / s, -z / s] }
}

const readQuat = (bone: BoneLike): Quat => [bone.quaternion.x, bone.quaternion.y, bone.quaternion.z, bone.quaternion.w]
const sameQuat = (a: Quat, b: Quat) => a[0] === b[0] && a[1] === b[1] && a[2] === b[2] && a[3] === b[3]

/** 머리 방향 (몸 기준 rad): yaw + 왼쪽, pitch + 위. pitch 0 = 서기(바인드) 자세의 머리 */
export interface HeadDirection {
  yaw: number
  pitch: number
}

export interface NeckSample {
  /** 두 눈 가운데 (월드) */
  eye: Vec3
  /** 개 발밑 (pivot, 월드) */
  root: Vec3
  /** 개 방향 (rad) */
  yaw: number
  /** 원래 클립 자세의 머리 방향 · 더한 뒤 머리 방향 */
  animated: HeadDirection
  head: HeadDirection
}

export interface NeckParts {
  bones: readonly [BoneLike, BoneLike, BoneLike]
  eyes: readonly [BoneLike, BoneLike]
  nose: BoneLike
  /** 머리 로컬 '바라보는 축' (단위 벡터): 바인드 자세에서 두 눈 가운데 → 코를 수평으로 눕힌 방향 */
  gazeAxis: readonly [number, number, number]
  /** 바인드 자세의 두 눈 가운데 → 코 pitch (rad, 확인용) */
  bindEyeNosePitch: number
}

/**
 * 모델에서 이름으로 뼈를 찾고 머리의 바라보는 축을 잡는다. 뼈가 하나라도 없거나, 목→머리가 부모·자식으로 이어지지 않거나,
 * 머리·눈·코가 스킨에 없으면 null (그 개는 고개 바라보기 끔)
 */
export function findNeckBones(model: BoneLike): NeckParts | null {
  const byName = new Map<string, BoneLike>()
  const skins: NonNullable<BoneLike['skeleton']>[] = []
  const visit = (node: BoneLike) => {
    if (!byName.has(node.name)) byName.set(node.name, node)
    if (node.skeleton) skins.push(node.skeleton)
    for (const child of node.children) visit(child)
  }
  visit(model)
  const bones = GAZE_BONES.map((name) => byName.get(name))
  const eyes = GAZE_EYE_BONES.map((name) => byName.get(name))
  const nose = byName.get(GAZE_NOSE_BONE)
  if (bones.some((bone) => !bone) || eyes.some((bone) => !bone) || !nose) return null
  const [base, mid, head] = bones as [BoneLike, BoneLike, BoneLike]
  if (mid.parent !== base || head.parent !== mid || !base.parent) return null
  // 눈·코는 머리에 붙어 있어야 머리 방향이 된다
  const under = (node: BoneLike) => {
    for (let at: BoneLike | null = node; at; at = at.parent) if (at === head) return true
    return false
  }
  if (!eyes.every((eye) => under(eye!)) || !under(nose)) return null
  const [left, right] = eyes as [BoneLike, BoneLike]
  // 바인드 자세 (glTF 장면 공간, +Y 위): 머리 회전과 눈·코 위치
  const skin = skins.find((skeleton) => [head, left, right, nose].every((bone) => skeleton.bones.includes(bone)))
  if (!skin) return null
  const bind = (bone: BoneLike) => bindPoseOf(skin.boneInverses[skin.bones.indexOf(bone)].elements)
  const headBind = bind(head)
  const [l, r, n] = [bind(left).position, bind(right).position, bind(nose).position]
  const line: [number, number, number] = [n[0] - (l[0] + r[0]) / 2, n[1] - (l[1] + r[1]) / 2, n[2] - (l[2] + r[2]) / 2]
  const flat = Math.hypot(line[0], line[2])
  if (!(flat > 1e-6)) return null
  const local = rotate(conjugate(headBind.rotation), [line[0] / flat, 0, line[2] / flat])
  const length = Math.hypot(...local)
  return {
    bones: [base, mid, head],
    eyes: [left, right],
    nose,
    gazeAxis: [local[0] / length, local[1] / length, local[2] / length],
    bindEyeNosePitch: Math.atan2(line[1], flat),
  }
}

export class NeckAim {
  private readonly bones: readonly [BoneLike, BoneLike, BoneLike]
  private readonly eyes: readonly [BoneLike, BoneLike]
  private readonly gazeAxis: readonly [number, number, number]
  private readonly frame: FrameLike
  private readonly shares: readonly number[]
  /** 애니메이션이 마지막으로 쓴 로컬 회전 (원래 자세) */
  private readonly base: Quat[]
  /** 지난번에 우리가 쓴 로컬 회전. 더하지 않았으면 null */
  private written: Quat[] | null = null
  private last: NeckSample | null = null

  constructor(parts: NeckParts, frame: FrameLike, shares: readonly number[] = GAZE_SHARE) {
    this.bones = parts.bones
    this.eyes = parts.eyes
    this.gazeAxis = parts.gazeAxis
    this.frame = frame
    this.shares = shares
    this.base = this.bones.map(readQuat)
  }

  /** 지난 apply 에서 잰 것. 아직 없으면 null */
  get sample(): NeckSample | null {
    return this.last
  }

  /**
   * 렌더 직전에 부른다. 원래 자세를 되찾은 뒤 command 만큼 더한다 (null·weight 0 이면 원래 자세 그대로).
   * 뼈를 바꿨으면 true (그림자를 다시 찍는다)
   */
  apply(command: GazeCommand | null): boolean {
    const { bones } = this
    let changed = false
    const written = this.written
    bones.forEach((bone, index) => {
      const now = readQuat(bone)
      if (written && sameQuat(now, written[index])) {
        const [x, y, z, w] = this.base[index]
        bone.quaternion.set(x, y, z, w)
        changed = true
      } else {
        this.base[index] = now
      }
    })
    this.written = null
    // 원래 자세의 월드 행렬 (pivot 부터 목·머리·눈·코까지)
    bones[0].updateWorldMatrix(true, true)
    const rootQ = rotationOf(this.frame.matrixWorld.elements)
    const animatedWorld = this.headVector()
    const animated = this.direction(rootQ, animatedWorld)
    const weight = command ? Math.min(1, Math.max(0, command.weight)) : 0
    if (!command || !(weight > 0)) {
      this.record(rootQ, animated, animated)
      return changed
    }
    // 몸 기준 회전 Q: 원래 머리 방향 → 목표 방향
    const qRoot = multiply(
      multiply(multiply(axisAngle('y', command.yaw), axisAngle('x', -command.pitch)), axisAngle('x', animated.pitch)),
      axisAngle('y', -animated.yaw),
    )
    const qWorld = normalize(multiply(multiply(rootQ, qRoot), conjugate(rootQ)))
    // 뼈마다 월드 회전 Q^(몫·weight) 를 더한다: L' = P⁻¹·Qᵢ·P·L (P = 부모 월드 회전, 앞 뼈를 돌린 뒤 값)
    let parent = rotationOf(bones[0].parent!.matrixWorld.elements)
    const next: Quat[] = []
    bones.forEach((bone, index) => {
      const q = power(qWorld, this.shares[index] * weight)
      const local = normalize(multiply(multiply(multiply(conjugate(parent), q), parent), this.base[index]))
      bone.quaternion.set(local[0], local[1], local[2], local[3])
      next.push(readQuat(bone))
      parent = normalize(multiply(parent, local))
    })
    this.written = next
    bones[0].updateWorldMatrix(false, true)
    this.record(rootQ, animated, this.direction(rootQ, this.headVector()))
    return true
  }

  /** 더했던 것을 지우고 원래 자세로 (그만둘 때) */
  restore() {
    const written = this.written
    if (!written) return
    this.bones.forEach((bone, index) => {
      if (!sameQuat(readQuat(bone), written[index])) return
      const [x, y, z, w] = this.base[index]
      bone.quaternion.set(x, y, z, w)
    })
    this.written = null
  }

  private eyeCenter(): [number, number, number] {
    const [a, b] = this.eyes.map(positionOf)
    return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2]
  }

  /** 머리가 바라보는 방향 (월드): 머리 월드 회전 · 바라보는 축 */
  private headVector(): [number, number, number] {
    return rotate(rotationOf(this.bones[2].matrixWorld.elements), this.gazeAxis as [number, number, number])
  }

  private direction(rootQ: Quat, world: [number, number, number]): HeadDirection {
    const [x, y, z] = rotate(conjugate(rootQ), world)
    return { yaw: Math.atan2(x, z), pitch: Math.atan2(y, Math.hypot(x, z)) }
  }

  private record(rootQ: Quat, animated: HeadDirection, head: HeadDirection) {
    const [ex, ey, ez] = this.eyeCenter()
    const e = this.frame.matrixWorld.elements
    const forward = rotate(rootQ, [0, 0, 1])
    this.last = {
      eye: { x: ex, y: ey, z: ez },
      root: { x: e[12], y: e[13], z: e[14] },
      yaw: Math.atan2(forward[0], forward[2]),
      animated,
      head,
    }
  }
}
