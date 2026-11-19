import type { WalkClip, WalkSpec } from './walkSpec'

// 걷기 클립의 시계. 클립 시간에서 거리와 속도를 바로 계산해서, 개를 옮긴 거리와 애니메이션이 뜻하는 거리가 늘 같다
// (발이 미끄러지지 않는다). walk 의 속도 배율 k = v/v0 는 재생 배율과 이동 속도에 똑같이 곱한다.
//
// 클립 시간 c (0 ~ 길이 T) 에서 실제 속도 (a = 클립 시간 1초에 가는 거리 = speed_mps·s):
// - walk_start: a·r0·(c/T)   (0 → v0, 선형)
// - walk:       a·r0·k       (= k·v0)
// - walk_stop:  a·r0·(1 − c/T) (v0 → 0, 선형)

/** 클립 시간 from → to 동안 가는 거리 (m) */
export function clipDistance(spec: WalkSpec, clip: WalkClip, from: number, to: number): number {
  const a = spec.metersPerClipSecond
  if (clip === 'walk') return a * (to - from)
  const T = spec.durations[clip]
  const ramp = (to * to - from * from) / (2 * T)
  return clip === 'walk_start' ? a * ramp : a * (to - from - ramp)
}

/** 클립 시간 c 에서 실제 속도 (m/s). k 는 walk 에만 */
export function clipSpeed(spec: WalkSpec, clip: WalkClip, time: number, k: number): number {
  const top = spec.metersPerClipSecond * spec.r0
  if (clip === 'walk') return top * k
  const progress = Math.min(1, Math.max(0, time / spec.durations[clip]))
  return top * (clip === 'walk_start' ? progress : 1 - progress)
}

/** 재생 배율 (클립 시간 / 실제 시간) */
export const clipRate = (spec: WalkSpec, clip: WalkClip, k: number) => (clip === 'walk' ? spec.r0 * k : spec.r0)

/** 클립 끝에서 다음으로 무엇을 할지. standing: walk_stop 이 끝나 서기 루프로 */
export type GaitNext = 'walk' | 'walk_stop' | 'standing'

export interface GaitStep {
  /** 이번 프레임에 간 거리 (m) */
  distance: number
  /** 클립을 바꾼 횟수 (프레임 경계가 아니라 클립 끝에서 바꾼다) */
  switches: { from: WalkClip; to: GaitNext; at: number }[]
  /** walk_stop 이 끝나 서기 루프로 넘어갔으면, 넘어간 뒤 남은 실제 시간 (s) */
  standingAfter: number | null
}

/**
 * 걷기 클립 재생 위치. advance(dt) 는 실제 시간 dt 만큼 돌리고, 클립 끝을 지나면 decide 로 다음을 정한다.
 * 클립 끝을 지나고 남은 시간은 다음 클립에서 이어 간다 (프레임 경계가 아니라 클립 끝에서 바꾼다)
 */
export class GaitClock {
  clip: WalkClip = 'walk_start'
  /** 클립 시간 (s) */
  time = 0
  /** 지금 walk 가 몇 번째 바퀴인지 (walk_start 뒤 첫 바퀴가 1) */
  loop = 0
  private readonly spec: WalkSpec

  constructor(spec: WalkSpec) {
    this.spec = spec
  }

  /** walk_start 처음으로 */
  restart() {
    this.clip = 'walk_start'
    this.time = 0
    this.loop = 0
  }

  rate(k: number) {
    return clipRate(this.spec, this.clip, k)
  }

  speed(k: number) {
    return clipSpeed(this.spec, this.clip, this.time, k)
  }

  /**
   * 실제 시간 dt(s) 만큼 돌린다. k 는 이번 프레임의 walk 속도 배율.
   * decide 는 walk_start·walk 끝에서 불리고 'walk'(한 바퀴 더) 또는 'walk_stop' 을 돌려준다.
   * onDistance 는 클립 조각마다 간 거리로 불린다 (decide 전에 개 위치를 맞추려고)
   */
  advance(dt: number, k: number, decide: (ended: WalkClip) => 'walk' | 'walk_stop', onDistance: (meters: number) => void): GaitStep {
    const { spec } = this
    const step: GaitStep = { distance: 0, switches: [], standingAfter: null }
    let remaining = dt
    // 한 프레임에 클립이 여러 번 바뀌는 일은 없지만(가장 짧은 walk 도 0.5초쯤) 끝없이 돌지 않게 막는다
    for (let guard = 0; remaining > 0 && guard < 8; guard++) {
      const rate = clipRate(spec, this.clip, k)
      const duration = spec.durations[this.clip]
      const toEnd = (duration - this.time) / rate
      if (remaining < toEnd) {
        const next = this.time + remaining * rate
        const meters = clipDistance(spec, this.clip, this.time, next)
        step.distance += meters
        onDistance(meters)
        this.time = next
        return step
      }
      const meters = clipDistance(spec, this.clip, this.time, duration)
      step.distance += meters
      onDistance(meters)
      remaining -= toEnd
      const ended = this.clip
      const at = dt - remaining
      if (ended === 'walk_stop') {
        step.switches.push({ from: ended, to: 'standing', at })
        step.standingAfter = remaining
        this.time = duration
        return step
      }
      const next = decide(ended)
      step.switches.push({ from: ended, to: next, at })
      this.clip = next
      this.time = 0
      if (next === 'walk') this.loop++
    }
    return step
  }
}
