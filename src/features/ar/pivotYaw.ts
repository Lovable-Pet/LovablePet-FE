// 개 방향(pivot)을 쓰고 읽는 일. model-viewer 의 scene.yaw 를 쓰지 않는다.
//
// scene.yaw setter 는 pivot.rotation.y 만 바꾼다. 그런데 ARRenderer.moveScene 이 매 프레임
// pivot.quaternion.rotateTowards(goalYaw) 를 부르고, 부동소수 오차로 아주 작은 회전이라도 일어나면
// quaternion 에서 Euler XYZ 가 다시 계산된다. |yaw| > 90° 면 그 Euler 는 (π, π−yaw, π) 라서
// 다음에 rotation.y = yaw 만 덮어쓰면 x·z 의 π 가 남아 개가 π−yaw 쪽으로 그려진다 (한두 프레임 깜빡임).
// 같은 이유로 scene.yaw 를 읽어도 |yaw| > 90° 에서 틀린 값이 나온다.

interface EulerLike {
  set(x: number, y: number, z: number): unknown
}
export interface PivotLike {
  rotation: EulerLike
  /** 마지막으로 그릴 때 계산된 월드 행렬 (열 우선) */
  matrixWorld: { elements: ArrayLike<number> }
}

/** [−π, π] 로 */
export const wrapYaw = (yaw: number) => Math.atan2(Math.sin(yaw), Math.cos(yaw))

/** 방향을 통째로 넣는다 (x·z 회전 0). 넣은 yaw ([−π, π]) 를 돌려준다. ARRenderer.goalYaw 에도 같은 값을 넣는다 */
export function setPivotYaw(pivot: PivotLike, yaw: number): number {
  const wrapped = wrapYaw(yaw)
  pivot.rotation.set(0, wrapped, 0)
  return wrapped
}

/** 그려진 방향: pivot 월드 행렬의 앞(+z) 방향으로 계산한 yaw ([−π, π]). 앞 방향이 거의 위·아래면 null */
export function drawnYaw(pivot: PivotLike): number | null {
  const e = pivot.matrixWorld.elements
  const x = e[8]
  const z = e[10]
  if (Math.hypot(x, z) < 1e-6) return null
  return Math.atan2(x, z)
}
