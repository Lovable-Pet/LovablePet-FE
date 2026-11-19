import type { PerimeterSample, PerimeterState, UnknownReason } from './occlusion'
import { SPOT_DIRECTIONS, type ProbeVerdict } from './spotCheck'
import { distanceXZ, type Vec3 } from './types'

// 둘레 검사의 최종 판정. 방향마다 광선 검사(SpotCheck)와 깊이 검사(samplePerimeterDepth)를 합치고,
// 장애물이 몇 프레임 이어졌는지 센다. 한두 프레임만 튀는 것(깊이 잡음·지나가는 손)으로는 막지 않는다.
// 막는 때: 3프레임 넘게 이어진 방향이 2곳 이상이거나, 한 방향이라도 10프레임 넘게 이어질 때 (책상 모서리 바로 옆처럼 한쪽만 계속 막힘)
//
// 깊이를 믿는 동안 그 방향 깊이가 바닥이면 광선의 막힘은 무시하고 바닥으로 본다.
// 광선(hit-test)은 세션에 남은 ARCore 평면을 맞힌다. 처음에 잘못 잡힌 평면(바닥보다 높게 잡힌 옛 수평면, 옷장 쪽 가짜 수직면)이
// 남으면 빈 바닥도 계속 막힌다. 깊이는 지금 실제로 처음 닿는 면을 본다: 반지름 안에 진짜 벽·소파가 있으면 그 둘레 점이 가려져
// 깊이가 장애물이 되고, 둘레 점 사이의 물건은 원 안쪽 검사(InnerVote)가 잡는다.
// 깊이가 모름(화면 밖·발밑·값 없음·가까움)이거나 깊이를 못 믿으면(이때 depth 는 null) 광선은 그대로 센다

/** 이만큼 연속 프레임 장애물이어야 그 방향을 장애물로 확정한다 */
export const CONFIRM_FRAMES = 3
/** 확정된 방향이 이만큼 이상이어야 막는다 */
export const MIN_BLOCKED_DIRECTIONS = 2
/** 한 방향이라도 이만큼 연속 프레임 장애물이면 막는다 (한쪽만 계속 막힌 자리) */
export const PERSISTENT_FRAMES = 10
/** 원이 한 번에 이만큼(m) 넘게 옮겨지면 이어진 프레임 수를 버린다 */
const JUMP_M = 0.1

export interface DirectionReport {
  /** 광선·깊이를 합친 이번 프레임 상태. 하나라도 장애물이면 장애물 */
  state: PerimeterState
  /** 광선 검사 결과 (광선을 다시 만드는 중이면 unknown) */
  probe: ProbeVerdict
  /** 광선은 막혔지만 믿는 깊이가 바닥이라 무시했다 */
  probeIgnored: boolean
  /** 깊이 차이 (실제 − 둘레 점, m). 깊이를 못 쓰거나 못 쟀으면 null */
  gap: number | null
  /** 깊이가 모름인 까닭 */
  reason: UnknownReason | null
  /** 장애물이 이어진 프레임 수 */
  streak: number
}

export interface PerimeterReport {
  directions: DirectionReport[]
  /** CONFIRM_FRAMES 넘게 이어진 장애물 방향 수 */
  confirmed: number
  /** PERSISTENT_FRAMES 넘게 이어진 장애물 방향 수 */
  persistent: number
  /** 광선 막힘을 깊이 바닥으로 무시한 방향 수 */
  probeIgnored: number
  blocked: boolean
}

export class PerimeterVote {
  private readonly streaks: number[] = Array.from({ length: SPOT_DIRECTIONS }, () => 0)
  private lastCenter: Vec3 | null = null

  /** 매 프레임. probes·depth 는 방향 번호 순서 (못 쓰면 null). depth 는 깊이를 믿을 때만 준다 */
  update(center: Vec3, probes: readonly ProbeVerdict[] | null, depth: readonly PerimeterSample[] | null): PerimeterReport {
    if (this.lastCenter && distanceXZ(this.lastCenter, center) > JUMP_M) this.streaks.fill(0)
    this.lastCenter = center
    const directions = this.streaks.map((streak, index): DirectionReport => {
      const probe = probes?.[index] ?? 'unknown'
      const sample = depth?.[index] ?? null
      // 믿는 깊이가 바닥이면 광선 막힘(남은 잘못된 평면일 수 있다)은 세지 않는다
      const probeIgnored = probe === 'blocked' && sample?.state === 'floor'
      const obstacle = (probe === 'blocked' && !probeIgnored) || sample?.state === 'obstacle'
      const floor = !obstacle && (probe === 'clear' || sample?.state === 'floor')
      const next = obstacle ? streak + 1 : 0
      this.streaks[index] = next
      return {
        state: obstacle ? 'obstacle' : floor ? 'floor' : 'unknown',
        probe,
        probeIgnored,
        gap: sample?.gap ?? null,
        reason: sample?.reason ?? null,
        streak: next,
      }
    })
    const confirmed = directions.filter((direction) => direction.streak >= CONFIRM_FRAMES).length
    const persistent = directions.filter((direction) => direction.streak >= PERSISTENT_FRAMES).length
    const probeIgnored = directions.filter((direction) => direction.probeIgnored).length
    return { directions, confirmed, persistent, probeIgnored, blocked: confirmed >= MIN_BLOCKED_DIRECTIONS || persistent > 0 }
  }

  reset() {
    this.streaks.fill(0)
    this.lastCenter = null
  }
}
