// 고개 바라보기(gaze) 수치. 판단(gazeController.ts)과 뼈 돌리기(../neckAim.ts)가 같이 쓴다.
// 각은 개 몸(루트) 기준: yaw 는 정면 0·+ 가 개의 왼쪽, pitch 는 수평 0·+ 가 위

/** 돌리는 뼈 (목 아래 → 목 가운데 → 머리). 템플릿 6종(진도·말티즈·토이푸들·치와와·진도 강아지·리트리버) 모두 같은 이름 */
export const GAZE_BONES = ['neck_base_jnt', 'neck_mid_jnt', 'head_jnt'] as const
/** 머리 방향을 재는 뼈: 두 눈 가운데 → 코 (머리 뼈의 자식) */
export const GAZE_EYE_BONES = ['L_eye_jnt', 'R_eye_jnt'] as const
export const GAZE_NOSE_BONE = 'nose_jnt'
/** 뼈마다 나눠 줄 몫 (합 1). 목 피부가 한 곳에서 꺾이지 않게 */
export const GAZE_SHARE = [0.25, 0.35, 0.4] as const

/** 머리 방향 한계 (°): 좌우 ±yaw, 위 up, 아래 down */
export interface GazeLimits {
  yawDeg: number
  upDeg: number
  downDeg: number
}
export const GAZE_LIMITS: GazeLimits = { yawDeg: 70, upDeg: 45, downDeg: 15 }
/** 템플릿별로 바꿀 한계 (목 피부가 찌그러지는 템플릿만). 없으면 GAZE_LIMITS */
export const GAZE_LIMITS_BY_TEMPLATE: Readonly<Record<string, Partial<GazeLimits>>> = {}

export function gazeLimits(template: string | null | undefined): GazeLimits {
  return { ...GAZE_LIMITS, ...(template ? GAZE_LIMITS_BY_TEMPLATE[template] : undefined) }
}

// ── 따라가기 ──
/** 각: 임계 감쇠 시간상수 (s) · 최고 각속도 (°/s) */
export const GAZE_ANGLE_TAU_S = 0.25
export const GAZE_MAX_SPEED_DEG = 180
/** weight 를 올리는 시간 (바라보기 시작) · 내리는 시간 (딴청·한계 밖 포기) · 동작 세기 0 인 클립에서 푸는 시간 (s). 모두 smoothstep */
export const GAZE_WEIGHT_IN_S = 0.4
export const GAZE_WEIGHT_OUT_S = 0.6
export const GAZE_WEIGHT_RELEASE_S = 0.2
/** 바라보기를 시작할 때 늦추는 시간 (s, 이 사이 무작위) */
export const GAZE_REACTION_S: readonly [number, number] = [0.2, 0.4]

// ── 언제 바라볼지 ──
/** 바라보기 · 딴청 평균 (s). 실제 길이는 평균 × [2/3, 4/3] 무작위 (3~6 · 2~4) */
export const GAZE_LOOK_MEAN_S = 4.5
export const GAZE_AWAY_MEAN_S = 3
export const GAZE_SPREAD: readonly [number, number] = [2 / 3, 4 / 3]
/** 계기가 왔을 때 이미 보는 중이면 적어도 이만큼(s) 더 본다 */
export const GAZE_TRIGGER_HOLD_S = 1.5
/** 사용자가 움직이기 시작: 카메라 수평 속도가 ON 을 넘을 때 (OFF 아래로 내려가야 다시 센다), 속도 평균 시간상수 (s) */
export const GAZE_MOVE_ON_MPS = 0.3
export const GAZE_MOVE_OFF_MPS = 0.15
export const GAZE_SPEED_TAU_S = 0.3
/** 다가옴: 마지막 계기 뒤 가장 멀었던 거리보다 이만큼(m) 가까워지면 */
export const GAZE_APPROACH_M = 0.5
/** 오래 가만히: 속도가 STILL 아래로 STILL_LONG_S 넘게 → 바라보기 × LOOK_SCALE, 딴청 × AWAY_SCALE */
export const GAZE_STILL_MPS = 0.08
export const GAZE_STILL_LONG_S = 10
export const GAZE_STILL_LOOK_SCALE = 0.5
export const GAZE_STILL_AWAY_SCALE = 1.75
/** 산책 중 (walk): 바라보기 · 딴청 평균 (s). 앞을 주로 본다 */
export const GAZE_WALK_LOOK_MEAN_S = 1.5
export const GAZE_WALK_AWAY_MEAN_S = 4.5
/** 한계 밖에 이만큼(s) 넘게 있으면 고개를 포기한다 (weight 0). 다시 들어오면 계기 */
export const GAZE_GIVE_UP_S = 1.5
/** 사용자가 눈에서 이만큼(m, 수평) 안이면 방향이 마구 바뀌어 목표를 그대로 둔다 */
export const GAZE_NEAR_M = 0.25

/**
 * 동작별 세기 (클립 이름). 없는 클립은 0 (돌리지 않는다). 0 인 클립으로 바뀌면 GAZE_WEIGHT_RELEASE_S 안에 풀고
 * 루프로 돌아오면 다시 본다. 회전 클립(turn_*)도 0
 */
export const GAZE_CLIP_WEIGHT: Readonly<Record<string, number>> = {
  standing: 1,
  sitting: 1,
  lying: 1,
  // 명령 클립이 없는 템플릿의 대기 루프
  idle: 1,
  tail_wag: 0.8,
  // 올려다본 채 갸우뚱
  head_tilt: 0.7,
  shake: 0.6,
  bark: 0,
  play_dead: 0,
  rollover: 0,
  sit_down: 0,
  stand_up: 0,
  lie_down: 0,
  get_up: 0,
  // 산책: 걷는 중에는 가끔만 조금
  walk: 0.3,
  walk_start: 0,
  walk_stop: 0,
}
/** 루프 클립. 1회 클립에서 루프로 돌아오면 (명령·반응·walk_stop·회전이 끝남) 바로 바라본다 */
export const GAZE_LOOP_CLIPS: ReadonlySet<string> = new Set(['standing', 'sitting', 'lying', 'idle', 'walk'])
export const isTurnClip = (clip: string | null) => !!clip && clip.startsWith('turn_')

// ── 몸 돌리기 (서 있을 때, 제자리 회전 클립이 있을 때만) ──
/** 사용자가 좌우 한계 밖에 이만큼(s) 넘게 있으면 제자리 회전으로 돌아선다 */
export const BODY_TURN_S = 2.5
/** 회전이 끝난 뒤 이만큼(s) 다시 돌지 않는다 */
export const BODY_TURN_COOLDOWN_S = 3
/** 사용자가 개(발밑)에서 이만큼(m, 수평) 안이면 돌지 않는다 (방향이 마구 바뀐다) */
export const BODY_TURN_MIN_M = 0.5

// ── 고개를 들 때 턱 (대기 루프의 헥헥거림) ──
/** 턱 뼈 (머리 뼈의 자식). 6종 모두 쉼(바인드) 자세 = 입 다문 자세 = 루프에서 가장 덜 벌어진 값 (0.02° 안) */
export const GAZE_JAW_BONE = 'jaw_jnt'
/** 턱 벌림을 줄이는 클립 (대기 루프만). 짖기·흔들기 등 입을 쓰는 클립은 그대로 */
export const GAZE_JAW_CLIPS: ReadonlySet<string> = new Set(['standing', 'sitting', 'lying'])
/**
 * 턱 남기는 비율 = 1 − weight × clamp(위 pitch / fullUpDeg, 0, 1) × (1 − keep). 1 이면 루프 그대로, 0 이면 입 다묾.
 * 수평·아래를 볼 때는 루프 그대로 (반가워 보인다), 위로 든 만큼만 줄인다
 */
export interface GazeJaw {
  /** fullUpDeg 이상 들었을 때 남기는 비율 (0~1) */
  keep: number
  /** 이만큼(°) 들면 keep 까지 줄인다 */
  fullUpDeg: number
}
export const GAZE_JAW: GazeJaw = { keep: 0.3, fullUpDeg: 30 }
/** 템플릿별 턱. 없으면 GAZE_JAW */
export const GAZE_JAW_BY_TEMPLATE: Readonly<Record<string, Partial<GazeJaw>>> = {
  // 입이 커서 입속이 잘 보인다
  jindo: { keep: 0.15 },
}

export function gazeJaw(template: string | null | undefined): GazeJaw {
  return { ...GAZE_JAW, ...(template ? GAZE_JAW_BY_TEMPLATE[template] : undefined) }
}

/** 배포 빌드에서 켤지. 폰 확인 뒤 정한다 (개발 모드는 ?gaze=0 이 아니면 켬) */
export const GAZE_IN_PRODUCTION = false

/** 개발용 (?gazemax·?gazeup·?gazeon·?gazeoff·?bodyturn·?gazejaw·?gazejawup). 없으면 위 기본값 */
export interface GazeTuning {
  yawDeg?: number
  upDeg?: number
  lookMeanS?: number
  awayMeanS?: number
  /** 몸 돌리기까지 (s). 0 이면 몸 돌리기 끔 */
  bodyTurnS?: number
  /** 턱 keep · fullUpDeg (템플릿별 값보다 앞선다) */
  jawKeep?: number
  jawFullUpDeg?: number
}
