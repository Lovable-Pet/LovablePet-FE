import { useSyncExternalStore } from 'react'
import { COMMANDS } from './dogAnimator'
import { logArEvent } from './devlog/eventLog'
import { jamoDistances, normalizeVoice, type VoiceMatch } from './voiceWords'

// 개발 모드 음성 인식 기록. 최근 VOICE_LOG_SIZE 번을 메모리에만 모아 ?debug 의 '음성 기록' 에서 보고 복사한다.
// 부르는 곳이 모두 import.meta.env.DEV 안이라 배포 빌드에는 들어가지 않는다.
// 한 번 들을 때(마이크 한 번) 한 줄: 명령이 잡힌 결과(중간·최종), 최종 결과에서 못 잡음, 최종 없이 끝남, 오류

export const VOICE_LOG_SIZE = 30

export interface VoiceLogEntry {
  at: number
  /** final 최종 결과 · interim 중간 결과에서 잡힘 · end 최종 결과 없이 끝남 · error 인식 오류 */
  kind: 'final' | 'interim' | 'end' | 'error'
  /** 인식기가 준 후보 전부 (앞이 더 그럴듯하다). confidence 는 인식기가 안 주면 0 */
  alternatives: readonly { text: string; confidence: number }[]
  /** 듣는 동안 지나간 중간 결과 (첫 후보, 같은 것은 한 번) */
  interims: readonly string[]
  match: VoiceMatch | null
  error?: string
  /** 버튼 누름부터 각 이벤트까지 (예: 'onaudiostart 480', 다시 들으면 '2차 …'). 폰에서 마이크가 열리기까지 걸린 시간을 본다 */
  timings?: readonly string[]
}

let entries: readonly VoiceLogEntry[] = []
const listeners = new Set<() => void>()
const notify = () => listeners.forEach((listener) => listener())

export function addVoiceLog(entry: VoiceLogEntry) {
  entries = [entry, ...entries].slice(0, VOICE_LOG_SIZE)
  notify()
  // 이벤트 기록(?debug)에도 같은 한 줄 (시각은 이벤트 기록 쪽 초를 쓴다)
  logArEvent('음성', formatVoiceLogEntry(entry).slice(9))
}

export function clearVoiceLog() {
  entries = []
  notify()
}

const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** 최근 기록 (새것이 앞) */
export function useVoiceLog() {
  return useSyncExternalStore(subscribe, () => entries)
}

const KIND = { final: '최종', interim: '중간', end: '끝', error: '오류' } as const
const labelOf = (id: string) => COMMANDS.find((command) => command.id === id)?.label ?? id
const time = (at: number) => new Date(at).toTimeString().slice(0, 8)

/** 한 줄. 예: 12:03:41 최종 | 안자 0.82 / 앉아 0.11 | → 앉아(sit) exact '안자' 후보1 */
export function formatVoiceLogEntry(entry: VoiceLogEntry) {
  const alternatives = entry.alternatives
    .map(({ text, confidence }) => (confidence > 0 ? `${text} ${confidence.toFixed(2)}` : text))
    .join(' / ')
  const head = `${time(entry.at)} ${KIND[entry.kind]}${entry.error ? ` ${entry.error}` : ''} | ${alternatives || '-'}`
  const timings = entry.timings?.length ? ` | 시간(ms): ${entry.timings.join(' → ')}` : ''
  const interims = (entry.interims.length ? ` | 중간: ${entry.interims.join(' → ')}` : '') + timings
  const { match } = entry
  if (match) {
    const distance = match.distance !== undefined ? ` 거리${match.distance}` : ''
    return `${head} | → ${labelOf(match.command)}(${match.command}) ${match.rule} '${match.word}'${distance} 후보${match.alternative + 1}${interims}`
  }
  if (entry.kind === 'error') return head + interims
  // 못 잡았으면 1~2글자 후보의 자모 거리 (허용 거리를 정하는 데 쓴다)
  const jamo = entry.alternatives
    .map(({ text }) => {
      const ranked = jamoDistances(normalizeVoice(text))
      return ranked && `${text}{${ranked.map((item) => `${item.command}${item.distance}`).join(' ')}}`
    })
    .filter(Boolean)
  return `${head} | → 못 잡음${jamo.length ? ` · 자모 ${jamo.join(' ')}` : ''}${interims}`
}

/** 복사용 (오래된 것부터) */
export const formatVoiceLog = (list: readonly VoiceLogEntry[]) => [...list].reverse().map(formatVoiceLogEntry).join('\n')
