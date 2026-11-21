import { useCallback, useEffect, useRef, useState } from 'react'
import { logArEvent } from './devlog/eventLog'
import { BARK_CLIP, BarkPlayer, readBarkSoundOn, writeBarkSoundOn, type BarkListener, type BarkScheduleResult } from './barkSound'
import type { ClipPlayInfo } from './dogAnimator'

// 짖는 소리 (규칙은 ./barkSound.ts). 이 화면 동안 BarkPlayer 하나:
// - 화면을 열 때 소리 파일을 받아 디코드해 둔다
// - 탭할 때마다 (캡처 단계, 화면 어디든) AudioContext 를 만들거나 다시 켠다. '우리 집 바닥에 놓기'·'3D로 보기' 도 부른다 (unlock)
// - bark 클립이 실제로 재생을 시작하면 (DogAnimator.onClipPlay) 클립 시각에 맞춰 예약, 다른 클립이 시작하면 (onClipStart) 남은 소리 취소
// - 스피커 버튼 켜기/끄기는 localStorage 에 기억

const UNLOCK_EVENTS = ['pointerup', 'touchend', 'click', 'keydown'] as const

export interface BarkSound {
  /** 소리 켜짐 (스피커 버튼) */
  on: boolean
  toggle: () => void
  /** 사용자 탭 안에서 부른다 */
  unlock: () => void
  /** DogAnimator.onClipStart: bark 가 아닌 클립이 시작하면 남은 소리 취소 */
  onClipStart: (clip: string) => void
  /** DogAnimator.onClipPlay: bark 면 예약 */
  onClipPlay: (clip: string, info: ClipPlayInfo) => void
  /** 마이크로 듣는 중 (useVoiceCommand.onMicOpen) */
  setMicOpen: (open: boolean) => void
}

export function useBarkSound({
  template,
  readListener,
}: {
  template: string
  /** 폰에서 개까지 거리·좌우 (AR·시뮬레이션). 모르면 null (1 m·가운데) */
  readListener: () => BarkListener | null
}): BarkSound {
  const [player] = useState(() => new BarkPlayer())
  const [on, setOn] = useState(() => readBarkSoundOn())
  const latest = useRef({ template, readListener })
  useEffect(() => {
    latest.current = { template, readListener }
  })

  useEffect(() => {
    player.activate()
    void player.preload().then(() => {
      if (import.meta.env.DEV && player.loadError) logArEvent('소리', `파일을 못 풀었어요: ${player.loadError}`)
    })
    const unlock = () => player.unlock()
    UNLOCK_EVENTS.forEach((type) => window.addEventListener(type, unlock, { capture: true, passive: true }))
    return () => {
      UNLOCK_EVENTS.forEach((type) => window.removeEventListener(type, unlock, { capture: true }))
      player.deactivate()
    }
  }, [player])

  useEffect(() => {
    player.setEnabled(on)
  }, [player, on])

  const toggle = useCallback(() => {
    const next = !on
    setOn(next)
    writeBarkSoundOn(next)
    if (import.meta.env.DEV) logArEvent('소리', next ? '켬' : '끔')
    player.unlock()
  }, [player, on])

  const unlock = useCallback(() => player.unlock(), [player])

  const onClipStart = useCallback(
    (clip: string) => {
      if (clip === BARK_CLIP) return
      const cancelled = player.cancelPending()
      if (import.meta.env.DEV && cancelled) logArEvent('소리', `짖기가 끊겨 남은 소리 ${cancelled}개 취소 (${clip} 시작)`)
    },
    [player],
  )

  const onClipPlay = useCallback(
    (clip: string, info: ClipPlayInfo) => {
      if (clip !== BARK_CLIP) return
      const { template: current, readListener: read } = latest.current
      const result = player.bark({
        template: current,
        clipTime: info.time,
        clipRate: info.rate,
        duration: info.duration,
        times: info.times,
        listener: read(),
      })
      if (import.meta.env.DEV) logArEvent('소리', describeBark(result, player.contextState))
    },
    [player],
  )

  const setMicOpen = useCallback(
    (open: boolean) => {
      const stopped = open ? player.voiceCount : 0
      player.setMicOpen(open)
      if (import.meta.env.DEV && stopped) logArEvent('소리', `마이크로 듣기 시작 → 소리 ${stopped}개 멈춤`)
    },
    [player],
  )

  return { on, toggle, unlock, onClipStart, onClipPlay, setMicOpen }
}

/** 개발 기록 한 줄 */
function describeBark(result: BarkScheduleResult, state: string): string {
  if (!result.scheduled) {
    const reason = { off: '소리 꺼짐', mic: '마이크로 듣는 중', locked: `AudioContext ${state}`, loading: '파일 준비 전', disposed: '화면 끝' }[result.reason]
    return `짖기 소리 안 냄 (${reason})`
  }
  const at = result.delays.map((delay) => delay.toFixed(2)).join('·')
  return `${result.sound} 높이 ${result.pitch.toFixed(3)} · ${at} s 뒤 · 크기 ${result.gain.toFixed(2)} · 좌우 ${result.pan.toFixed(2)}`
}
