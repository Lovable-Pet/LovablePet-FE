import { median } from './occlusion'

// 깊이 보정 검사: 깊이 센서가 화면 전체에서 같은 비율로 어긋난 것(시작 직후 움직임이 적어 아직 맞춰지지 않음 등)을
// 스스로 알아채, 그동안은 깊이 판정(가운데 가림·둘레 깊이 장애물)을 쓰지 않고 특징점으로 대신한다.
// 진짜 물체(민무늬 소파 등)는 화면 일부만 가리므로 센서 오류로 보지 않는다.
// 렌더러를 모르는 순수 계산이다

/** 깊이 안 맞음 조건 (a): 최근 1초 가운데 r 중앙값이 이 범위 밖 */
export const DEPTH_BAD_MIN = 0.88
export const DEPTH_BAD_MAX = 1.12
/** 깊이 맞음: r 중앙값이 이 범위 안에 1초 동안 머물면 (처음 확인할 때와 다시 쓸 때 모두) */
export const DEPTH_GOOD_MIN = 0.92
export const DEPTH_GOOD_MAX = 1.08
/** 중앙값을 내는 기간이자 맞음을 확인하는 기간 (ms) */
export const DEPTH_RATIO_WINDOW_MS = 1000
/** 판정하려면 기간 안의 값이 이만큼(ms)에 걸쳐 있어야 한다 */
const MIN_COVERAGE_MS = 500
/** 조건 (b): 둘레 r 이 가운데 r 과 이 비율 안이면 같이 어긋난 것 */
export const PERIMETER_RATIO_TOLERANCE = 0.1
/** 조건 (b): 둘레 8곳 중 이만큼 이상이 같이 어긋나야 화면 전체가 어긋난 것 */
export const PERIMETER_RATIO_MIN_DIRECTIONS = 6
/**
 * 조건 (b) 보강: 화면 격자(카메라 앞 바닥 여러 곳)도 이 비율 이상이 가운데 r 과 ±10% 안이어야 한다.
 * 작은 개는 원 둘레가 화면의 좁은 곳이라, 소파 하나가 둘레 8곳을 다 가릴 수 있다. 화면 전체를 함께 본다
 */
export const GRID_SIMILAR_MIN_FRACTION = 0.7
/** 격자 점이 이만큼 이상 재졌을 때만 격자 조건을 본다 (아니면 둘레만으로) */
export const GRID_MIN_POINTS = 4
/** 조건 (c): 특징점 hit 과 바닥 hit 거리가 이 비율 안이면 일치 */
export const POINT_AGREE_TOLERANCE = 0.05

/** unknown: 아직 모름 (믿지 않는다) · ok: 맞음 · bad: 안 맞음 */
export type DepthCalibrationState = 'unknown' | 'ok' | 'bad'

export interface CalibrationInput {
  time: number
  /** r = 깊이(축) / 바닥 hit(축). 가운데 광선이 확정 바닥 층에 맞고 깊이 값이 있을 때만, 아니면 null */
  centerRatio: number | null
  /** 둘레 8곳의 r (못 쟀으면 null) */
  perimeterRatios: readonly (number | null)[]
  /** 화면 격자(카메라 앞 바닥 여러 곳)의 r */
  gridRatios: readonly number[]
  /** 특징점 hit 거리 / 바닥 hit 거리 (같은 광선). 특징점이 없으면 null */
  pointRatio: number | null
}

export interface CalibrationReport {
  state: DepthCalibrationState
  /** 최근 1초 가운데 r 중앙값. 값이 없으면 null */
  ratio: number | null
  /** 둘레 중 가운데 r 과 ±10% 안으로 같이 어긋난 곳 수 (최근 1초 중앙값) */
  similar: number | null
  /** 화면 격자 중 같이 어긋난 비율 (최근 1초 중앙값). 격자를 충분히 못 쟀으면 null */
  gridSimilar: number | null
  /** 특징점이 바닥 hit 과 5% 안에서 일치하는지 (최근 1초 중앙값). 특징점이 없었으면 null */
  pointAgree: boolean | null
  /** 지금 상태가 이어진 시간 (ms) */
  stateMs: number
}

interface Entry {
  time: number
  ratio: number
  similar: number
  gridSimilar: number | null
  /** |특징점 거리 / 바닥 거리 − 1|. 특징점이 없으면 null */
  pointDeviation: number | null
}

/**
 * 깊이 안 맞음: 아래를 모두 채울 때만
 * (a) 최근 1초 가운데 r 중앙값이 0.88~1.12 밖
 * (b) 둘레 8곳 중 6곳 이상의 r 이 가운데 r 과 ±10% 안 (화면 전체가 같은 비율로 어긋남).
 *     화면 격자를 4곳 넘게 쟀으면 그중 70% 이상도 같이 어긋나야 한다
 * (c) 특징점 hit 이 있으면 바닥 hit 과 5% 안에서 일치 (없으면 (a)(b) 만으로)
 * 맞음: r 중앙값이 1초 동안 0.92~1.08 안. 그 밖의 경우(진짜 물체가 가운데를 가림 등)는 상태를 바꾸지 않는다
 */
export class DepthCalibration {
  private entries: Entry[] = []
  private state: DepthCalibrationState = 'unknown'
  private stateSince: number | null = null
  private goodSince: number | null = null

  update({ time, centerRatio, perimeterRatios, gridRatios, pointRatio }: CalibrationInput): CalibrationReport {
    this.stateSince ??= time
    if (centerRatio !== null) {
      const similar = perimeterRatios.filter(
        (ratio) => ratio !== null && Math.abs(ratio / centerRatio - 1) <= PERIMETER_RATIO_TOLERANCE,
      ).length
      const gridSame = gridRatios.filter((ratio) => Math.abs(ratio / centerRatio - 1) <= PERIMETER_RATIO_TOLERANCE).length
      this.entries.push({
        time,
        ratio: centerRatio,
        similar,
        gridSimilar: gridRatios.length >= GRID_MIN_POINTS ? gridSame / gridRatios.length : null,
        pointDeviation: pointRatio === null ? null : Math.abs(pointRatio - 1),
      })
    }
    while (this.entries.length && time - this.entries[0].time > DEPTH_RATIO_WINDOW_MS) this.entries.shift()

    const covered = this.entries.length > 0 && time - this.entries[0].time >= MIN_COVERAGE_MS
    const ratio = this.entries.length ? median(this.entries.map((entry) => entry.ratio)) : null
    const similar = this.entries.length ? median(this.entries.map((entry) => entry.similar)) : null
    const gridSimilar = median(this.entries.flatMap((entry) => (entry.gridSimilar === null ? [] : [entry.gridSimilar])))
    const deviations = this.entries.flatMap((entry) => (entry.pointDeviation === null ? [] : [entry.pointDeviation]))
    const deviation = median(deviations)
    const pointAgree = deviation === null ? null : deviation <= POINT_AGREE_TOLERANCE

    const good = ratio !== null && centerRatio !== null && ratio >= DEPTH_GOOD_MIN && ratio <= DEPTH_GOOD_MAX
    this.goodSince = good ? (this.goodSince ?? time) : null

    if (covered && ratio !== null && similar !== null) {
      const off = ratio < DEPTH_BAD_MIN || ratio > DEPTH_BAD_MAX
      const wholeScreen =
        similar >= PERIMETER_RATIO_MIN_DIRECTIONS && (gridSimilar === null || gridSimilar >= GRID_SIMILAR_MIN_FRACTION)
      if (off && wholeScreen && pointAgree !== false) this.setState('bad', time)
      else if (this.goodSince !== null && time - this.goodSince >= DEPTH_RATIO_WINDOW_MS) this.setState('ok', time)
    }

    return { state: this.state, ratio, similar, gridSimilar, pointAgree, stateMs: time - (this.stateSince ?? time) }
  }

  /** 처음부터 다시 (바닥 다시 찾기 등) */
  reset(time: number) {
    this.entries = []
    this.goodSince = null
    this.setState('unknown', time)
  }

  private setState(state: DepthCalibrationState, time: number) {
    if (state === this.state) return
    this.state = state
    this.stateSince = time
  }
}
