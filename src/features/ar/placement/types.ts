// AR 배치 로직이 쓰는 값. model-viewer·three.js 를 모른다 (산책 모드·렌더러 교체 때 그대로 쓴다)

/** AR 기준 공간(local) 좌표. 단위 m, y 가 위 */
export interface Vec3 {
  x: number
  y: number
  z: number
}

/** hit-test 로 맞은 면 */
export interface SurfaceHit {
  position: Vec3
  /** 면의 위쪽 방향(단위 벡터). 바닥이면 (0, 1, 0) 에 가깝고 벽이면 y 가 0 에 가깝다 */
  normal: Vec3
}

/** hit-test 광선. 방향은 단위 벡터가 아니어도 된다 */
export interface Ray {
  origin: Vec3
  direction: Vec3
}

/** 바닥 위 거리 (높이는 보지 않는다) */
export const distanceXZ = (a: Vec3, b: Vec3) => Math.hypot(a.x - b.x, a.z - b.z)
