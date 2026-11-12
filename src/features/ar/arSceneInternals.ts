import type { ModelViewerElement } from '@google/model-viewer'

// model-viewer 의 내부 장면(ModelScene)을 쓰는 곳은 이 파일 하나다. 4.1.0 소스 기준 (package.json 에 고정).
//
// 공개 API 로는 AR 에서 개를 숨길 수 없다.
// - 재질을 투명하게 하면(model.materials) 개만 사라지고, 발밑의 바닥 표시 상자(PlacementBox)는 그대로 떨어져 보인다
// - setAlphaMode 는 깊이 쓰기·알파 기준값을 바꿔 버려 원래대로 되돌릴 수 없다
// 내부 장면에서는 개·바닥 표시 상자·그림자가 target 하나에 매달려 있어 target 만 숨긴다.
// 버전이 바뀌어 모양이 다르면 null 을 돌려주고, 부르는 쪽은 아무것도 하지 않는다

interface MaterialLike {
  transparent: boolean
  opacity: number
  needsUpdate: boolean
}

interface NodeLike {
  visible: boolean
  isMesh?: boolean
  material?: MaterialLike | MaterialLike[]
  traverse(visit: (node: NodeLike) => void): void
}

export interface ArSceneInternals {
  /** 개·바닥 표시 상자·그림자를 함께 숨기거나 보인다 */
  setVisible(visible: boolean): void
  /** 장면이 놓인 높이(m). AR 에서 바닥을 찾으면 이 값이 바닥까지 내려간다 */
  floorY(): number
  /** 개 모델의 재질 (three.js). 모델이 없으면 빈 배열 */
  materials(): MaterialLike[]
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null
const isNode = (value: unknown): value is NodeLike =>
  isRecord(value) && typeof value.visible === 'boolean' && typeof value.traverse === 'function'
const isMaterial = (value: unknown): value is MaterialLike =>
  isRecord(value) && typeof value.transparent === 'boolean' && typeof value.opacity === 'number'

export function getArSceneInternals(mv: ModelViewerElement): ArSceneInternals | null {
  // 내부 장면은 Symbol('scene') 키로 요소에 붙어 있다. 같은 Symbol 을 import 하면 번들이 나뉠 때 다른 값이 될 수 있어 이름으로 찾는다
  const keys = Object.getOwnPropertySymbols(mv).filter((key) => key.description === 'scene')
  if (keys.length !== 1) return null
  const scene: unknown = (mv as unknown as Record<symbol, unknown>)[keys[0]]
  if (!isRecord(scene) || !isNode(scene.target) || !isRecord(scene.pivot)) return null
  const target = scene.target
  const position = scene.pivot.position
  if (!isRecord(position) || typeof position.y !== 'number') return null

  return {
    setVisible: (visible) => {
      target.visible = visible
    },
    floorY: () => position.y as number,
    materials: () => {
      // 모델은 다시 불러오면 바뀌어서 그때그때 읽는다
      const model: unknown = scene.model
      const found = new Set<MaterialLike>()
      if (isNode(model)) {
        model.traverse((node) => {
          if (!node.isMesh) return
          for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
            if (isMaterial(material)) found.add(material)
          }
        })
      }
      return [...found]
    },
  }
}
