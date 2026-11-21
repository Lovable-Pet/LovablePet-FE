import { COMMANDS, type CommandId } from './dogAnimator'
import { logArEvent } from './devlog/eventLog'
import { addVoiceLog, type VoiceLogEntry } from './voiceLog'
import { matchVoiceAlternatives, voiceMissHint } from './voiceWords'

// 말 걸기 한 번 (마이크를 한 번 눌러 한 번 듣기). useVoiceCommand 가 감싼다 (React 없이 단위 시험).
// 상태: starting (start() 직후, 마이크가 아직 안 열림) → listening (onaudiostart: 마이크가 열림, 이제 말해도 됨) →
//       hearing (onspeechstart 또는 첫 결과: 말소리가 들어옴) → idle (끝)
// - start() 직후 바로 '듣고 있어요' 를 띄우면 마이크가 열리기 전에 한 말이 빠졌다 (폰에서 인식이 아예 안 되던 경우).
//   마이크가 열리면 '지금 말해 주세요' 와 짧은 진동 (알림음은 마이크에 다시 들어가 쓰지 않는다)
// - 소리가 한 번도 없이 (onsoundstart 없음) 'no-speech' 로 끝나면 알리지 않고 한 번만 다시 듣는다. 두 번째도 같으면 안내
// - 배포 화면: 알아들으면 아무 문구 없이 명령만, 못 알아들으면 들린 글자 없이 MISS_TEXT. 듣는 중 들린 글자도 안 보인다
// - 개발 모드 + ?debug (options.debug): 들린 말 → 명령 [규칙·후보], 중간 결과 글자. ?debug 가 없으면 개발 서버도 배포와 같은 문구
// - 개발 모드: 누름부터 각 이벤트까지 걸린 시간 (음성 기록·이벤트 기록, ?debug 에서 보인다)

export type VoicePhase = 'idle' | 'starting' | 'listening' | 'hearing'

/** 말풍선 문구 (상태별) */
export const VOICE_PHASE_TEXT = {
  starting: '잠깐만요…',
  listening: '지금 말해 주세요',
  hearing: '듣고 있어요…',
} as const satisfies Record<Exclude<VoicePhase, 'idle'>, string>

/** 배포 화면에서 못 알아들었을 때 */
export const MISS_TEXT = '잘 못 들었어요 · 다시 눌러 말해 주세요'

/** 마이크가 열렸을 때 진동 (ms) */
export const LISTEN_VIBRATE_MS = 30

/**
 * onstart 뒤 이만큼 (ms) 지나도 onaudiostart 가 없으면 열린 것으로 본다.
 * onaudiostart 를 안 주는 브라우저에서 '잠깐만요…' 에 멈춰 있지 않게
 */
export const AUDIOSTART_FALLBACK_MS = 2000

export const ERROR_TEXT: Partial<Record<SpeechRecognitionErrorCode, string>> = {
  'no-speech': '목소리가 들리지 않았어요. 다시 눌러 말해 주세요',
  'audio-capture': '마이크를 쓸 수 없어요. 다른 앱이 쓰고 있는지 확인해 주세요',
  network: '음성 인식은 인터넷 연결이 필요해요',
  'not-allowed': '마이크 권한이 꺼져 있어요. 사이트 설정에서 허용해 주세요',
  'service-not-allowed': '이 브라우저에서는 음성 인식을 쓸 수 없어요',
  'language-not-supported': '한국어 음성 인식을 쓸 수 없어요',
}
export const AR_PERMISSION_TEXT = 'AR 안에서는 마이크를 허용할 수 없었어요. AR을 닫고 마이크를 눌러 먼저 허용해 주세요'
export const START_FAILED_TEXT = '음성 인식을 시작하지 못했어요. 다시 눌러 주세요'

/** lib.dom 에 SpeechRecognition 본체 타입이 없어 쓰는 것만 적는다 */
export interface Recognition {
  lang: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives: number
  onstart: (() => void) | null
  onaudiostart: (() => void) | null
  onsoundstart: (() => void) | null
  onspeechstart: (() => void) | null
  onresult: ((event: SpeechRecognitionEvent) => void) | null
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null
  onend: (() => void) | null
  start(): void
  stop(): void
  abort(): void
}

/** 말풍선: 듣는 중이면 상태 문구 (개발 모드 ?debug 의 hearing 은 들린 글자), 아니면 잠깐 보이는 결과·오류 */
export function voiceBubble(phase: VoicePhase, heard: string, flash: string | null | undefined): string | null {
  if (phase === 'idle') return flash ?? null
  if (phase === 'hearing' && heard) return `“${heard}”`
  return VOICE_PHASE_TEXT[phase]
}

export interface VoiceSessionOptions {
  /** 인식기 하나 만들기 (다시 들을 때 새로 만든다) */
  create: () => Recognition
  onPhase: (phase: VoicePhase) => void
  /** 들린 글자 (개발 모드 + debug 에서만 부른다) */
  onHeard: (text: string) => void
  /** 개발용 문구 (들린 말 → 명령 [규칙]·후보·중간 결과 글자)를 보일지: 개발 모드 + ?debug. 배포 빌드에서는 보지 않는다 */
  debug?: boolean
  onCommand: (id: CommandId) => void
  /** 들린 말에서 명령을 못 찾음 (갸우뚱) */
  onMiss: () => void
  /** 잠깐 보이는 문구 */
  show: (text: string) => void
  /** 'not-allowed' 를 AR 안 권한 문제로 볼지 (AR 안 + 권한이 아직 '거부' 가 아님) */
  blockedInAr: () => boolean
  /** 마이크가 열렸을 때 (진동) */
  vibrate?: () => void
  /** 끝남 (다시 누를 수 있음) */
  onEnd: () => void
  /** 시계 (ms). 시험에서 바꾼다 */
  now?: () => number
  setTimer?: (fn: () => void, ms: number) => unknown
  clearTimer?: (timer: unknown) => void
}

export interface VoiceSession {
  /** 버튼을 다시 누름: 지금까지 들은 것으로 끝낸다 (다시 듣지 않는다) */
  stop: () => void
  /** 결과·안내 없이 조용히 멈춘다 (막혔을 때) */
  silence: () => void
}

const labelOf = (id: CommandId) => COMMANDS.find((command) => command.id === id)?.label ?? id

/** 한 번 듣기를 시작한다. 시작하지 못하면 안내하고 null */
export function startVoiceSession(options: VoiceSessionOptions): VoiceSession | null {
  const now = options.now ?? (() => performance.now())
  const setTimer = options.setTimer ?? ((fn: () => void, ms: number) => setTimeout(fn, ms))
  const clearTimer = options.clearTimer ?? ((timer: unknown) => clearTimeout(timer as ReturnType<typeof setTimeout>))
  const pressedAt = now()

  let phase: VoicePhase = 'idle'
  const setPhase = (next: VoicePhase) => {
    if (phase === next) return
    phase = next
    options.onPhase(next)
  }

  /** 명령을 찾았거나 결과·오류를 이미 알렸다 (다시 듣지 않는다) */
  let done = false
  /** 사용자가 멈췄거나 막혔다 (다시 듣지 않는다) */
  let stopped = false
  /** 몇 번째 듣기 (1, 다시 들으면 2) */
  let attempt = 1
  /** 이번 듣기에 소리가 들어왔는지 (onsoundstart 또는 결과) */
  let soundSeen = false
  /** 소리 없이 'no-speech' → onend 에서 다시 듣는다 */
  let retryPending = false
  /** 마지막으로 들린 후보들 (최종 결과 없이 끝날 때) */
  let lastAlternatives: VoiceLogEntry['alternatives'] = []
  /** 개발 기록: 지나간 중간 결과 (첫 후보) · 누름부터 걸린 시간 */
  const interims: string[] = []
  const timings: string[] = []
  let fallbackTimer: unknown = null
  let recognition: Recognition | null = null

  /** 개발 모드: 누름부터 이 이벤트까지 (ms) 를 음성 기록 줄과 이벤트 기록에 */
  const mark = (name: string) => {
    if (import.meta.env.DEV) {
      const label = `${attempt > 1 ? `${attempt}차 ` : ''}${name} ${Math.round(now() - pressedAt)}`
      timings.push(label)
      logArEvent('음성 시간', `${label} ms`)
    }
  }
  const log = (entry: Omit<VoiceLogEntry, 'at' | 'interims' | 'timings'>) => {
    if (import.meta.env.DEV) addVoiceLog({ ...entry, at: Date.now(), interims: [...interims], timings: [...timings] })
  }
  /** 못 알아들음: 배포(와 ?debug 없는 개발)는 들린 글자 없이, 개발 ?debug 는 들린 말 · 덧붙일 안내 · 다른 후보 */
  const showMiss = (texts: readonly string[]) => {
    if (import.meta.env.DEV && options.debug) {
      const hint = voiceMissHint(texts)
      const others = texts.length > 1 ? ` (후보: ${texts.slice(1).join(' / ')})` : ''
      options.show(`“${texts[0] ?? ''}” · 알아듣지 못했어요${hint ? ` · ${hint}` : ''}${others}`)
    } else {
      options.show(MISS_TEXT)
    }
  }
  const clearFallback = () => {
    if (fallbackTimer !== null) clearTimer(fallbackTimer)
    fallbackTimer = null
  }
  /** 마이크가 열림 (fallback: onaudiostart 없이 시간이 지나 열린 것으로 봄) */
  const opened = (fallback: boolean) => {
    clearFallback()
    if (phase !== 'starting') return
    if (import.meta.env.DEV) mark(fallback ? 'audiostart 없음 → 열린 것으로' : 'onaudiostart')
    setPhase('listening')
    options.vibrate?.()
  }
  const hearing = () => {
    soundSeen = true
    if (phase === 'starting' || phase === 'listening') {
      clearFallback()
      setPhase('hearing')
    }
  }

  const listen = (): boolean => {
    const r = options.create()
    r.lang = 'ko-KR'
    r.continuous = false
    r.interimResults = true
    r.maxAlternatives = 5
    soundSeen = false
    r.onstart = () => {
      mark('onstart')
      clearFallback()
      if (phase === 'starting') fallbackTimer = setTimer(() => opened(true), AUDIOSTART_FALLBACK_MS)
    }
    r.onaudiostart = () => opened(false)
    r.onsoundstart = () => {
      mark('onsoundstart')
      soundSeen = true
    }
    r.onspeechstart = () => {
      mark('onspeechstart')
      hearing()
    }
    r.onresult = (event) => {
      if (done) return
      const result = event.results[event.results.length - 1]
      const alternatives = Array.from(result, (alternative) => ({
        text: alternative.transcript.trim(),
        confidence: alternative.confidence ?? 0,
      })).filter((alternative) => alternative.text)
      const texts = alternatives.map((alternative) => alternative.text)
      const text = texts[0] ?? ''
      if (import.meta.env.DEV && !interims.length && !result.isFinal) mark('첫 중간 결과')
      hearing()
      lastAlternatives = alternatives
      if (import.meta.env.DEV && options.debug) options.onHeard(text)
      const match = matchVoiceAlternatives(texts, result.isFinal)
      if (!match && !result.isFinal) {
        if (import.meta.env.DEV && text && interims.at(-1) !== text) interims.push(text)
        return
      }
      done = true
      mark(match ? `명령 (${result.isFinal ? '최종' : '중간'})` : '못 알아들음')
      log({ kind: result.isFinal ? 'final' : 'interim', alternatives, match })
      if (match) {
        options.onCommand(match.command)
        r.stop()
        // 배포 화면(과 ?debug 없는 개발)은 알아들었을 때 문구 없이 명령만
        if (import.meta.env.DEV && options.debug) {
          const rule = ` [${match.rule}${match.distance !== undefined ? ` ${match.distance}` : ''}${match.alternative ? ` · 후보${match.alternative + 1}` : ''}]`
          const others = texts.length > 1 ? ` (후보: ${texts.filter((_, index) => index !== match.alternative).join(' / ')})` : ''
          options.show(`“${texts[match.alternative]}” → ${labelOf(match.command)}${rule}${others}`)
        }
      } else {
        showMiss(texts)
        if (text) options.onMiss()
      }
    }
    r.onerror = (event) => {
      // abort() 로 멈춘 것
      if (event.error === 'aborted') return
      mark(`오류 ${event.error}`)
      // 소리가 한 번도 없이 끝났으면 알리지 않고 한 번만 다시 듣는다 (onend 에서)
      if (event.error === 'no-speech' && !soundSeen && attempt === 1 && !stopped && !done) {
        retryPending = true
        return
      }
      done = true
      log({ kind: 'error', alternatives: lastAlternatives, match: null, error: event.error })
      const blocked = event.error === 'not-allowed' && options.blockedInAr()
      options.show(blocked ? AR_PERMISSION_TEXT : (ERROR_TEXT[event.error] ?? '음성 인식이 멈췄어요. 다시 눌러 주세요'))
    }
    r.onend = () => {
      if (recognition !== r) return
      mark('onend')
      clearFallback()
      if (retryPending && !stopped && !done) {
        retryPending = false
        attempt = 2
        setPhase('starting')
        if (listen()) return
        done = true
        options.show(START_FAILED_TEXT)
      }
      // 최종 결과 없이 끝났는데 들린 말이 있었으면 (말하다 버튼을 다시 누른 때 등) 못 알아들음
      if (!done && lastAlternatives.length) {
        done = true
        log({ kind: 'end', alternatives: lastAlternatives, match: null })
        showMiss(lastAlternatives.map((alternative) => alternative.text))
        options.onMiss()
      }
      recognition = null
      setPhase('idle')
      if (import.meta.env.DEV && options.debug) options.onHeard('')
      options.onEnd()
    }
    recognition = r
    try {
      r.start()
    } catch {
      recognition = null
      return false
    }
    mark(attempt > 1 ? 'start() (다시 듣기)' : 'start()')
    return true
  }

  mark('누름')
  setPhase('starting')
  if (!listen()) {
    setPhase('idle')
    options.show(START_FAILED_TEXT)
    return null
  }
  return {
    stop: () => {
      stopped = true
      retryPending = false
      recognition?.stop()
    },
    silence: () => {
      // onerror('aborted')·onend 가 결과나 '알아듣지 못했어요' 를 내지 않게
      stopped = true
      retryPending = false
      done = true
      lastAlternatives = []
      recognition?.abort()
    },
  }
}
