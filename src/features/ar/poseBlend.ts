// 클립이 바뀔 때 자세 섞기. 렌더러를 모른다 (three 의 뼈를 구조로만 받는다, ./three-min.d.ts 없이).
// 렌더 직전 (믹서가 이번 프레임 자세를 쓴 뒤 · 바라보기·턱 앞) 에 부른다. model-viewer 에 끼우는 일은 ./modelViewerArStage.ts
//
// - 클립이 바뀐 첫 프레임에 '직전에 그린 자세 (바라보기·턱을 더하기 전)' 와 새 클립 자세의 차이를 뼈마다 (로컬 회전·이동, 루트·COG 포함)
//   잡고, 그 차이를 smoothstep 으로 0 까지 줄이며 새 클립 자세에 더한다. 새 클립의 움직임은 처음부터 그대로 살고 처음 어긋남만 사라진다
//   (앞 자세에 멈춰 둔 채 섞는 크로스페이드와 달리 새 동작이 늦게 시작하지 않는다)
// - 길이: POSE_BLEND_MIN_S. 관절이 POSE_BLEND_BIG_DEG 넘게 또는 몸(관절 위치)이 POSE_BLEND_BIG_M 넘게 어긋나면 그 비율만큼 늘려
//   POSE_BLEND_MAX_S 까지
// - 어긋남이 거의 없으면 (POSE_BLEND_SKIP_DEG·POSE_BLEND_SKIP_M 안) 섞지 않는다: 이음매가 같은 연결(전환 → 루프 등)은 지금과 같다
// - 섞는 중에 또 바뀌면 그때 그린 자세(앞 섞기가 남은 자세)에서 다시 잡는다
// - 믹서는 값이 바뀐 프레임에만 뼈를 쓴다 (three PropertyMixer.apply). 그래서 그리기 직전 값을 적어 두고 (commit) 다음 프레임에
//   그대로면 믹서가 안 쓴 것으로 보고 앞 클립 값을 쓴다. 뒤에 붙는 층(갸우뚱·바라보기·턱)이 지난 프레임에 바꾼 뼈도 그때 클립 값으로
//   되돌려 둬 층마다 깨끗한 클립 자세 위에 더한다 (안 바뀐 뼈는 쓰지 않는다)

/** 섞는 시간 (s): 기본 · 가장 길게 */
export const POSE_BLEND_MIN_S = 0.3
export const POSE_BLEND_MAX_S = 0.6
/** 이만큼 넘게 어긋나면 길게 (관절 로컬 회전 °, 관절 위치 m) */
export const POSE_BLEND_BIG_DEG = 40
export const POSE_BLEND_BIG_M = 0.05
/** 이 안이면 섞지 않는다 (같은 이음매: 한 프레임 움직임 정도) */
export const POSE_BLEND_SKIP_DEG = 1
export const POSE_BLEND_SKIP_M = 0.002

interface QuatLike {
  x: number
  y: number
  z: number
  w: number
  set(x: number, y: number, z: number, w: number): unknown
}
interface VecLike {
  x: number
  y: number
  z: number
  set(x: number, y: number, z: number): unknown
}

/** three 의 Bone 중 쓰는 것 */
export interface BlendBone {
  readonly quaternion: QuatLike
  readonly position: VecLike
  readonly scale: { readonly x: number }
  readonly parent: unknown
}

/** 마지막으로 시작한 섞기 (?debug) */
export interface BlendInfo {
  from: string | null
  to: string | null
  /** 가장 크게 어긋난 관절 (°) · 관절 위치 (m) */
  angleDeg: number
  moveM: number
  durationS: number
  /** 섞기 시작 시각 (s, apply 의 now) */
  at: number
}

const RAD = Math.PI / 180
/** 이보다 작은 어긋남은 0 (회전 rad · 이동 모델 단위) */
const OFFSET_EPSILON_RAD = 1e-6
const OFFSET_EPSILON_M = 1e-9

/** 0~1 → 0~1, 처음과 끝 기울기 0 */
const smoothstep = (u: number) => u * u * (3 - 2 * u)

/** 어긋남 → 섞는 시간. 크면 비율만큼 늘려 최대까지 */
export function blendDuration(angleDeg: number, moveM: number): number {
  const ratio = Math.max(angleDeg / POSE_BLEND_BIG_DEG, moveM / POSE_BLEND_BIG_M)
  return Math.min(POSE_BLEND_MAX_S, POSE_BLEND_MIN_S * Math.max(1, ratio))
}

export class PoseBlend {
  private readonly bones: readonly BlendBone[]
  /** 뼈마다 부모의 bones 번호 (bones 밖이면 -1) · 부모가 앞에 오는 순서 */
  private readonly parentIndex: Int32Array
  private readonly order: Int32Array
  /** 이번 프레임 클립 자세 (믹서 값) */
  private readonly clipQ: Float64Array
  private readonly clipP: Float64Array
  /** 지난 프레임 그리기 직전 값 (모든 층을 더한 뒤) */
  private readonly finalQ: Float64Array
  private readonly finalP: Float64Array
  private hasFinal = false
  /** 지난 프레임에 그린 자세 (바라보기·턱을 더하기 전) */
  private readonly drawnQ: Float64Array
  private readonly drawnP: Float64Array
  private hasDrawn = false
  /** 섞기 시작 때 어긋남: 부모 공간 회전 (그린 = off · 클립) · 이동 */
  private readonly offQ: Float64Array
  private readonly offP: Float64Array
  /** 이번 프레임에 뼈가 이미 클립 값인지 (apply 안에서만 쓴다) */
  private readonly current: Uint8Array
  /** 섞기 시작 때 어긋남이 있는 뼈 (없는 뼈는 섞는 동안에도 클립 값 그대로 둔다) */
  private readonly offset: Uint8Array
  private active: { start: number; duration: number } | null = null
  private info: BlendInfo | null = null
  /** 관절 위치를 재는 데 쓰는 모델 바깥 배율 (스킨 루트 부모의 월드 배율) */
  private readonly outerScale: () => number

  constructor(bones: readonly BlendBone[], options: { outerScale?: () => number } = {}) {
    this.bones = bones
    const n = bones.length
    this.parentIndex = new Int32Array(n)
    bones.forEach((bone, index) => (this.parentIndex[index] = bones.indexOf(bone.parent as BlendBone)))
    // 부모가 먼저 오게 (glTF 스킨 관절 순서는 아무렇게나일 수 있다)
    const order: number[] = []
    const placed = new Uint8Array(n)
    const place = (index: number) => {
      if (placed[index]) return
      placed[index] = 1
      const parent = this.parentIndex[index]
      if (parent >= 0) place(parent)
      order.push(index)
    }
    for (let index = 0; index < n; index++) place(index)
    this.order = Int32Array.from(order)
    this.clipQ = new Float64Array(4 * n)
    this.clipP = new Float64Array(3 * n)
    this.finalQ = new Float64Array(4 * n)
    this.finalP = new Float64Array(3 * n)
    this.drawnQ = new Float64Array(4 * n)
    this.drawnP = new Float64Array(3 * n)
    this.offQ = new Float64Array(4 * n)
    this.offP = new Float64Array(3 * n)
    this.current = new Uint8Array(n)
    this.offset = new Uint8Array(n)
    this.outerScale = options.outerScale ?? (() => 1)
  }

  /** 섞는 중인지 */
  get blending(): boolean {
    return this.active !== null
  }

  /** 마지막으로 시작한 섞기 (?debug). 없으면 null */
  get last(): BlendInfo | null {
    return this.info
  }

  /**
   * 믹서 뒤에 부른다. switched 면 (클립이 바뀜·처음부터 다시) 지난번에 그린 자세에서 섞기 시작.
   * 섞는 중이면 클립 자세 + 남은 어긋남을, 아니면 클립 자세를 뼈에 둔다 (이미 그 값이면 쓰지 않는다). 뼈를 썼으면 true
   */
  apply(now: number, switched: boolean, labels?: { from: string | null; to: string | null }): boolean {
    const { bones, clipQ, clipP, finalQ, finalP, current } = this
    const n = bones.length
    // 1. 이번 프레임 클립 자세: 그리기 직전 값과 같으면 믹서가 안 쓴 것 (앞 클립 값 그대로).
    //    믹서는 회전·이동을 따로 쓴다 (값이 바뀐 바인딩만): 둘을 따로 본다
    for (let i = 0; i < n; i++) {
      const { quaternion: q, position: p } = bones[i]
      const qi = 4 * i
      const pi = 3 * i
      let same = 1
      if (this.hasFinal && q.x === finalQ[qi] && q.y === finalQ[qi + 1] && q.z === finalQ[qi + 2] && q.w === finalQ[qi + 3]) {
        // 뒤 층이 바꾼 값이 남아 있을 수 있다: 클립 값과 같은지만 본다
        if (q.x !== clipQ[qi] || q.y !== clipQ[qi + 1] || q.z !== clipQ[qi + 2] || q.w !== clipQ[qi + 3]) same = 0
      } else {
        clipQ[qi] = q.x
        clipQ[qi + 1] = q.y
        clipQ[qi + 2] = q.z
        clipQ[qi + 3] = q.w
      }
      if (this.hasFinal && p.x === finalP[pi] && p.y === finalP[pi + 1] && p.z === finalP[pi + 2]) {
        if (p.x !== clipP[pi] || p.y !== clipP[pi + 1] || p.z !== clipP[pi + 2]) same = 0
      } else {
        clipP[pi] = p.x
        clipP[pi + 1] = p.y
        clipP[pi + 2] = p.z
      }
      current[i] = same
    }
    // 2. 바뀌었으면 어긋남을 잰다
    if (switched && this.hasDrawn) this.capture(now, labels ?? { from: null, to: null })
    // 3. 뼈에 둔다
    let weight = 0
    if (this.active) {
      const u = (now - this.active.start) / this.active.duration
      if (u >= 1) this.active = null
      else weight = 1 - smoothstep(Math.max(0, u))
    }
    let wrote = false
    for (let i = 0; i < n; i++) {
      const bone = bones[i]
      if (weight > 0 && this.offset[i]) {
        // 회전 어긋남이 없는 뼈는 클립 값 그대로 (다시 정규화하면 마지막 자리가 바뀐다)
        if (this.offQ[4 * i + 3] !== 1) {
          const [x, y, z, w] = this.blended(i, weight)
          bone.quaternion.set(x, y, z, w)
        } else {
          bone.quaternion.set(clipQ[4 * i], clipQ[4 * i + 1], clipQ[4 * i + 2], clipQ[4 * i + 3])
        }
        bone.position.set(
          clipP[3 * i] + this.offP[3 * i] * weight,
          clipP[3 * i + 1] + this.offP[3 * i + 1] * weight,
          clipP[3 * i + 2] + this.offP[3 * i + 2] * weight,
        )
        wrote = true
      } else if (!current[i]) {
        bone.quaternion.set(clipQ[4 * i], clipQ[4 * i + 1], clipQ[4 * i + 2], clipQ[4 * i + 3])
        bone.position.set(clipP[3 * i], clipP[3 * i + 1], clipP[3 * i + 2])
        wrote = true
      }
    }
    return wrote
  }

  /** 바라보기·턱을 더하기 전 (섞기와 그 앞 층을 둔 뒤) 에 부른다: 다음 섞기의 출발 자세 */
  markDrawn() {
    const { bones, drawnQ, drawnP } = this
    for (let i = 0; i < bones.length; i++) {
      const { quaternion: q, position: p } = bones[i]
      drawnQ[4 * i] = q.x
      drawnQ[4 * i + 1] = q.y
      drawnQ[4 * i + 2] = q.z
      drawnQ[4 * i + 3] = q.w
      drawnP[3 * i] = p.x
      drawnP[3 * i + 1] = p.y
      drawnP[3 * i + 2] = p.z
    }
    this.hasDrawn = true
  }

  /** 모든 층을 더한 뒤, 그리기 직전에 부른다 (다음 프레임에 믹서가 썼는지 가린다) */
  commit() {
    const { bones, finalQ, finalP } = this
    for (let i = 0; i < bones.length; i++) {
      const { quaternion: q, position: p } = bones[i]
      finalQ[4 * i] = q.x
      finalQ[4 * i + 1] = q.y
      finalQ[4 * i + 2] = q.z
      finalQ[4 * i + 3] = q.w
      finalP[3 * i] = p.x
      finalP[3 * i + 1] = p.y
      finalP[3 * i + 2] = p.z
    }
    this.hasFinal = true
  }

  /** 섞기를 그만두고 클립 자세로 (다음 apply 부터) */
  cancel() {
    this.active = null
  }

  /** 그린 자세와 지금 클립 자세의 차이를 잡아 섞기를 시작한다 (거의 같으면 섞지 않는다) */
  private capture(now: number, labels: { from: string | null; to: string | null }) {
    const { bones, clipQ, clipP, drawnQ, drawnP, offQ, offP } = this
    let maxAngle = 0
    for (let i = 0; i < bones.length; i++) {
      // off = 그린 · 클립⁻¹ (부모 공간) → off · 클립 = 그린
      const [cx, cy, cz, cw] = [clipQ[4 * i], clipQ[4 * i + 1], clipQ[4 * i + 2], clipQ[4 * i + 3]]
      const [dx, dy, dz, dw] = [drawnQ[4 * i], drawnQ[4 * i + 1], drawnQ[4 * i + 2], drawnQ[4 * i + 3]]
      let ox = dw * -cx + dx * cw + dy * -cz - dz * -cy
      let oy = dw * -cy - dx * -cz + dy * cw + dz * -cx
      let oz = dw * -cz + dx * -cy - dy * -cx + dz * cw
      let ow = dw * cw - dx * -cx - dy * -cy - dz * -cz
      // 짧은 길 (w ≥ 0)
      if (ow < 0) {
        ox = -ox
        oy = -oy
        oz = -oz
        ow = -ow
      }
      const length = Math.hypot(ox, oy, oz, ow) || 1
      const angle = 2 * Math.acos(Math.min(1, ow / length))
      // 반올림 차이 (믹서가 프레임마다 마지막 자리만 흔드는 값) 는 0 으로: 섞은 값이 우연히 믹서의 다음 값과 같아져
      // '믹서가 안 썼다' 로 잘못 보는 일을 막는다
      const still = angle < OFFSET_EPSILON_RAD
      offQ[4 * i] = still ? 0 : ox / length
      offQ[4 * i + 1] = still ? 0 : oy / length
      offQ[4 * i + 2] = still ? 0 : oz / length
      offQ[4 * i + 3] = still ? 1 : ow / length
      let moved = !still
      for (let axis = 0; axis < 3; axis++) {
        const d = drawnP[3 * i + axis] - clipP[3 * i + axis]
        offP[3 * i + axis] = Math.abs(d) < OFFSET_EPSILON_M ? 0 : d
        if (offP[3 * i + axis] !== 0) moved = true
      }
      this.offset[i] = moved ? 1 : 0
      maxAngle = Math.max(maxAngle, angle / RAD)
    }
    const moveM = this.maxJointMove()
    if (maxAngle < POSE_BLEND_SKIP_DEG && moveM < POSE_BLEND_SKIP_M) {
      this.active = null
      return
    }
    const durationS = blendDuration(maxAngle, moveM)
    this.active = { start: now, duration: durationS }
    this.info = { from: labels.from, to: labels.to, angleDeg: maxAngle, moveM, durationS, at: now }
  }

  /** 클립 · (그린 쪽으로 weight 만큼) : slerp(I, off, weight) · 클립 */
  private blended(i: number, weight: number): [number, number, number, number] {
    const { offQ, clipQ } = this
    const [ox, oy, oz, ow] = [offQ[4 * i], offQ[4 * i + 1], offQ[4 * i + 2], offQ[4 * i + 3]]
    // off^weight
    const half = Math.acos(Math.min(1, ow))
    const s = Math.sin(half)
    let px = 0
    let py = 0
    let pz = 0
    let pw = 1
    if (s > 1e-9) {
      const k = Math.sin(half * weight) / s
      px = ox * k
      py = oy * k
      pz = oz * k
      pw = Math.cos(half * weight)
    }
    const [cx, cy, cz, cw] = [clipQ[4 * i], clipQ[4 * i + 1], clipQ[4 * i + 2], clipQ[4 * i + 3]]
    const x = pw * cx + px * cw + py * cz - pz * cy
    const y = pw * cy - px * cz + py * cw + pz * cx
    const z = pw * cz + px * cy - py * cx + pz * cw
    const w = pw * cw - px * cx - py * cy - pz * cz
    const length = Math.hypot(x, y, z, w) || 1
    return [x / length, y / length, z / length, w / length]
  }

  /** 그린 자세와 클립 자세의 관절 위치 차이 중 가장 큰 것 (m). 로컬 회전·이동·배율로 스킨 뼈만 이어 잰다 */
  private maxJointMove(): number {
    const a = this.jointPositions(this.drawnQ, this.drawnP)
    const b = this.jointPositions(this.clipQ, this.clipP)
    let max = 0
    for (let i = 0; i < this.bones.length; i++) {
      max = Math.max(max, Math.hypot(a[3 * i] - b[3 * i], a[3 * i + 1] - b[3 * i + 1], a[3 * i + 2] - b[3 * i + 2]))
    }
    return max * this.outerScale()
  }

  private jointPositions(localQ: Float64Array, localP: Float64Array): Float64Array {
    const n = this.bones.length
    const worldQ = new Float64Array(4 * n)
    const worldP = new Float64Array(3 * n)
    const worldS = new Float64Array(n)
    for (const i of this.order) {
      const parent = this.parentIndex[i]
      const lq: [number, number, number, number] = [localQ[4 * i], localQ[4 * i + 1], localQ[4 * i + 2], localQ[4 * i + 3]]
      const scale = this.bones[i].scale.x
      if (parent < 0) {
        worldQ.set(lq, 4 * i)
        worldP.set([localP[3 * i], localP[3 * i + 1], localP[3 * i + 2]], 3 * i)
        worldS[i] = scale
        continue
      }
      const [px, py, pz, pw] = [worldQ[4 * parent], worldQ[4 * parent + 1], worldQ[4 * parent + 2], worldQ[4 * parent + 3]]
      const ps = worldS[parent]
      // p = 부모 위치 + 부모 회전 · (부모 배율 × 로컬 이동)
      const vx = localP[3 * i] * ps
      const vy = localP[3 * i + 1] * ps
      const vz = localP[3 * i + 2] * ps
      const tx = 2 * (py * vz - pz * vy)
      const ty = 2 * (pz * vx - px * vz)
      const tz = 2 * (px * vy - py * vx)
      worldP[3 * i] = worldP[3 * parent] + vx + pw * tx + (py * tz - pz * ty)
      worldP[3 * i + 1] = worldP[3 * parent + 1] + vy + pw * ty + (pz * tx - px * tz)
      worldP[3 * i + 2] = worldP[3 * parent + 2] + vz + pw * tz + (px * ty - py * tx)
      const [qx, qy, qz, qw] = lq
      worldQ[4 * i] = pw * qx + px * qw + py * qz - pz * qy
      worldQ[4 * i + 1] = pw * qy - px * qz + py * qw + pz * qx
      worldQ[4 * i + 2] = pw * qz + px * qy - py * qx + pz * qw
      worldQ[4 * i + 3] = pw * qw - px * qx - py * qy - pz * qz
      worldS[i] = ps * scale
    }
    return worldP
  }
}
