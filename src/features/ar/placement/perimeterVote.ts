import type { PerimeterSample, PerimeterState, UnknownReason } from './occlusion'
import { SPOT_DIRECTIONS, type ProbeVerdict } from './spotCheck'
import { distanceXZ, type Vec3 } from './types'

// 둘레 검사의 최종 판정. 방향마다 광선 검사(SpotCheck)와 깊이 검사(samplePerimeterDepth)를 합치고,
// 장애물이 몇 프레임 이어졌는지 센다. 한 곳만, 한두 프레임만 튀는 것(깊이 잡음·지나가는 손)으로는 막지 않는다

/** 이만큼 연속 프레임 장애물이어야 그 방향을 장애물로 확정한다 */
export const CONFIRM_FRAMES = 3
/** 확정된 방향이 이만큼 이상이어야 막는다 */
export const MIN_BLOCKED_DIRECTIONS = 2
/** 원이 한 번에 이만큼(m) 넘게 옮겨지면 이어진 프레임 수를 버린다 */
const JUMP_M = 0.1

export interface DirectionReport {
  /** 광선·깊이를 합친 이번 프레임 상태. 하나라도 장애물이면 장애물 */
  state: PerimeterState
  /** 광선 검사 결과 (광선을 다시 만드는 중이면 unknown) */
  probe: ProbeVerdict
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
  blocked: boolean
}

export class PerimeterVote {
  private readonly streaks: number[] = Array.from({ length: SPOT_DIRECTIONS }, () => 0)
  private lastCenter: Vec3 | null = null

  /** 매 프레임. probes·depth 는 방향 번호 순서 (못 쓰면 null) */
  update(center: Vec3, probes: readonly ProbeVerdict[] | null, depth: readonly PerimeterSample[] | null): PerimeterReport {
    if (this.lastCenter && distanceXZ(this.lastCenter, center) > JUMP_M) this.streaks.fill(0)
    this.lastCenter = center
    const directions = this.streaks.map((streak, index): DirectionReport => {
      const probe = probes?.[index] ?? 'unknown'
      const sample = depth?.[index] ?? null
      const obstacle = probe === 'blocked' || sample?.state === 'obstacle'
      const floor = !obstacle && (probe === 'clear' || sample?.state === 'floor')
      const next = obstacle ? streak + 1 : 0
      this.streaks[index] = next
      return {
        state: obstacle ? 'obstacle' : floor ? 'floor' : 'unknown',
        probe,
        gap: sample?.gap ?? null,
        reason: sample?.reason ?? null,
        streak: next,
      }
    })
    const confirmed = directions.filter((direction) => direction.streak >= CONFIRM_FRAMES).length
    return { directions, confirmed, blocked: confirmed >= MIN_BLOCKED_DIRECTIONS }
  }

  reset() {
    this.streaks.fill(0)
    this.lastCenter = null
  }
}
