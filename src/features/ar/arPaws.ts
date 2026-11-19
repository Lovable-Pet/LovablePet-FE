import type { ReactSource } from './dogAnimator'
import type { WalkPhase } from './walk/walkController'

// 발도장: 이 AR 화면에서 개와 해 본 것 (톡 터치 · 꾹 누르기 · 말 걸기 · 산책).
// 화면이 하는 일 '교감'을 한눈에 보이고, 아직 안 해 본 것 하나를 위 안내 줄로 권한다.
// 상태는 이 화면 동안만 (나가거나 다른 개로 가면 처음부터). 기능이 없는 개는 그 발도장을 뺀다

export type PawId = 'tap' | 'hold' | 'talk' | 'walk'

/** 보이는 순서이자 다음에 권하는 순서 (남은 것 중 첫 번째) */
export const PAW_ORDER: readonly PawId[] = ['tap', 'hold', 'talk', 'walk']

export const PAW_LABEL: Record<PawId, string> = {
  tap: '톡 터치',
  hold: '꾹 누르기',
  talk: '말 걸기',
  walk: '산책',
}

/** 위 안내 줄: 아직 안 해 본 것 */
export const PAW_HINT: Record<PawId, string> = {
  tap: '개를 톡 건드려 보세요',
  hold: '꾹 눌러 보세요 · 빵!',
  talk: '"앉아"라고 말해 보세요',
  walk: '산책을 눌러 같이 걸어 보세요',
}

/** 다음 할 일이 아래 버튼이면 그 버튼을 살짝 강조한다 */
export const PAW_BUTTON: Partial<Record<PawId, 'talk' | 'walk'>> = { talk: 'talk', walk: 'walk' }

/** 이 개·이 화면에서 할 수 있는 것 */
export interface PawFeatures {
  /** 개 탭에 반응 클립(갸우뚱·꼬리 흔들기)이 있다 */
  tap: boolean
  /** 명령 클립이 있다 (3초 누르기 → 빵) */
  hold: boolean
  /** 명령 클립이 있고 음성 인식이 된다 */
  talk: boolean
  /** AR 에서 걷기 클립이 있다 (화면 안 3D·아이폰은 산책이 없다) */
  walk: boolean
}

/** 보일 발도장 (기능이 없는 것은 뺀다) */
export const pawsFor = (features: PawFeatures) => PAW_ORDER.filter((id) => features[id])

/** 발도장을 찍는 일 */
export type PawEvent =
  /** 개를 톡: 반응이 무엇이든 (클립·절차적 갸우뚱·손 내리기·말풍선만) */
  | { type: 'tap' }
  /** 반응 클립이 실제로 재생됨 (DogAnimator.onReact) */
  | { type: 'react'; source: ReactSource }
  /** 3초 누르기가 다 참. accepted: 명령으로 받아짐 (바로 또는 예약) */
  | { type: 'hold'; accepted: boolean }
  /** 음성에서 명령을 찾음. accepted: 명령으로 받아짐 (바로·예약·이미 그 자세) */
  | { type: 'voiceCommand'; accepted: boolean }
  /** 산책 단계가 바뀜. walk_start 부터 (start·walk·stop) 걸은 것으로 본다 */
  | { type: 'walkPhase'; phase: WalkPhase | null }

const WALKED: readonly (WalkPhase | null)[] = ['start', 'walk', 'stop']

/** 이 일이 찍는 발도장. 없으면 null */
export function pawOf(event: PawEvent): PawId | null {
  switch (event.type) {
    case 'tap':
      return 'tap'
    case 'react':
      return event.source === 'tap' ? 'tap' : null
    case 'hold':
      return event.accepted ? 'hold' : null
    case 'voiceCommand':
      return event.accepted ? 'talk' : null
    case 'walkPhase':
      return WALKED.includes(event.phase) ? 'walk' : null
  }
}

/** 찍은 뒤의 상태. 이미 찍었거나 찍을 것이 없으면 같은 객체 (React 상태가 바뀌지 않게) */
export function stampPaw(done: ReadonlySet<PawId>, paw: PawId | null): ReadonlySet<PawId> {
  if (!paw || done.has(paw)) return done
  return new Set([...done, paw])
}

/** 다음에 권할 것: 보이는 발도장 중 아직 안 찍은 첫 번째 */
export const nextPaw = (paws: readonly PawId[], done: ReadonlySet<PawId>) => paws.find((id) => !done.has(id)) ?? null

/** 보이는 발도장을 다 모았는지 (발도장이 하나도 없으면 false) */
export const allPawsDone = (paws: readonly PawId[], done: ReadonlySet<PawId>) => paws.length > 0 && paws.every((id) => done.has(id))
