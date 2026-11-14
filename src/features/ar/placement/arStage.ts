import type { Ray, SurfaceHit, Vec3 } from './types'

// 배치 로직(PlacementController)이 AR 렌더러에 바라는 것.
// 지금은 model-viewer 어댑터(../modelViewerArStage.ts)가 채운다. 렌더러를 바꾸거나 산책 모드를 만들 때는
// 이 모양만 맞추면 배치 로직은 그대로 쓴다

export interface StageFrame {
  /** XR 프레임 시각 (ms) */
  time: number
  /** 휴대폰(카메라) 위치 */
  camera: Vec3
  /** 카메라 행렬 (기준 공간의 점을 화면에 투영할 때 쓴다) */
  view: StageView
  /** 화면 가운데 광선이 처음 맞은 면. 아무것도 안 맞았으면 null */
  centerHit: SurfaceHit | null
  /** 이번 프레임 깊이. 깊이 센서를 못 쓰거나 이번 프레임 값이 없으면 null. onFrame 안에서만 읽는다 */
  depth: DepthSampler | null
  /** 이 세션에서 쓸 수 있는 보조 센서 */
  sensors: StageSensors
}

export interface StageView {
  /** 기준 공간 → 카메라 공간 (열 우선 4x4). 카메라 공간은 -z 가 정면 */
  viewMatrix: ArrayLike<number>
  /** 카메라 공간 → 클립 공간 (열 우선 4x4) */
  projectionMatrix: ArrayLike<number>
}

/** 깊이 센서의 한 프레임 */
export interface DepthSampler {
  /** 깊이 버퍼 크기 (픽셀). 표본 간격을 정할 때 쓴다 */
  readonly width: number
  readonly height: number
  /**
   * 화면 좌표(0~1, 왼쪽 위가 원점, u 는 오른쪽·v 는 아래로 커진다)에서 실제 물체까지 거리 (m).
   * 카메라 정면 축으로 잰 거리다 (광선 길이가 아니다). 값이 없으면 null
   */
  at(u: number, v: number): number | null
}

/** pending: 아직 모름 · on: 쓸 수 있음 · off: 없음(기기·브라우저가 안 됨, 거부됨) */
export type SensorState = 'pending' | 'on' | 'off'

export interface StageSensors {
  depth: SensorState
  /** 깊이 형식 (디버그). 예: 'cpu-optimized · luminance-alpha' */
  depthFormat: string | null
}

/** ok: 놓을 수 있음 · blocked: 놓을 수 없음 · marker: 디버그용, 놓은 자리 표시 */
export type RingTone = 'ok' | 'blocked' | 'marker'

export interface RingPose {
  /** 원 중심. 원은 이 높이에 눕는다 */
  center: Vec3
  radius: number
  tone: RingTone
}

/** 자리 검사 광선 묶음 (AR 기준 공간에 고정된 hit-test 광선들) */
export interface ProbeSet {
  /** 이번 프레임의 결과. 광선마다 처음 맞은 면, 없으면 null. 프레임 콜백(onFrame) 안에서만 읽는다 */
  read(): (SurfaceHit | null)[]
  cancel(): void
}

export interface ArStage {
  /** 개 크기 (m). x 가로, y 높이, z 세로 (모델 기준) */
  readonly dogSize: Vec3
  /** 매 XR 프레임 onFrame 을 부른다. 화면 가운데 hit-test 를 쓸 수 없으면 onUnavailable 을 한 번 부른다 */
  start(onFrame: (frame: StageFrame) => void, onUnavailable: (reason: string) => void): void
  /** 바닥 표시 원. null 이면 숨긴다 */
  setRing(ring: RingPose | null): void
  /** 개를 그 자리·방향으로 바로 옮기고 (끌려가거나 돌아가는 움직임 없이) 페이드인으로 보인다 */
  placeDog(position: Vec3, yaw: number): void
  /** 개(그림자 포함)를 숨긴다 */
  hideDog(): void
  /** 자리 검사 광선 묶음을 만든다. 하나라도 못 만들면 reject */
  createProbes(rays: readonly Ray[]): Promise<ProbeSet>
  /** 디버그: 개 모델 바닥 가운데의 지금 위치. 모르면 null */
  dogFootCenter(): Vec3 | null
  /** 모두 원래대로 (원 지우기, 개 보이기, hit-test 끝내기) */
  dispose(): void
}
