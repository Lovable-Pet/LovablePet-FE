import type { StageView } from './arStage'
import type { Vec3 } from './types'

export interface ScreenPoint {
  /** 화면 좌표 (0~1, 왼쪽 위 원점, u 는 오른쪽·v 는 아래로 커진다). 0~1 밖이면 화면 밖 */
  u: number
  v: number
  /** 카메라 정면 축 거리 (m). 깊이 센서 값과 같은 기준이다 */
  depth: number
}

/** 기준 공간의 점을 화면에 투영한다. 카메라 뒤에 있으면 null. 행렬은 열 우선 4x4 */
export function projectToView(point: Vec3, view: StageView): ScreenPoint | null {
  const m = view.viewMatrix
  const x = m[0] * point.x + m[4] * point.y + m[8] * point.z + m[12]
  const y = m[1] * point.x + m[5] * point.y + m[9] * point.z + m[13]
  const z = m[2] * point.x + m[6] * point.y + m[10] * point.z + m[14]
  // 카메라 공간은 -z 가 정면
  const depth = -z
  if (!(depth > 0)) return null
  const p = view.projectionMatrix
  const clipX = p[0] * x + p[4] * y + p[8] * z + p[12]
  const clipY = p[1] * x + p[5] * y + p[9] * z + p[13]
  const clipW = p[3] * x + p[7] * y + p[11] * z + p[15]
  if (!(clipW > 0)) return null
  // 클립 공간 y 는 위로 커지고 화면 v 는 아래로 커진다
  return { u: (clipX / clipW + 1) / 2, v: (1 - clipY / clipW) / 2, depth }
}

export const isOnScreen = ({ u, v }: ScreenPoint) => u >= 0 && u <= 1 && v >= 0 && v <= 1

/** 카메라가 바라보는 방향 (기준 공간, 단위 벡터). 카메라 공간 -z 축 */
export function viewForward(view: StageView): Vec3 {
  const m = view.viewMatrix
  // 기준 → 카메라 회전의 세 번째 행이 카메라 z 축 (기준 공간)
  const x = -m[2]
  const y = -m[6]
  const z = -m[10]
  const length = Math.hypot(x, y, z)
  return length > 0 ? { x: x / length, y: y / length, z: z / length } : { x: 0, y: 0, z: -1 }
}
