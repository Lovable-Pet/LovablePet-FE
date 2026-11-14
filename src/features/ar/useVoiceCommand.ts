import { useCallback, useEffect, useRef, useState } from 'react'
import { useFlashMessage } from '../../hooks/useFlashMessage'
import { COMMANDS, type CommandId } from './dogAnimator'
import { matchVoiceCommand } from './voiceWords'

// 마이크 버튼으로 말해서 명령한다 (Web Speech API).
// - 한 번 누르면 한 번 듣고 끝난다 (continuous 를 쓰지 않는다). 듣는 중에 다시 누르면 멈춘다
// - 말하는 중간 결과(interimResults)에서 단어가 잡히면 바로 명령하고 듣기를 멈춘다
// - 들린 말에서 명령을 못 찾으면 '알아듣지 못했어요' 를 띄우고 onMiss 를 부른다 (한 번 들을 때 한 번).
//   중간 결과, 권한 거부·시작 실패 같은 오류, 아무 말도 안 들린 때는 부르지 않는다
// - 안드로이드 Chrome 의 음성 인식은 구글 서버를 거쳐 인터넷이 필요하다
// - 아이폰 Quick Look AR 은 페이지 밖에서 돌아 음성이 안 된다 (화면 안 3D 에서만)

/**
 * AR 안에서 마이크 권한을 아직 받지 않았을 때 권한 창을 띄울지.
 * 권한 창이 AR 화면을 깨면 false 로 바꾼다: AR 안에서는 듣지 않고, AR 밖(화면 안 3D)에서 먼저 허용하라고 안내한다.
 * AR 밖에서 한 번 허용하면 AR 안에서는 다시 묻지 않는다
 */
const ASK_MIC_IN_AR = true

/**
 * 아이폰·아이패드에서도 마이크 버튼을 보일지. 실제 기기에서 음성 인식을 확인하기 전까지 숨긴다.
 * iOS 의 브라우저는 Chrome 도 사파리 엔진이라 모두 같이 숨는다
 */
const VOICE_ON_IOS = true

/** 아이폰·아이패드. 아이패드는 기본(데스크톱 모드)으로 Mac 처럼 보여 터치 수로 가른다 */
const isIos = () =>
  /iPhone|iPad|iPod/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1)

/** 들은 말·오류를 보이는 시간 */
const VOICE_FLASH_MS = 2500

const ERROR_TEXT: Partial<Record<SpeechRecognitionErrorCode, string>> = {
  'no-speech': '목소리가 들리지 않았어요. 다시 눌러 말해 주세요',
  'audio-capture': '마이크를 쓸 수 없어요. 다른 앱이 쓰고 있는지 확인해 주세요',
  network: '음성 인식은 인터넷 연결이 필요해요',
  'not-allowed': '마이크 권한이 꺼져 있어요. 사이트 설정에서 허용해 주세요',
  'service-not-allowed': '이 브라우저에서는 음성 인식을 쓸 수 없어요',
  'language-not-supported': '한국어 음성 인식을 쓸 수 없어요',
}
const AR_PERMISSION_TEXT = 'AR 안에서는 마이크를 허용할 수 없었어요. AR을 닫고 마이크를 눌러 먼저 허용해 주세요'

/** lib.dom 에 SpeechRecognition 본체 타입이 없어 쓰는 것만 적는다 */
interface Recognition {
  lang: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives: number
  onresult: ((event: SpeechRecognitionEvent) => void) | null
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null
  onend: (() => void) | null
  start(): void
  stop(): void
  abort(): void
}
type RecognitionConstructor = new () => Recognition

const getRecognition = () => {
  const speechWindow = window as Window & {
    SpeechRecognition?: RecognitionConstructor
    webkitSpeechRecognition?: RecognitionConstructor
  }
  return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition
}

const labelOf = (id: CommandId) => COMMANDS.find((command) => command.id === id)?.label ?? id

/** 마이크 권한 상태. Permissions API 가 없거나 'microphone' 을 모르면 null */
function useMicPermission() {
  const [state, setState] = useState<PermissionState | null>(null)
  useEffect(() => {
    let status: PermissionStatus | null = null
    let cancelled = false
    const onChange = () => status && setState(status.state)
    navigator.permissions
      ?.query({ name: 'microphone' })
      .then((result) => {
        if (cancelled) return
        status = result
        setState(result.state)
        result.addEventListener('change', onChange)
      })
      .catch(() => {})
    return () => {
      cancelled = true
      status?.removeEventListener('change', onChange)
    }
  }, [])
  return state
}

export function useVoiceCommand({
  inAr,
  disabled = false,
  onCommand,
  onMiss,
}: {
  inAr: boolean
  /** 막혔는지 (AR 에서 개를 놓기 전). 듣는 중에 막히면 결과 없이 조용히 멈춘다 */
  disabled?: boolean
  onCommand: (id: CommandId) => void
  /** 들린 말에서 명령을 못 찾았을 때 */
  onMiss?: () => void
}) {
  const [supported] = useState(() => getRecognition() !== undefined && (VOICE_ON_IOS || !isIos()))
  const [listening, setListening] = useState(false)
  /** 듣는 중에 들린 말 (중간 결과) */
  const [heard, setHeard] = useState('')
  const { flash, show } = useFlashMessage(VOICE_FLASH_MS)
  const permission = useMicPermission()
  const recognitionRef = useRef<Recognition | null>(null)
  // 듣는 동안 바뀔 수 있는 값은 콜백 안에서 최신 값으로 읽는다
  const latest = useRef({ inAr, onCommand, onMiss, permission })
  useEffect(() => {
    latest.current = { inAr, onCommand, onMiss, permission }
  })

  /** 듣는 중인 것을 결과·안내 없이 멈춘다 */
  const silenceRef = useRef<(() => void) | null>(null)

  useEffect(() => () => recognitionRef.current?.abort(), [])

  useEffect(() => {
    if (disabled) silenceRef.current?.()
  }, [disabled])

  const toggle = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop()
      return
    }
    const RecognitionClass = getRecognition()
    if (!RecognitionClass) return
    if (!ASK_MIC_IN_AR && latest.current.inAr && latest.current.permission !== 'granted') {
      show(AR_PERMISSION_TEXT)
      return
    }

    const recognition = new RecognitionClass()
    recognition.lang = 'ko-KR'
    recognition.continuous = false
    recognition.interimResults = true
    // 맞춰 보는 건 첫 후보뿐이다. 나머지는 개발 모드에서 단어 표에 더할 말을 찾으라고 보인다
    recognition.maxAlternatives = 3
    /** 명령을 찾았거나 결과·오류를 이미 알렸다 */
    let done = false
    let lastText = ''

    recognition.onresult = (event) => {
      if (done) return
      const result = event.results[event.results.length - 1]
      const alternatives = Array.from(result, (alternative) => alternative.transcript.trim()).filter(Boolean)
      const text = alternatives[0] ?? ''
      lastText = text
      setHeard(text)
      const command = matchVoiceCommand(text, result.isFinal)
      if (!command && !result.isFinal) return
      done = true
      const others = import.meta.env.DEV && alternatives.length > 1 ? ` (후보: ${alternatives.slice(1).join(' / ')})` : ''
      if (command) {
        latest.current.onCommand(command)
        recognition.stop()
        show(`“${text}” → ${labelOf(command)}${others}`)
      } else {
        show(`“${text}” · 알아듣지 못했어요${others}`)
        if (text) latest.current.onMiss?.()
      }
    }
    recognition.onerror = (event) => {
      // abort() 로 멈춘 것
      if (event.error === 'aborted') return
      done = true
      // AR 안에서 권한 창 없이 거절됐으면(아직 '거부'로 정하지 않았으면) AR 밖에서 허용하라고 안내한다
      const blockedInAr = event.error === 'not-allowed' && latest.current.inAr && latest.current.permission !== 'denied'
      show(blockedInAr ? AR_PERMISSION_TEXT : (ERROR_TEXT[event.error] ?? '음성 인식이 멈췄어요. 다시 눌러 주세요'))
    }
    recognition.onend = () => {
      if (recognitionRef.current === recognition) {
        recognitionRef.current = null
        silenceRef.current = null
      }
      setListening(false)
      setHeard('')
      // 최종 결과 없이 끝났는데 들린 말이 있었으면 (말하다 버튼을 다시 누른 때 등) 보여 준다
      if (!done && lastText) {
        show(`“${lastText}” · 알아듣지 못했어요`)
        latest.current.onMiss?.()
      }
    }

    try {
      recognition.start()
    } catch {
      show('음성 인식을 시작하지 못했어요. 다시 눌러 주세요')
      return
    }
    recognitionRef.current = recognition
    silenceRef.current = () => {
      // onerror('aborted')·onend 가 결과나 '알아듣지 못했어요' 를 내지 않게
      done = true
      lastText = ''
      recognition.abort()
    }
    setHeard('')
    setListening(true)
  }, [show])

  return { supported, listening, heard, flash, toggle }
}
