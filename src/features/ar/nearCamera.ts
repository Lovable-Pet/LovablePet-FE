import type { StageFrame } from './placement/arStage'
import type { Vec3 } from './placement/types'

// 카메라가 개에 너무 가까울 때 (배포 빌드에도 켬). 카메라에서 개 몸(캡슐, ./bodyProxy.ts) 표면까지 거리로:
// - NEAR_HINT_M 안: 위 안내 문구를 '너무 가까워요 · 한 걸음 물러나 주세요' 로 (HINT_EXIT_M 밖으로 나가면 원래 문구)
// - NEAR_FADE_M 안: 기본(hide)은 개와 그림자를 바로 숨기고 NEAR_FADE_M + 0.03 밖이면 바로 보인다.
//   개발용 fade 는 흐리게 하다가 NEAR_HIDDEN_M 에서 완전히 숨긴다.
//   AR 카메라는 0.1 m 보다 가까운 것을 잘라 그려서 (model-viewer 의 near), 몸 표면 0.1 m 안이면 이미 몸 안이 보인다.
//   캡슐이 실제 표면보다 조금 크거나 작은 곳이 있어 0.12 m 에서 숨긴다 (6마리·앞·위·옆 시험에서 잘리기 전에 숨겨짐)
// - fade 에서 흐려질 때는 빠르게 (0.15 초에 0까지 내려갈 수 있는 빠르기, NEAR_HIDDEN_M 안이면 바로 0), 물러나면 0.3 초에 다시 나타난다
// - 숨긴 동안 고개 바라보기·몸 돌리기·가까이 앉기 판단은 멈춘다 (산책은 그대로)

/** 안내 문구 (m, 몸 표면까지) · 끄는 거리 */
export const NEAR_HINT_M = 0.35
export const NEAR_HINT_EXIT_M = 0.4
/** 흐리기 시작 (m) */
export const NEAR_FADE_M = 0.2
/** 완전히 숨김 (m). AR 카메라 near 0.1 m + 캡슐 오차 */
export const NEAR_HIDDEN_M = 0.12
/** 0 까지 흐려지는 데 드는 가장 짧은 시간 · 다시 나타나는 시간 (s) */
export const NEAR_FADE_OUT_S = 0.15
export const NEAR_FADE_IN_S = 0.3
/** hide 방식에서 다시 보이게 하는 거리 (NEAR_FADE_M + 이만큼, m) */
export const NEAR_HIDE_EXIT_EXTRA_M = 0.03
/**
 * fade: 거리에 따라 반투명 (재질 transparent, depthWrite 는 그대로 켬: 끄면 입속이 비친다).
 * hide: NEAR_FADE_M 안이면 바로 숨기고 NEAR_FADE_M + 0.03 밖이면 바로 보인다 (반투명 없음).
 * 기본은 hide (폰에서 흐려지는 것보다 바로 사라지는 쪽이 나았다). fade 는 개발용 ?nearfade=fade 로 비교
 */
export type NearFadeMode = 'fade' | 'hide'
export const NEAR_FADE_MODE: NearFadeMode = 'hide'
export const NEAR_HINT_TEXT = '너무 가까워요 · 한 걸음 물러나 주세요'
/** 프레임 사이가 이보다 길면 이만큼으로 자른다 (s) */
const MAX_FRAME_S = 0.1

/** 개발용 (?nearhint·?nearfadeat·?nearfade) */
export interface NearTuning {
  hintM?: number
  fadeM?: number
  mode?: NearFadeMode
}

export type NearZone = 'far' | 'hint' | 'fade' | 'hidden'

export interface NearState {
  zone: NearZone
  /** 안내 문구를 보일지 */
  hint: boolean
  /** 개·그림자 불투명도 0~1 */
  opacity: number
  /** 몸 표면까지 거리 (m). 모르면 null */
  distance: number | null
}

/** 렌더 쪽 (modelViewerArStage) */
export interface NearRig {
  /** 월드 점에서 개 몸 표면까지 (m, 몸 안이면 음수). 잴 수 없으면 null */
  distance(point: Vec3): number | null
  /** 개와 그림자 불투명도 (1 이면 원래대로, 0 이면 숨김) */
  setOpacity(opacity: number, mode: NearFadeMode): void
}

export interface NearHost {
  rig: NearRig
  subscribe(listener: (frame: StageFrame) => void): () => void
}

export const NEAR_ZONE_LABEL: Record<NearZone, string> = { far: '보통', hint: '안내', fade: '흐림', hidden: '숨김' }

/** 거리 → 안내·불투명도. 렌더러를 모른다 */
export class NearCamera {
  private readonly hintM: number
  private readonly hintExitM: number
  private readonly fadeM: number
  private readonly hiddenM: number
  readonly mode: NearFadeMode
  private lastTime: number | null = null
  private state: NearState = { zone: 'far', hint: false, opacity: 1, distance: null }
  /** hide 방식: 숨김 중 */
  private hidden = false

  constructor(tuning: NearTuning = {}) {
    this.hintM = tuning.hintM ?? NEAR_HINT_M
    this.hintExitM = this.hintM + (NEAR_HINT_EXIT_M - NEAR_HINT_M)
    this.fadeM = Math.max(tuning.fadeM ?? NEAR_FADE_M, NEAR_HIDDEN_M + 0.01)
    this.hiddenM = NEAR_HIDDEN_M
    this.mode = tuning.mode ?? NEAR_FADE_MODE
  }

  get current(): NearState {
    return this.state
  }

  /** time: ms. distance null (잴 수 없음·추적 끊김) 이면 지금 상태를 그대로 둔다 */
  update(time: number, distance: number | null): NearState {
    const dt = this.lastTime === null ? 0 : Math.min(MAX_FRAME_S, Math.max(0, (time - this.lastTime) / 1000))
    this.lastTime = time
    if (distance === null) return this.state
    const hint = this.state.hint ? distance < this.hintExitM : distance < this.hintM
    let opacity = this.state.opacity
    if (this.mode === 'hide') {
      this.hidden = this.hidden ? distance < this.fadeM + NEAR_HIDE_EXIT_EXTRA_M : distance < this.fadeM
      opacity = this.hidden ? 0 : 1
    } else {
      const target = Math.min(1, Math.max(0, (distance - this.hiddenM) / (this.fadeM - this.hiddenM)))
      if (distance <= this.hiddenM) opacity = 0
      else if (target < opacity) opacity = Math.max(target, opacity - dt / NEAR_FADE_OUT_S)
      else if (target > opacity) opacity = Math.min(target, opacity + dt / NEAR_FADE_IN_S)
    }
    const zone: NearZone = opacity <= 0 ? 'hidden' : opacity < 1 ? 'fade' : hint ? 'hint' : 'far'
    this.state = { zone, hint: hint || zone !== 'far', opacity, distance }
    return this.state
  }
}

/** ?debug 한 줄 */
export function describeNear(state: NearState, mode: NearFadeMode): string {
  const distance = state.distance === null ? '?' : `${state.distance.toFixed(2)} m`
  const opacity = state.zone === 'fade' ? ` ${state.opacity.toFixed(2)}` : ''
  return `가까움: 카메라~개 ${distance} · ${NEAR_ZONE_LABEL[state.zone]}${opacity} · 방식 ${mode}`
}
