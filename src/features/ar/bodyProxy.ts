import type { Vec3 } from './placement/types'

// 카메라에서 개 몸까지 거리 (가까이 붙을 때 안내·흐리기·숨기기, ./nearCamera.ts). 뼈 사이를 잇는 캡슐 여러 개로 몸을 덮는다:
// 몸통(골반→척추→가슴→목→머리→코)·꼬리·네 다리. 캡슐 반지름은 불러올 때 한 번, 스킨의 바인드 자세 정점을 가장 가까운 캡슐에
// 나눠 그 거리의 상위 값(BODY_PROXY_PERCENTILE)으로 잡는다 (템플릿마다 털·체형이 달라도 맞게). 매 프레임은 뼈의 월드 위치만 읽어
// 캡슐 표면까지 거리를 잰다 (애니메이션·크기 배율 반영). three 의 Object3D·SkinnedMesh 를 구조로만 받는다 (three 타입 없음)

/** 캡슐을 잇는 뼈 사슬. 6종 모두 같은 이름 */
export const BODY_PROXY_CHAINS: readonly (readonly string[])[] = [
  ['pelvis_jnt', 'spine_1_jnt', 'spine_2_jnt', 'chest_jnt', 'neck_base_jnt', 'neck_mid_jnt', 'head_jnt', 'nose_jnt'],
  ['pelvis_jnt', 'tail_1_jnt', 'tail_2_jnt', 'tail_3_jnt', 'tail_4_jnt', 'tail_5_jnt', 'tail_6_jnt', 'tail_7_jnt'],
  ['chest_jnt', 'L_shoulder_jnt', 'L_elbow_jnt', 'L_wrist_jnt', 'L_hand_jnt', 'LF_toes_jnt'],
  ['chest_jnt', 'R_shoulder_jnt', 'R_elbow_jnt', 'R_wrist_jnt', 'R_hand_jnt', 'RF_toes_jnt'],
  ['pelvis_jnt', 'L_hip_jnt', 'L_knee_jnt', 'L_ankle_jnt', 'L_foot_jnt', 'LB_toes_jnt'],
  ['pelvis_jnt', 'R_hip_jnt', 'R_knee_jnt', 'R_ankle_jnt', 'R_foot_jnt', 'RB_toes_jnt'],
]
/** 캡슐 반지름 = 그 캡슐에 나뉜 정점 거리의 이 백분위 (귀 끝·털 끝 몇 개에 끌려가지 않게) */
export const BODY_PROXY_PERCENTILE = 0.98

interface AttributeLike {
  readonly count: number
  getX(index: number): number
  getY(index: number): number
  getZ(index: number): number
  getW(index: number): number
}

export interface ProxyNode {
  readonly name: string
  readonly matrixWorld: { readonly elements: ArrayLike<number> }
  readonly children: readonly ProxyNode[]
  /** SkinnedMesh 만 */
  readonly isSkinnedMesh?: boolean
  readonly skeleton?: { readonly bones: readonly unknown[]; readonly boneInverses: readonly { readonly elements: ArrayLike<number> }[] }
  readonly bindMatrix?: { readonly elements: ArrayLike<number> }
  readonly geometry?: { readonly attributes: Record<string, AttributeLike | undefined> }
}

type V3 = [number, number, number]

/** 열 우선 4x4 · 점 */
const transform = (e: ArrayLike<number>, [x, y, z]: V3): V3 => [
  e[0] * x + e[4] * y + e[8] * z + e[12],
  e[1] * x + e[5] * y + e[9] * z + e[13],
  e[2] * x + e[6] * y + e[10] * z + e[14],
]

/** 회전·같은 배율·이동 행렬의 역행렬 → 이동 (바인드 역행렬 → 바인드 자세 위치) */
function inversePosition(e: ArrayLike<number>): V3 {
  // M = s·R | t  →  M⁻¹ 의 위치 = −R^T·t / s
  const s2 = e[0] * e[0] + e[1] * e[1] + e[2] * e[2] || 1
  const [tx, ty, tz] = [e[12], e[13], e[14]]
  return [
    -(e[0] * tx + e[1] * ty + e[2] * tz) / s2,
    -(e[4] * tx + e[5] * ty + e[6] * tz) / s2,
    -(e[8] * tx + e[9] * ty + e[10] * tz) / s2,
  ]
}

/** 점 p 에서 선분 ab 까지 거리 */
function segmentDistance(p: V3, a: V3, b: V3): number {
  const ab: V3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]]
  const ap: V3 = [p[0] - a[0], p[1] - a[1], p[2] - a[2]]
  const len2 = ab[0] * ab[0] + ab[1] * ab[1] + ab[2] * ab[2]
  const t = len2 > 0 ? Math.min(1, Math.max(0, (ap[0] * ab[0] + ap[1] * ab[1] + ap[2] * ab[2]) / len2)) : 0
  return Math.hypot(ap[0] - ab[0] * t, ap[1] - ab[1] * t, ap[2] - ab[2] * t)
}

const columnScale = (e: ArrayLike<number>) => Math.hypot(e[0], e[1], e[2])

export interface BodyCapsule {
  a: ProxyNode
  b: ProxyNode
  /** 바인드 자세 단위의 반지름 */
  radius: number
}

export class BodyProxy {
  readonly capsules: readonly BodyCapsule[]
  /** 크기 배율 기준 뼈와 그 바인드 자세 배율 */
  private readonly reference: ProxyNode
  private readonly referenceBindScale: number

  constructor(capsules: readonly BodyCapsule[], reference: ProxyNode, referenceBindScale: number) {
    this.capsules = capsules
    this.reference = reference
    this.referenceBindScale = referenceBindScale
  }

  /** 지금 뼈 월드 행렬 기준 바인드 단위 → 월드 m 배율 */
  get scale(): number {
    return columnScale(this.reference.matrixWorld.elements) / this.referenceBindScale
  }

  /** 월드 점에서 몸 표면까지 거리 (m). 몸 안이면 0 아래 */
  distance(point: Vec3): number {
    const p: V3 = [point.x, point.y, point.z]
    const scale = this.scale
    let best = Infinity
    for (const { a, b, radius } of this.capsules) {
      const ea = a.matrixWorld.elements
      const eb = b.matrixWorld.elements
      const d = segmentDistance(p, [ea[12], ea[13], ea[14]], [eb[12], eb[13], eb[14]]) - radius * scale
      if (d < best) best = d
    }
    return best
  }
}

/**
 * 모델에서 캡슐을 만든다. 사슬 뼈가 스킨에 없으면 그 마디는 건너뛴다. 몸통 사슬(골반~코)이 없으면 null (거리를 잴 수 없음)
 */
export function buildBodyProxy(model: ProxyNode, percentile = BODY_PROXY_PERCENTILE): BodyProxy | null {
  const byName = new Map<string, ProxyNode>()
  const meshes: ProxyNode[] = []
  const visit = (node: ProxyNode) => {
    if (!byName.has(node.name)) byName.set(node.name, node)
    if (node.isSkinnedMesh && node.skeleton && node.geometry && node.bindMatrix) meshes.push(node)
    for (const child of node.children) visit(child)
  }
  visit(model)
  const skin = meshes.find((mesh) => BODY_PROXY_CHAINS[0].every((name) => mesh.skeleton!.bones.includes(byName.get(name))))
  if (!skin) return null
  const skeleton = skin.skeleton!
  const bindOf = (node: ProxyNode) => {
    const index = skeleton.bones.indexOf(node)
    return index < 0 ? null : skeleton.boneInverses[index].elements
  }
  // 마디 (바인드 자세 위치)
  const segments: { a: ProxyNode; b: ProxyNode; pa: V3; pb: V3; distances: number[] }[] = []
  for (const chain of BODY_PROXY_CHAINS) {
    for (let i = 0; i + 1 < chain.length; i++) {
      const a = byName.get(chain[i])
      const b = byName.get(chain[i + 1])
      const ia = a && bindOf(a)
      const ib = b && bindOf(b)
      if (!a || !b || !ia || !ib) continue
      segments.push({ a, b, pa: inversePosition(ia), pb: inversePosition(ib), distances: [] })
    }
  }
  if (segments.length === 0) return null
  // 정점을 가장 가까운 마디에 나눈다 (바인드 자세: bindMatrix · position). 스킨이 여럿이면 모두
  for (const mesh of meshes) {
    if (mesh.skeleton !== skeleton && !BODY_PROXY_CHAINS[0].every((name) => mesh.skeleton!.bones.includes(byName.get(name)))) continue
    const position = mesh.geometry!.attributes.position
    if (!position) continue
    const bind = mesh.bindMatrix!.elements
    // 다른 스킨이면 같은 뼈의 바인드 역행렬이 같다고 본다 (glTF 는 보통 스킨 하나)
    for (let i = 0; i < position.count; i++) {
      const v = transform(bind, [position.getX(i), position.getY(i), position.getZ(i)])
      let best = Infinity
      let at = -1
      segments.forEach((segment, index) => {
        const d = segmentDistance(v, segment.pa, segment.pb)
        if (d < best) {
          best = d
          at = index
        }
      })
      if (at >= 0) segments[at].distances.push(best)
    }
  }
  const capsules: BodyCapsule[] = []
  for (const segment of segments) {
    if (segment.distances.length === 0) continue
    const sorted = segment.distances.sort((x, y) => x - y)
    const radius = sorted[Math.min(sorted.length - 1, Math.floor(percentile * (sorted.length - 1)))]
    capsules.push({ a: segment.a, b: segment.b, radius })
  }
  const reference = byName.get('pelvis_jnt')!
  const referenceBind = bindOf(reference)!
  // 바인드 역행렬의 배율 = 1 / 바인드 자세 배율
  const bindScale = 1 / (columnScale(referenceBind) || 1)
  return capsules.length ? new BodyProxy(capsules, reference, bindScale) : null
}
