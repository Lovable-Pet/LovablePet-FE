import type { StageFrame } from '../placement/arStage'
import type { Vec3 } from '../placement/types'
import type { Vec2 } from './trail'
import type { WalkClip, WalkModelInfo } from './walkSpec'

// 산책 로직(WalkController)이 렌더러에 바라는 것. model-viewer 어댑터(../modelViewerArStage.ts 의 ModelViewerWalkRig)가 채운다.
// 믹서·timeScale·클립 전환·개 위치처럼 model-viewer 내부를 만지는 일은 모두 그쪽에 있다

/** 이번 프레임에 보일 걷기 자세 */
export interface WalkPose {
  clip: WalkClip
  /** 클립 시간 (s) */
  time: number
  /**
   * 걷기를 시작할 때 서기 자세를 섞는 비율 (1 → 0). 0 이면 걷기 클립만.
   * 기존 명령처럼 서기 루프의 지금 프레임에서 300ms 크로스페이드로 넘어간다
   */
  standingWeight: number
}

export interface WalkRig {
  /** 모델에서 읽은 걷기 수치 */
  readonly info: WalkModelInfo
  /** 걷기 시작: model-viewer 가 애니메이션을 돌리지 않게 하고 지금 서기 자세를 섞기용으로 잡아 둔다 */
  takeOver(): void
  /** 걷기 클립을 그 시간으로 (크로스페이드 없이 그 프레임에서 바로) */
  show(pose: WalkPose): void
  /** 개를 그 자리·방향으로 바로 (감쇠 없이) */
  moveDog(position: Vec3, yaw: number): void
  /** walk_stop 이 끝났을 때: 서기 루프 첫 프레임에서 model-viewer 에 돌려준다 */
  release(): void
}

/** 놓은 뒤 바닥 추정 (배치 로직의 FloorEstimate) */
export interface FloorLevel {
  /** 바닥 층 높이. 아직 모르면 null */
  y: number | null
  /** 후보 없이 지금 맞은 수평면으로 임시로 정한 값인지 */
  provisional: boolean
}

/** 배치 쪽에서 산책에 넘겨주는 것 */
export interface WalkHost {
  readonly rig: WalkRig
  /** 지금 개 자리·방향 (놓은 자리, 산책으로 옮겼으면 옮긴 자리) */
  dogPose(): { position: Vec3; yaw: number } | null
  /** 놓은 뒤 매 XR 프레임. 돌려준 함수로 끊는다 */
  subscribe(listener: (frame: StageFrame, floor: FloorLevel) => void): () => void
  /** 산책이 개를 옮겼다 (다시 놓기·디버그 표시 원이 이 자리를 쓴다) */
  dogMoved(position: Vec3, yaw: number): void
}

/**
 * 4단계 자리: 걷는 중 앞 바닥 검사 (아직 구현하지 않음).
 * 루프 끝마다 다음 한 바퀴와 멈추는 거리만큼 앞이 막혔는지 묻고, 막혔으면 그 루프 끝에서 멈춘다
 */
export interface AheadCheck {
  /** 매 프레임 (광선·깊이를 미리 준비할 때) */
  update?(input: AheadInput): void
  /** 루프 끝에서: 앞이 막혔으면 true */
  blocked(input: AheadInput): boolean
}

export interface AheadInput {
  frame: StageFrame
  /** 개 발밑 가운데 */
  position: Vec3
  yaw: number
  /** 앞으로 갈 길: 남은 발자취 점과 사용자 위치 */
  path: readonly Vec2[]
  /** 다음 루프 끝까지와 멈추는 거리를 더한 거리 (m) */
  distance: number
}
