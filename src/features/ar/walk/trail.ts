// 사용자 발자취. 휴대폰(카메라)을 바닥에 투영한 점을 일정 간격으로 남기고, 개는 이 점들을 따라간다 (일직선으로 질러가지 않는다).
// 바닥 위 2차원 (x, z) 만 본다

export interface Vec2 {
  x: number
  z: number
}

/** 이만큼(m) 움직일 때마다 점을 남긴다 (15–20cm) */
export const TRAIL_SPACING_M = 0.18
/** 개가 이만큼(m) 안에 들어온 앞 점은 지나간 것으로 본다 */
export const TRAIL_PASS_M = 0.15
/**
 * 되돌아온 길 끊기: 새 점이 앞쪽 옛 점과 이만큼(m) 안이고, 그 사이 발자취가 직선 거리의 TRAIL_LOOP_RATIO 배보다 길면
 * 그 사이를 버린다 (같은 길로 되돌아오거나 개 쪽으로 오면 개가 갔다 돌아오지 않게).
 * 책상을 끼고 도는 U턴은 양쪽 길이 이보다 멀어 끊기지 않는다
 */
export const TRAIL_LOOP_M = 0.4
export const TRAIL_LOOP_RATIO = 2
/** 점 개수 상한 (오래된 것부터 버린다). 0.18m 간격이면 36m */
export const TRAIL_MAX_POINTS = 200

const dist = (a: Vec2, b: Vec2) => Math.hypot(a.x - b.x, a.z - b.z)

export class Trail {
  /** 개 앞에 남은 점 (오래된 것부터) */
  private points: Vec2[] = []
  /** 마지막으로 본 사용자 위치. 발자취 끝은 늘 여기다 */
  private user: Vec2 | null = null
  /** 이번 프레임에 되돌아온 길을 끊었는지 (사용자 속도 추정에서 이 프레임을 뺀다) */
  cut = false

  get count() {
    return this.points.length
  }

  get userPosition(): Vec2 | null {
    return this.user
  }

  /** 앞에 남은 점 (디버그·4단계 앞 바닥 검사용) */
  get ahead(): readonly Vec2[] {
    return this.points
  }

  clear() {
    this.points = []
    this.user = null
  }

  /** 사용자 위치를 받는다. 마지막 점에서 TRAIL_SPACING_M 넘게 멀어졌으면 점을 남긴다 */
  record(user: Vec2, dog: Vec2) {
    this.cut = false
    this.user = { ...user }
    const last = this.points.at(-1)
    if (last && dist(last, user) < TRAIL_SPACING_M) return
    // 개 바로 옆으로 왔으면 앞 점을 모두 버린다 (개가 사용자 쪽으로 바로 간다)
    if (this.points.length && dist(dog, user) < TRAIL_LOOP_M) {
      this.points = []
      this.cut = true
    } else {
      this.cutLoop(user)
    }
    const end = this.points.at(-1)
    if (!end || dist(end, user) >= TRAIL_SPACING_M) this.points.push({ ...user })
    if (this.points.length > TRAIL_MAX_POINTS) this.points.splice(0, this.points.length - TRAIL_MAX_POINTS)
  }

  /** 새 점 가까이(TRAIL_LOOP_M)의 앞 점 중 그 사이 발자취가 고리처럼 긴 가장 오래된 점에서 끊는다 */
  private cutLoop(user: Vec2) {
    const { points } = this
    if (points.length < 2) return
    // 뒤에서부터 각 점에서 발자취 끝(사용자)까지 길이
    const tail: number[] = new Array(points.length)
    let length = dist(points[points.length - 1], user)
    tail[points.length - 1] = length
    for (let i = points.length - 2; i >= 0; i--) {
      length += dist(points[i], points[i + 1])
      tail[i] = length
    }
    for (let i = 0; i < points.length; i++) {
      const direct = dist(points[i], user)
      if (direct < TRAIL_LOOP_M && tail[i] > TRAIL_LOOP_RATIO * Math.max(direct, TRAIL_SPACING_M)) {
        points.length = i + 1
        this.cut = true
        return
      }
    }
  }

  /**
   * 개가 지나간 앞 점을 버린다: 개에게서 TRAIL_PASS_M 안이거나, 그 점에서 다음 점(또는 사용자)으로 가는 방향이
   * 개 쪽으로 되돌아오면 (개가 그 점의 수직선을 이미 넘었다)
   */
  prune(dog: Vec2) {
    const { points } = this
    let dropped = 0
    while (dropped < points.length) {
      const point = points[dropped]
      const next = points[dropped + 1] ?? this.user
      const passed =
        dist(dog, point) < TRAIL_PASS_M ||
        (next !== null && (point.x - dog.x) * (next.x - point.x) + (point.z - dog.z) * (next.z - point.z) < 0)
      if (!passed) break
      dropped++
    }
    if (dropped) points.splice(0, dropped)
  }

  /** 개 → 남은 점 → 사용자 길이 (m). 사용자를 아직 모르면 0 */
  length(dog: Vec2): number {
    if (!this.user) return 0
    let total = 0
    let from = dog
    for (const point of this.points) {
      total += dist(from, point)
      from = point
    }
    return total + dist(from, this.user)
  }

  /** 개 → 남은 점 → 사용자 길을 따라 distance(m) 앞의 점. 길이 더 짧으면 사용자 위치 */
  pointAt(dog: Vec2, distance: number): Vec2 | null {
    if (!this.user) return null
    let left = distance
    let from = dog
    for (const to of [...this.points, this.user]) {
      const segment = dist(from, to)
      if (segment >= left && segment > 0) {
        const t = left / segment
        return { x: from.x + (to.x - from.x) * t, z: from.z + (to.z - from.z) * t }
      }
      left -= segment
      from = to
    }
    return { ...this.user }
  }
}
