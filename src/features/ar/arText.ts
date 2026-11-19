// AR 화면 문구. 화면에 보이는 글은 여기 모은다 (존댓말, 지금 말투 그대로)

export const AR_TEXT = {
  close: 'AR 닫기',
  info: '정보 보기',
  infoClose: '정보 닫기',
  withers: '체고',
  talk: '말 걸기',
  tricks: '묘기',
  tricksTray: '묘기 고르기',
  walk: '산책',
  walkEnd: '산책 끝',
  walkEnding: '멈추는 중…',
  wag: '꼬리 흔들기',
  replace: '다시 놓기',
  follow: '따라보기',
  favoriteOn: '찜하기',
  favoriteOff: '찜 취소',
  placeOnFloor: '우리 집 바닥에 놓기',
  noArTouch: '이 기기에서는 AR을 열 수 없어 화면 안 3D로 보여 드려요.',
  noArDesktop: ' 휴대폰으로 열면 우리 집 바닥에 놓을 수 있어요.',
  arFailed: 'AR을 시작하지 못했어요. 화면 안 3D로 보여 드릴게요.',
  stuck: '잘 안 되면 AR을 닫았다가 다시 열어 주세요',
  /** 마이크 옆(말풍선 자리) 흐린 안내. 2단계 발도장 안내로 바뀐다 */
  holdHint: '유기견을 꾹 누르면 빵!',
  disclaimer: '동작은 예시예요. 실제 성격은 보호소에 확인해 주세요.',
} as const

/** 정보 시트 줄 이름 */
export const INFO_LABEL = {
  age: '나이',
  weight: '체중',
  sex: '성별',
  mark: '특징',
  shelter: '보호소',
  noticeEnd: '공고 종료',
  noWeight: '체중 미상',
} as const

/** '따라보기' 토글을 누른 뒤 위 안내 문구 */
export const FOLLOW_NOTICE = { on: '몸을 돌려 따라봐요', off: '가만히 있어요 · 한 바퀴 둘러보세요' } as const

/** 지금 자세 줄 (가장 낮은 우선순위). 명령 클립이 없는 모델은 꼬리 흔들기 안내 */
export const POSE_HINT = {
  commands: '말을 걸거나 묘기를 눌러 보세요',
  wagInAr: '아래 버튼을 누르면 꼬리를 흔들어요',
  tapHeadTilt: '유기견을 탭하면 고개를 갸우뚱해요',
  tapWag: '유기견을 탭하면 꼬리를 흔들어요',
} as const

/** 반응 말풍선 (개 머리 위). heart 는 하트 아이콘 */
export type ReactionKind = 'puzzled' | 'heart' | 'bark' | 'bang'
export const REACTION_TEXT: Record<Exclude<ReactionKind, 'heart'>, string> = {
  puzzled: '?',
  bark: '멍!',
  bang: '빵!',
}
/** 반응 말풍선을 띄우는 클립 */
export const REACTION_BY_CLIP: Partial<Record<string, ReactionKind>> = {
  head_tilt: 'puzzled',
  tail_wag: 'heart',
  bark: 'bark',
  play_dead: 'bang',
}
/** 반응 말풍선을 보이는 시간 (ms) */
export const REACTION_MS = 1200

/**
 * 위 안내 한 줄. 앞에서부터 처음 있는 것을 보인다:
 * 배치 전 안내 > 너무 가까워요 > 산책 문구 > 따라보기 3초 문구 > 발도장 다음 할 일 > 지금 자세
 */
export interface HintSources {
  placement: string | null
  near: string | null
  walk: string | null
  follow: string | null
  paw?: string | null
  pose: string
}

export function pickHint({ placement, near, walk, follow, paw, pose }: HintSources): string {
  return placement ?? near ?? walk ?? follow ?? paw ?? pose
}
