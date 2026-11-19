import type { CommandId } from './dogAnimator'

// 음성 → 명령 표. 단어를 더하려면 여기만 고친다.
// 처음 값은 AI 저장소 docs/ANIMATION.md 5절의 정규식이고, 비슷한 발음은 폰에서 잘못 알아들은 말을 모은 것이다
// (2026-11-19). 개발 모드 ?debug 의 '음성 기록' 에서 후보 전부와 잡힌 규칙을 복사해 볼 수 있다.
//
// - includes: 말한 문장 안에 들어 있으면 맞다. 말하는 중간 결과에서도 보고 바로 실행한다
// - exact: 문장 전체가 이 말일 때만 맞다. 다른 말 안에 들어가기 쉬운 짧은 변형
//   (한자 → 한자리, 지저 → 지저분, 안자 → '안 자고', 이러나 → '왜 이러나', 어뜨려 → 떨어뜨려 등).
//   중간 결과에서는 보지 않는다 (말하는 중에 앞부분만 먼저 잡힌다)
// - 표에 없는 1~2글자 말은 자모로 풀어 앉아·일어나·짖어·엎드려와 견준다 (matchJamo, 최종 결과에서만)
// 비교할 때는 띄어쓰기와 문장부호를 빼고 영문은 소문자로 ('손 줘!' → '손줘', 'Son 줘' → 'son줘')
// 한 글자 '손'은 받지 않는다 (손님·손잡이 앞부분, 말 끝 잘림). '손 줘'처럼 뒤에 '줘'류가 붙어야 한다

interface VoiceWord {
  command: CommandId
  includes?: readonly string[]
  exact?: readonly string[]
}

/** '손 줘'의 '손'으로 들린 말. 이것만으로는 받지 않고 뒤에 PAW_TAILS 가 붙어야 한다 */
export const PAW_HEADS = ['손', '쏜', '송', '솜', '선', '썬', '숀', '존', '소', 'son'] as const
const PAW_TAILS = ['줘', '저', '져', '조', '줘요'] as const
/** '손줘'(원래 표기, '손줘요'도 들어 있다)만 includes, 나머지 조합은 exact (손저울·선조·소조 같은 말 안에 들어간다) */
const PAW_INCLUDES = ['손줘']
const PAW_EXACT = PAW_HEADS.flatMap((head) => PAW_TAILS.map((tail) => head + tail)).filter(
  (word) => !PAW_INCLUDES.some((part) => word.includes(part)),
)

export const VOICE_WORDS: readonly VoiceWord[] = [
  { command: 'sit', includes: ['앉아', '앉자', '앉어', '안즈아'], exact: ['안자', '안저', '안져', '안짜', '안좌', '한자'] },
  {
    command: 'down',
    includes: ['엎드려', '엎드리', '엎드러', '엎뜨려', '엎들여', '업드려', '업뜨려', '업드러', '옆드려'],
    exact: ['어뜨려', '업들어'],
  },
  {
    command: 'stand',
    includes: ['일어나', '일어서', '일어너', '이러너', '니러나', '일어날'],
    exact: ['이러나', '일러나', '이어나', '이르나'],
  },
  { command: 'shake', includes: ['악수', ...PAW_INCLUDES], exact: PAW_EXACT },
  { command: 'rollover', includes: ['굴러', '구르'] },
  {
    command: 'bark',
    includes: ['짖어', '짖져', '지즈어', '멍멍'],
    exact: ['지저', '지져', '찌저', '찌져', '치저', '치져', '짓어', '짙어'],
  },
  { command: 'play_dead', includes: ['빵'] },
]

export const normalizeVoice = (text: string) => text.normalize('NFC').toLowerCase().replace(/[\s.,!?~…'"“”‘’]/g, '')

export type VoiceRule = 'includes' | 'exact' | 'jamo'

export interface VoiceMatch {
  command: CommandId
  rule: VoiceRule
  /** 맞은 표의 말 (자모면 견준 명령 단어) */
  word: string
  /** 몇 번째 후보에서 잡혔는지 (0 = 첫 후보) */
  alternative: number
  /** 자모 편집 거리 (rule 이 jamo 일 때) */
  distance?: number
}

/** 한 후보를 표로 본다. 여러 명령이 들어 있으면 문장에서 먼저 나온 것. final 이 false(중간 결과)면 exact 는 보지 않는다 */
function matchTable(text: string, final: boolean): Omit<VoiceMatch, 'alternative'> | null {
  let best: { command: CommandId; word: string; at: number } | null = null
  for (const word of VOICE_WORDS) {
    if (final && word.exact?.includes(text)) return { command: word.command, rule: 'exact', word: text }
    for (const part of word.includes ?? []) {
      const at = text.indexOf(part)
      if (at >= 0 && (best === null || at < best.at)) best = { command: word.command, word: part, at }
    }
  }
  return best && { command: best.command, rule: 'includes', word: best.word }
}

// ── 자모 비교 ──────────────────────────────────────────────
// 음절을 초성·중성·종성으로 풀고, 소리 없는 초성 ㅇ 은 빼고, 겹받침은 둘로 나눈다.
// 받침과 초성을 같은 글자로 써서 소리 이음(앉아 → 안자)은 거리 0 이 된다

const INITIALS = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ'
const SILENT_INITIAL = 11
const MEDIALS = 'ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ'
// prettier-ignore
const FINALS = ['', 'ㄱ', 'ㄲ', 'ㄱㅅ', 'ㄴ', 'ㄴㅈ', 'ㄴㅎ', 'ㄷ', 'ㄹ', 'ㄹㄱ', 'ㄹㅁ', 'ㄹㅂ', 'ㄹㅅ', 'ㄹㅌ', 'ㄹㅍ', 'ㄹㅎ', 'ㅁ', 'ㅂ', 'ㅂㅅ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ']

/** 한글 음절만으로 된 말을 자모 배열로. 한글 음절이 아닌 글자가 있으면 null */
export function toJamo(text: string): string[] | null {
  const jamo: string[] = []
  for (const char of text) {
    const index = char.charCodeAt(0) - 0xac00
    if (index < 0 || index > 11171) return null
    const initial = Math.floor(index / 588)
    if (initial !== SILENT_INITIAL) jamo.push(INITIALS[initial])
    jamo.push(MEDIALS[Math.floor((index % 588) / 28)])
    jamo.push(...FINALS[index % 28])
  }
  return jamo
}

function editDistance(a: readonly string[], b: readonly string[]) {
  let previous = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    const current = [i]
    for (let j = 1; j <= b.length; j++) {
      current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    }
    previous = current
  }
  return previous[b.length]
}

/** 자모로 견주는 명령 단어. 손 줘·빵은 쓰지 않는다 (한 글자 '손'·'방'이 다른 말과 너무 가깝다) */
export const JAMO_WORDS: Partial<Record<CommandId, readonly string[]>> = {
  sit: ['앉아'],
  stand: ['일어나', '일어서'],
  bark: ['짖어'],
  down: ['엎드려'],
}
/** 이 거리까지 같은 명령으로 본다 (앉아 → 안차·아자, 짖어 → 짖·지줘, 일어나 → 일나) */
export const JAMO_MAX_DISTANCE = 1
/** 정규화한 말이 이 글자 수 이하일 때만 자모로 본다 */
export const JAMO_MAX_LENGTH = 2

/** 명령마다 가장 가까운 단어와 거리. 1~2글자 한글이 아니면 null */
export function jamoDistances(text: string, words = JAMO_WORDS) {
  if (text.length < 1 || text.length > JAMO_MAX_LENGTH) return null
  const jamo = toJamo(text)
  if (!jamo) return null
  const result: { command: CommandId; word: string; distance: number }[] = []
  for (const [command, list] of Object.entries(words) as [CommandId, readonly string[]][]) {
    let best: { word: string; distance: number } | null = null
    for (const word of list) {
      const distance = editDistance(jamo, toJamo(word) ?? [])
      if (!best || distance < best.distance) best = { word, distance }
    }
    if (best) result.push({ command, ...best })
  }
  return result.sort((a, b) => a.distance - b.distance)
}

/** 1~2글자 말을 자모 거리로. 가장 가까운 명령이 허용 거리 안이고 하나뿐일 때만 (같은 거리 명령이 둘 이상이면 null) */
export function matchJamo(text: string, words = JAMO_WORDS, maxDistance = JAMO_MAX_DISTANCE) {
  const ranked = jamoDistances(text, words)
  const best = ranked?.[0]
  if (!best || best.distance > maxDistance) return null
  if (ranked.filter((item) => item.distance === best.distance).length > 1) return null
  return best
}

/**
 * 인식 후보 전부에서 명령을 찾는다 (후보는 인식기가 준 순서, 앞이 더 그럴듯하다).
 * 1) 표: 후보를 앞에서부터 보고 처음 잡힌 후보의 명령. 한 후보에 여러 명령이면 문장에서 먼저 나온 것
 * 2) 표에서 아무 후보도 안 잡히고 최종 결과면 자모: 1~2글자 후보를 앞에서부터
 * 중간 결과(final 이 false)는 includes 만 본다
 */
export function matchVoiceAlternatives(alternatives: readonly string[], final: boolean): VoiceMatch | null {
  const texts = alternatives.map(normalizeVoice)
  for (const [alternative, text] of texts.entries()) {
    const hit = text && matchTable(text, final)
    if (hit) return { ...hit, alternative }
  }
  if (!final) return null
  for (const [alternative, text] of texts.entries()) {
    const hit = matchJamo(text)
    if (hit) return { command: hit.command, rule: 'jamo', word: hit.word, distance: hit.distance, alternative }
  }
  return null
}

/** '빵'과 비슷하게 들린 말 (명령으로는 받지 않고 '꾹 눌러도 돼요' 안내에만 쓴다) */
const BANG_LATIN = ['bang', 'bbang', 'ppang', 'pang']
const BANG_JAMO = toJamo('빵') ?? []
const isBangLike = (text: string) => {
  if (BANG_LATIN.includes(text)) return true
  if (text.length < 1 || text.length > 2) return false
  return [...text].every((syllable) => {
    const jamo = toJamo(syllable)
    return !!jamo && editDistance(jamo, BANG_JAMO) <= 1
  })
}

/** 못 알아들었을 때 덧붙일 안내. 한 글자 '손'류면 '손 줘', '빵'류면 3초 누르기 */
export function voiceMissHint(alternatives: readonly string[]): string | null {
  for (const text of alternatives.map(normalizeVoice)) {
    if ((PAW_HEADS as readonly string[]).includes(text)) return '손 줘처럼 말해 보세요'
    if (isBangLike(text)) return '꾹 눌러도 돼요'
  }
  return null
}
