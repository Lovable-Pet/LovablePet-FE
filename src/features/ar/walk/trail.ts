// 사용자 발자취. 휴대폰(카메라)을 바닥에 투영한 점을 일정 간격으로 남기고, 개는 이 길을 따라간다 (일직선으로 질러가지 않는다).
// 바닥 위 2차원 (x, z) 만 본다.
//
// 길은 개 자리에서 시작한다: points[0] 은 개가 지나는 조각의 시작점 (처음엔 개 자리, 그 뒤엔 지나간 마지막 점), 끝은 사용자.
// 개가 길 위 어디쯤인지(발)는 개 자리를 길에 내린 점이고, 길을 따라 앞으로만 간다 (progress).
// 지나간 점은 이 진행 거리로 버린다. 원을 그리며 돌 때 점이 한꺼번에 버려지거나 겨누는 점이 튀지 않는다

export interface Vec2 {
  x: number
  z: number
}

/** 이만큼(m) 움직일 때마다 점을 남긴다 (15–20cm) */
export const TRAIL_SPACING_M = 0.18
/**
 * 되돌아온 길 끊기: 새 점이 앞쪽 옛 점과 이만큼(m) 안이고, 그 사이 발자취가 직선 거리의 TRAIL_LOOP_RATIO 배보다 길면
 * 그 사이를 버린다 (같은 길로 되돌아오면 개가 갔다 돌아오지 않게).
 * 책상을 끼고 도는 U턴은 양쪽 길이 이보다 멀어 끊기지 않는다
 */
export const TRAIL_LOOP_M = 0.4
export const TRAIL_LOOP_RATIO = 2
/** 사용자가 마지막 조각을 거슬러 끝 점 뒤로 이만큼(m) 넘게 오면 끝 점을 거둔다 (서 있을 때 손 떨림으로는 거두지 않게) */
export const TRAIL_RETRACE_M = 0.05
/** 개 발을 찾을 때 지난 발에서 길을 따라 이만큼(m) 앞까지만 본다 (U턴 반대쪽 길로 건너뛰지 않게) */
export const TRAIL_SEARCH_M = 0.6
/** 점 개수 상한 (오래된 것부터 버린다). 0.18m 간격이면 36m */
export const TRAIL_MAX_POINTS = 200

const dist = (a: Vec2, b: Vec2) => Math.hypot(a.x - b.x, a.z - b.z)
const lerp = (a: Vec2, b: Vec2, t: number): Vec2 => ({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t })

export class Trail {
  /** 길의 점 (points[0] 은 개가 지나는 조각의 시작). 끝은 user */
  private points: Vec2[] = []
  /** 마지막으로 본 사용자 위치 */
  private user: Vec2 | null = null
  /** points[0] 에서 발까지 길 거리 (m) */
  private progress = 0
  /** 개 중심에서 발(개 자리를 길에 내린 점)까지 (m): 개가 길에서 벗어난 거리 */
  private off = 0
  private readonly resetRadius: number
  /** 이번 프레임에 길을 끊거나 다시 시작했는지 (사용자 속도 추정에서 이 프레임을 뺀다) */
  cut = false

  /** resetRadius: 사용자가 개 둘레 이 반경(m) 안으로 들어오면 (개 위를 지나가거나 개 쪽으로 옴) 길을 개 자리에서 다시 시작한다 */
  constructor(resetRadius: number) {
    this.resetRadius = resetRadius
  }

  /** 개 앞에 남은 점 수 */
  get count() {
    return Math.max(0, this.points.length - 1)
  }

  get userPosition(): Vec2 | null {
    return this.user
  }

  /** 개 앞에 남은 점 (디버그·4단계 앞 바닥 검사용) */
  get ahead(): readonly Vec2[] {
    return this.points.slice(1)
  }

  /** 개 중심이 길에서 벗어난 거리 (m). locate 뒤에 맞다 */
  get offset() {
    return this.off
  }

  clear() {
    this.points = []
    this.user = null
    this.progress = 0
    this.off = 0
  }

  /**
   * 사용자 위치를 받는다. 마지막 점에서 TRAIL_SPACING_M 넘게 멀어졌고 멀어지는 중이면 점을 남긴다.
   * 마지막 점 쪽으로 다가오는 중에는 남기지 않는다: 남기면 다음 프레임들에 되짚기(retrace)로 다시 거둬서 남은 길이
   * 톱니처럼 늘었다 줄고, 거두는 프레임은 사용자 속도에서 빠져 다가오는데도 멀어지는 것으로 잰다
   */
  record(user: Vec2, dog: Vec2) {
    this.cut = false
    const previous = this.user
    this.user = { ...user }
    if (dist(dog, user) < this.resetRadius) {
      // 개 둘레 안: 길을 개 자리에서 다시 시작한다. 개 앞(사용자가 오던 쪽)에 남은 점을 버리고, 둘레 안에서는 점을 남기지 않는다
      if (this.points.length > 1) this.cut = true
      this.restart(dog)
      return
    }
    if (!this.points.length) this.restart(dog)
    this.retrace(user)
    const last = this.points[this.points.length - 1]
    if (dist(last, user) < TRAIL_SPACING_M) return
    if (previous && dist(last, user) <= dist(last, previous)) return
    this.cutLoop(user)
    if (dist(this.points[this.points.length - 1], user) >= TRAIL_SPACING_M) this.points.push({ ...user })
    if (this.points.length > TRAIL_MAX_POINTS) {
      this.points.splice(0, this.points.length - TRAIL_MAX_POINTS)
      this.progress = 0
    }
  }

  /**
   * 사용자가 온 길을 되짚어 오면 (마지막 조각을 거슬러 끝 점 뒤로 TRAIL_RETRACE_M 넘게, 조각에서 TRAIL_LOOP_M 안) 끝 점을 거둔다.
   * 매 프레임 본다: 다음 점을 남기기 전에도 길 끝이 뾰족하게 남아 남은 길이 늘지 않게 (개 쪽으로 다가올 때 개가 출발하지 않게).
   * 첫 점(개가 지나는 조각의 시작)은 거두지 않는다
   */
  private retrace(user: Vec2) {
    const { points } = this
    while (points.length >= 2) {
      const a = points[points.length - 2]
      const b = points[points.length - 1]
      const segment = dist(a, b)
      if (segment <= 1e-9) {
        points.pop()
        continue
      }
      const back = ((user.x - b.x) * (b.x - a.x) + (user.z - b.z) * (b.z - a.z)) / segment
      const t = Math.min(1, Math.max(0, ((user.x - a.x) * (b.x - a.x) + (user.z - a.z) * (b.z - a.z)) / (segment * segment)))
      if (back >= -TRAIL_RETRACE_M || dist(lerp(a, b, t), user) >= TRAIL_LOOP_M) return
      points.pop()
      this.cut = true
    }
  }

  private restart(dog: Vec2) {
    this.points = [{ ...dog }]
    this.progress = 0
    this.off = 0
  }

  /**
   * 되돌아온 길 끊기: 발 앞 길(조각 위 점 포함) 중 새 사용자 위치에서 TRAIL_LOOP_M 안이고 거기서 사용자까지 발자취가
   * 직선의 TRAIL_LOOP_RATIO 배보다 긴 가장 앞 자리에서 끊고 사용자로 바로 잇는다.
   * 같은 길로 되돌아오거나(갔다 온 끝을 개가 돌아 나오지 않게) 개 쪽으로 다가오면(남은 길이 늘지 않게) 걸린다
   */
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
    // 마지막 점 → 사용자는 새 조각이라 보지 않는다
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i]
      const b = points[i + 1]
      const segment = dist(a, b)
      if (segment <= 1e-9) continue
      // 첫 조각은 발 앞만
      const lo = i === 0 ? Math.min(1, this.progress / segment) : 0
      const raw = ((user.x - a.x) * (b.x - a.x) + (user.z - a.z) * (b.z - a.z)) / (segment * segment)
      const t = Math.min(1, Math.max(lo, raw))
      const point = lerp(a, b, t)
      const direct = dist(point, user)
      const rest = (1 - t) * segment + tail[i + 1]
      if (direct < TRAIL_LOOP_M && rest > TRAIL_LOOP_RATIO * Math.max(direct, TRAIL_SPACING_M)) {
        points.length = i + 1
        if (t > 1e-6) points.push(point)
        this.cut = true
        return
      }
    }
  }

  /** 길: 점들과 사용자 */
  private path(): Vec2[] {
    return this.user ? [...this.points, this.user] : [...this.points]
  }

  /**
   * 개 발을 찾는다: 지난 발에서 길을 따라 TRAIL_SEARCH_M 앞까지 중 개에게 가장 가까운 점 (뒤로는 가지 않는다).
   * 발 앞 조각의 시작점 전 점은 지나간 것으로 버린다
   */
  locate(dog: Vec2) {
    const path = this.path()
    if (path.length < 2) {
      this.off = path[0] ? dist(dog, path[0]) : 0
      return
    }
    // 사용자가 되돌아와 길이 짧아졌으면 발은 길 끝까지만
    let total = 0
    for (let i = 0; i < path.length - 1; i++) total += dist(path[i], path[i + 1])
    const from = Math.min(this.progress, total)
    const to = from + TRAIL_SEARCH_M
    type Foot = { distance: number; segment: number; start: number; along: number; point: Vec2 }
    let best: Foot | null = null
    let arc = 0
    for (let i = 0; i < path.length - 1 && arc <= to; i++) {
      const a = path[i]
      const b = path[i + 1]
      const length = dist(a, b)
      const end = arc + length
      if (end >= from && length > 1e-9) {
        const lo = Math.max(0, (from - arc) / length)
        const hi = Math.min(1, (to - arc) / length)
        const raw = ((dog.x - a.x) * (b.x - a.x) + (dog.z - a.z) * (b.z - a.z)) / (length * length)
        const t = Math.min(hi, Math.max(lo, raw))
        const point = lerp(a, b, t)
        const distance = dist(dog, point)
        // 같으면 앞쪽(먼저 찾은 것)을 둔다
        if (!best || distance < best.distance - 1e-9) best = { distance, segment: i, start: arc, along: arc + t * length, point }
      }
      arc = end
    }
    // 길이가 0 인 조각뿐이면 (사용자가 마지막 점 위) 길 끝
    if (!best) {
      const end = path[path.length - 1]
      best = { distance: dist(dog, end), segment: path.length - 2, start: total, along: total, point: end }
    }
    // 발이 있는 조각 전의 점은 지나갔다 (마지막 조각이면 사용자 앞 점 하나는 남긴다)
    const drop = Math.min(best.segment, this.points.length - 1)
    if (drop > 0) this.points.splice(0, drop)
    this.progress = best.along - (drop > 0 ? best.start : 0)
    this.off = best.distance
  }

  /**
   * 남은 길 (m): 개 → 겨누는 점(발에서 길을 따라 lookAhead 앞) → 길 → 사용자.
   * 개는 겨누는 점 쪽으로 가서, 모퉁이를 질러가거나 길에서 벗어나 있으면 그만큼 짧거나 길다.
   * 사용자를 아직 모르면 0. locate 뒤에 맞다
   */
  length(dog: Vec2, lookAhead: number): number {
    const ahead = this.along(lookAhead)
    return ahead ? dist(dog, ahead.point) + ahead.rest : 0
  }

  /** 발에서 길을 따라 distance(m) 앞의 점. 길이 더 짧으면 사용자 위치. locate 뒤에 맞다 */
  pointAhead(distance: number): Vec2 | null {
    return this.along(distance)?.point ?? null
  }

  /** 발에서 길을 따라 distance 앞의 점과 그 점에서 사용자까지 남은 길 */
  private along(distance: number): { point: Vec2; rest: number } | null {
    if (!this.user) return null
    const path = this.path()
    const goal = this.progress + distance
    let arc = 0
    let point: Vec2 | null = null
    let rest = 0
    for (let i = 0; i < path.length - 1; i++) {
      const length = dist(path[i], path[i + 1])
      if (point) rest += length
      else if (arc + length >= goal && length > 0) {
        const t = Math.max(0, goal - arc) / length
        point = lerp(path[i], path[i + 1], t)
        rest = (1 - t) * length
      }
      arc += length
    }
    return point ? { point, rest } : { point: { ...this.user }, rest: 0 }
  }
}
