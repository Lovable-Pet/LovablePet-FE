import type { Vec3 } from './types'

/**
 * 모델의 앞쪽 방향(y축 회전, 라디안). glTF 는 +z 가 앞이라 0 이다.
 * 폰에서 놓았을 때 얼굴 대신 옆이나 엉덩이가 보이면 여기만 고친다 (옆: ±π/2, 엉덩이: π)
 */
export const MODEL_FRONT_YAW = 0

/**
 * from 에 놓인 개가 to 를 바라보게 하는 y축 회전(라디안). 높이는 보지 않는다 (바닥에 투영한 점을 본다).
 * y축으로 yaw 만큼 돌리면 +z 가 (sin yaw, 0, cos yaw) 가 되므로 atan2(dx, dz) 다.
 * 두 점이 겹치면(휴대폰이 바로 위) 0
 */
export function yawToward(from: Vec3, to: Vec3): number {
  const dx = to.x - from.x
  const dz = to.z - from.z
  if (dx === 0 && dz === 0) return -MODEL_FRONT_YAW
  return Math.atan2(dx, dz) - MODEL_FRONT_YAW
}
