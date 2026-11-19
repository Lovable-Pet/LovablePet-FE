// 절차적 갸우뚱: 앉거나 엎드린 개를 톡 했을 때 (head_tilt 클립은 서기 자세 클립이라 못 쓴다).
// 머리 뼈를 '바라보는 축'(../neckAim.ts findNeckBones 의 gazeAxis, 머리 로컬) 둘레로 옆으로 기울였다가 돌아온다.
// 렌더러를 모른다. 렌더 직전 자세 층(../modelViewerArStage.ts)이 자세 섞기 뒤·바라보기 앞에 더한다 (바라보기는 기울기를 남긴다)

/** 기울이는 각 (°) · 전체 길이 (s): 들기 → 잠깐 유지 → 돌아오기, 처음과 끝 가감속 */
export const HEAD_TILT_DEG = 18
export const HEAD_TILT_S = 0.9
/** 전체 중 들기·유지 몫 (나머지가 돌아오기) */
const RISE = 0.4
const HOLD = 0.2

const smoothstep = (u: number) => u * u * (3 - 2 * u)

/** 시작에서 t 초 뒤 기울기 비율 0~1 (길이 밖이면 0) */
export function headTiltAmount(t: number, duration = HEAD_TILT_S): number {
  const u = t / duration
  if (!(u > 0) || u >= 1) return 0
  if (u < RISE) return smoothstep(u / RISE)
  if (u < RISE + HOLD) return 1
  return 1 - smoothstep((u - RISE - HOLD) / (1 - RISE - HOLD))
}

/** q · R(axis, angle) (axis 는 단위 벡터, q 의 로컬 축) → [x, y, z, w] */
export function rollLocal(
  q: { x: number; y: number; z: number; w: number },
  axis: readonly [number, number, number],
  angle: number,
): [number, number, number, number] {
  const s = Math.sin(angle / 2)
  const rx = axis[0] * s
  const ry = axis[1] * s
  const rz = axis[2] * s
  const rw = Math.cos(angle / 2)
  return [
    q.w * rx + q.x * rw + q.y * rz - q.z * ry,
    q.w * ry - q.x * rz + q.y * rw + q.z * rx,
    q.w * rz + q.x * ry - q.y * rx + q.z * rw,
    q.w * rw - q.x * rx - q.y * ry - q.z * rz,
  ]
}
