import type { StageFrame } from '../placement/arStage'
import type { GazeCommand, GazeSample } from './gazeController'

// 고개 바라보기 판단(GazeController)이 렌더러에 바라는 것. model-viewer 어댑터(../modelViewerArStage.ts)가 채운다.
// 뼈를 돌리는 일은 ../neckAim.ts, 그 계산을 렌더 직전에 끼우는 일은 modelViewerArStage.ts 에 있다.
// 지금은 AR(WebXR) 에서만 쓴다. 화면 안 3D 는 나중에 카메라 대신 포인터 방향을 넣는 host 를 만들면 같은 판단을 쓸 수 있다

export interface GazeRig {
  /** 지난 렌더 직전에 잰 눈 위치·개 방향·클립. 아직 못 쟀으면 null */
  sample(): GazeSample | null
  /**
   * 다음 렌더부터 더할 고개 방향. null 이거나 weight 0 이면 원래 클립 자세 그대로 (더했던 것도 지운다).
   * 매 렌더 직전(애니메이션이 자세를 쓴 뒤·그림자를 찍기 전)에 그 프레임 자세 위에 더한다
   */
  set(command: GazeCommand | null): void
}

/** 배치 쪽에서 고개 바라보기에 넘겨주는 것 (개를 놓은 뒤에만) */
export interface GazeHost {
  readonly rig: GazeRig
  /** 놓은 뒤 매 XR 프레임. 돌려준 함수로 끊는다 */
  subscribe(listener: (frame: StageFrame) => void): () => void
}
