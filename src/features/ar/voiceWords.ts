import type { CommandId } from './dogAnimator'

// 음성 → 명령 표. 단어를 더하려면 여기만 고친다.
// 처음 값은 AI 저장소 docs/ANIMATION.md 5절의 정규식과 같다. 폰에서 잘못 알아들은 말은
// 마이크 옆 말풍선에 그대로 보이니(개발 모드에서는 다른 후보도) 보고 더한다.
//
// - includes: 말한 문장 안에 들어 있으면 맞다. 말하는 중간 결과에서도 보고 바로 실행한다
// - exact: 문장 전체가 이 말일 때만 맞다. 한 글자 '손'처럼 다른 말(손님, 손잡이)에 섞이기 쉬운 것.
//   중간 결과에서는 보지 않는다 ('손님'을 말하는 중에 '손'이 먼저 잡힌다)
// 비교할 때는 띄어쓰기와 문장부호를 뺀다 ('손 줘!' → '손줘')

interface VoiceWord {
  command: CommandId
  includes?: readonly string[]
  exact?: readonly string[]
}

export const VOICE_WORDS: readonly VoiceWord[] = [
  { command: 'sit', includes: ['앉아', '앉자'] },
  { command: 'down', includes: ['엎드려', '엎드리'] },
  { command: 'stand', includes: ['일어나', '일어서'] },
  { command: 'shake', includes: ['악수'], exact: ['손', '손줘'] },
  { command: 'rollover', includes: ['굴러', '구르'] },
  { command: 'bark', includes: ['짖어', '멍멍'] },
  { command: 'play_dead', includes: ['빵'] },
]

const normalize = (text: string) => text.replace(/[\s.,!?~…'"“”‘’]/g, '')

/**
 * 인식한 문장에서 명령을 찾는다. 여러 개면 문장에서 먼저 나온 것.
 * final 이 false(중간 결과)면 exact 는 보지 않는다
 */
export function matchVoiceCommand(transcript: string, final: boolean): CommandId | null {
  const text = normalize(transcript)
  if (!text) return null
  let best: { command: CommandId; at: number } | null = null
  for (const word of VOICE_WORDS) {
    if (final && word.exact?.includes(text)) return word.command
    for (const part of word.includes ?? []) {
      const at = text.indexOf(part)
      if (at >= 0 && (best === null || at < best.at)) best = { command: word.command, at }
    }
  }
  return best?.command ?? null
}
