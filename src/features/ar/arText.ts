// AR 화면 문구. 화면에 보이는 글은 여기 모은다 (존댓말, 지금 말투 그대로)

import type { Persona } from './persona'

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
  disclaimer: '동작은 예시예요. 실제 성격은 보호소에 확인해 주세요.',
  pawList: '해 본 것',
  pawDone: '했어요',
  pawTodo: '아직이에요',
  favoriteDone: '찜했어요',
  callShelter: '보호소 전화',
  keepWatching: '계속 보기',
  leave: '나가기',
  /** 묘기 트레이에서 지금 자세 칩 */
  poseNow: '지금',
  micAsk: '말로 명령하려면 마이크를 허용해 주세요',
  micAllow: '허용',
} as const

/**
 * 막힌 입력의 까닭 (위 안내 줄, 산책 문구 다음). reserved: 빵·구르기·자세 전환·몸 돌리기 중 누른 것을 끝나면 한다 ·
 * standToWalk: 앉거나 엎드린 개가 산책 전에 일어나는 중 · stepBack: 따라보기 켜짐인데 쓸고 지나가는 자리에 사용자가 있어 3초 넘게 못 돎
 */
export const NOTICE_TEXT = {
  reserved: '하던 동작을 마치고 할게요',
  standToWalk: '일어나서 같이 걸을게요',
  stepBack: '한 걸음 물러나면 돌아봐요',
} as const

/** 같은 자세 명령 (앉아 있는데 '앉아') */
export const SAME_POSE_TEXT = { stand: '이미 서 있어요', sit: '이미 앉아 있어요', down: '이미 엎드려 있어요' } as const
/** 같은 자세 안내를 보이는 시간 (ms) */
export const SAME_POSE_MS = 2500

// ── 한국어 조사: 앞 글자 받침에 따라 (이에요/예요, 과/와, 은/는) ──

/** 받침이 있는 숫자 (일·삼·육·칠·팔·영) */
const DIGIT_BATCHIM = new Set(['0', '1', '3', '6', '7', '8'])

export function hasBatchim(word: string) {
  const last = word.trim().at(-1) ?? ''
  const code = last.charCodeAt(0) - 0xac00
  if (code >= 0 && code <= 11171) return code % 28 !== 0
  return DIGIT_BATCHIM.has(last)
}

/** josa('진도견', '이에요', '예요') → '진도견이에요' */
export const josa = (word: string, withBatchim: string, without: string) => word + (hasBatchim(word) ? withBatchim : without)

// ── 등장 연출과 마무리 카드 ──

/** 처음 놓았을 때 위 안내 자리에 보이는 시간 (ms, 인사·성격·체고 비교 각각) · 새끼면 그 뒤 새끼 안내 */
export const INTRO_STEP_MS = 2000
export const INTRO_PUPPY_MS = 3000

/**
 * 체고 비교 (어른 기준 높이). 앞에서부터 maxCm 이하인 첫 줄. 경계는 기준 높이 사이쯤:
 * 발목(~10cm)·무릎(~50cm)·허벅지(~70cm)·허리(~100cm). 작은 개(21~28cm)는 발목, 진도(50)·리트리버(59)는 무릎
 */
export const HEIGHT_REFERENCE: readonly { maxCm: number; text: string }[] = [
  { maxCm: 30, text: '어른 발목 높이쯤' },
  { maxCm: 60, text: '어른 무릎 높이쯤' },
  { maxCm: 85, text: '어른 허벅지 높이쯤' },
  { maxCm: Infinity, text: '어른 허리 높이쯤' },
]

export const heightPhrase = (withersCm: number) => HEIGHT_REFERENCE.find((row) => withersCm <= row.maxCm)!.text

// AR 화면은 이름을 쓰지 않는다: 유기견이라 이름이 없고 displayName 은 '믹스견 · 경기도 화성시 · 14kg' 같은 긴 문자열이다 (정보 시트에만)
// 등장 순서: 인사 → (보호소 메모로 본 성격, wary·friendly 만) → 체고 비교 → (어린 개) 새끼 안내
export const INTRO_TEXT = {
  hello: '안녕하세요!',
  /** 성격 한 줄 (./persona.ts). default 는 없음 (인사 다음 바로 체고) */
  persona: { wary: '조금 낯을 가려요', friendly: '사람을 좋아하는 아이예요!' } as Readonly<Partial<Record<Persona, string>>>,
  height: (withersCm: number) => `체고 ${withersCm}cm · ${josa(heightPhrase(withersCm), '이에요', '예요')}`,
}

export const FINISH_TEXT = {
  /** 발도장을 다 모음 */
  title: '이 아이와 친해졌어요',
  /** 다 모으기 전에 닫기 */
  exitTitle: '이 아이가 기다리고 있어요',
  body: (shelter: string) => `실제 이 아이는 ${shelter}에서 기다리고 있어요`,
}

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
 * 배치 전 안내 > 너무 가까워요 > 산책 문구 > 예약·까닭 (NOTICE_TEXT·SAME_POSE_TEXT) > 따라보기 3초 문구 >
 * 등장 인사·성격·체고 비교·새끼 안내 (처음 놓은 4~9초) > 발도장 다음 할 일 > 지금 자세
 */
export interface HintSources {
  placement: string | null
  near: string | null
  walk: string | null
  notice?: string | null
  follow: string | null
  intro?: string | null
  paw?: string | null
  pose: string
}

export function pickHint({ placement, near, walk, notice, follow, intro, paw, pose }: HintSources): string {
  return placement ?? near ?? walk ?? notice ?? follow ?? intro ?? paw ?? pose
}
