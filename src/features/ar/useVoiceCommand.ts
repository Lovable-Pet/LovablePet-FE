import { useCallback, useEffect, useRef, useState } from 'react'
import { useFlashMessage } from '../../hooks/useFlashMessage'
import type { CommandId } from './dogAnimator'
import { AR_PERMISSION_TEXT, LISTEN_VIBRATE_MS, startVoiceSession, type Recognition, type VoicePhase, type VoiceSession } from './voiceSession'

// 마이크 버튼으로 말해서 명령한다 (Web Speech API). 한 번 듣기의 흐름·문구는 ./voiceSession.ts
// - 한 번 누르면 한 번 듣고 끝난다 (continuous 를 쓰지 않는다). 듣는 중에 다시 누르면 멈춘다
// - 상태: starting (마이크 여는 중, '잠깐만요…') → listening (마이크 열림, '지금 말해 주세요' + 진동) → hearing (말소리가 들어옴)
// - 후보(maxAlternatives)를 전부 보고 명령이 잡힌 후보 중 앞 순위를 쓴다 (voiceWords.matchVoiceAlternatives)
// - 말하는 중간 결과(interimResults)에서 단어(includes)가 잡히면 바로 명령하고 듣기를 멈춘다.
//   문장 전체로만 맞추는 말(exact)과 자모 비교는 최종 결과에서만
// - 들린 말에서 명령을 못 찾으면 onMiss 를 부른다 (한 번 들을 때 한 번). 중간 결과, 오류, 아무 말도 안 들린 때는 부르지 않는다
// - 개발 모드에서는 한 번 들을 때마다 후보·잡힌 규칙·걸린 시간을 voiceLog 에 남긴다 (?debug 에서 보기·복사)
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

type RecognitionConstructor = new () => Recognition

const getRecognition = () => {
  const speechWindow = window as Window & {
    SpeechRecognition?: RecognitionConstructor
    webkitSpeechRecognition?: RecognitionConstructor
  }
  return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition
}

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
  const [phase, setPhase] = useState<VoicePhase>('idle')
  /** 듣는 중에 들린 말 (중간 결과). 개발 모드에서만 채운다 */
  const [heard, setHeard] = useState('')
  const { flash, show } = useFlashMessage(VOICE_FLASH_MS)
  const permission = useMicPermission()
  const sessionRef = useRef<VoiceSession | null>(null)
  // 듣는 동안 바뀔 수 있는 값은 콜백 안에서 최신 값으로 읽는다
  const latest = useRef({ inAr, onCommand, onMiss, permission })
  useEffect(() => {
    latest.current = { inAr, onCommand, onMiss, permission }
  })

  useEffect(() => () => sessionRef.current?.silence(), [])

  useEffect(() => {
    if (disabled) sessionRef.current?.silence()
  }, [disabled])

  const toggle = useCallback(() => {
    if (sessionRef.current) {
      sessionRef.current.stop()
      return
    }
    const RecognitionClass = getRecognition()
    if (!RecognitionClass) return
    if (!ASK_MIC_IN_AR && latest.current.inAr && latest.current.permission !== 'granted') {
      show(AR_PERMISSION_TEXT)
      return
    }
    setHeard('')
    let ended = false
    const session = startVoiceSession({
      create: () => new RecognitionClass(),
      onPhase: setPhase,
      onHeard: setHeard,
      onCommand: (id) => latest.current.onCommand(id),
      onMiss: () => latest.current.onMiss?.(),
      show,
      // AR 안에서 권한 창 없이 거절됐으면(아직 '거부'로 정하지 않았으면) AR 밖에서 허용하라고 안내한다
      blockedInAr: () => latest.current.inAr && latest.current.permission !== 'denied',
      // 알림음은 마이크에 다시 들어가 쓰지 않는다
      vibrate: () => {
        if (typeof navigator.vibrate === 'function') navigator.vibrate(LISTEN_VIBRATE_MS)
      },
      onEnd: () => {
        // 한 번에 하나만 듣는다 (듣는 중에는 새로 만들지 않는다)
        ended = true
        sessionRef.current = null
      },
    })
    if (session && !ended) sessionRef.current = session
  }, [show])

  /**
   * 마이크 권한을 미리 받는다 (AR 시작 안내 화면, AR 안에서 권한 창이 뜨지 않게). 결과는 permission 이 바뀌어 알린다.
   * 거부·마이크 없음이면 말 걸기를 눌렀을 때 지금 안내 그대로
   */
  const askPermission = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices?.getUserMedia({ audio: true })
      stream?.getTracks().forEach((track) => track.stop())
    } catch {
      // 거부·기기 없음
    }
  }, [])

  /** listening: 듣기 시작부터 끝까지 (starting·listening·hearing). phase 로 말풍선·버튼 모양을 가른다 */
  return { supported, phase, listening: phase !== 'idle', heard, flash, toggle, permission, askPermission }
}
