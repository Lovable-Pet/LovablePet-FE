import { useEffect, useState } from 'react'
import { hasWelcomed } from '../../features/welcome/welcomed'
import { RunningDog } from '../Character/Character'
import wordmark from '../../assets/logo-wordmark.png'
import { cn } from '../utils/cn'

/** 보여 주는 시간과 사라지는 시간 */
const SHOW_MS = 1700
const FADE_MS = 320
const SESSION_KEY = 'lp.splashed'

/**
 * 스플래시를 띄울지: 다른 경로·쿼리 없이 '/' 로 처음 들어왔을 때만.
 * 앱을 켠 그 순간의 주소로 한 번만 정한다 (앱 안에서 홈으로 돌아올 때는 띄우지 않는다).
 * 같은 탭에서 새로고침하면 다시 띄우지 않고, 처음 온 사람은 시작 화면(/welcome)이 대신 나온다
 */
const shouldSplash = (() => {
  const { pathname, search, hash } = window.location
  if (pathname !== '/' || search !== '' || hash !== '') return false
  if (!hasWelcomed()) return false
  try {
    if (sessionStorage.getItem(SESSION_KEY)) return false
    sessionStorage.setItem(SESSION_KEY, '1')
  } catch {
    // 저장소를 못 쓰면 매번 띄운다
  }
  return true
})()

/** 앱을 켰을 때 잠깐 덮는 화면: 달리는 강아지와 로고. 끝나면 스르륵 사라진다 */
export function Splash() {
  const [phase, setPhase] = useState<'show' | 'leave' | 'done'>(shouldSplash ? 'show' : 'done')

  useEffect(() => {
    if (phase === 'done') return
    const timer = setTimeout(() => setPhase(phase === 'show' ? 'leave' : 'done'), phase === 'show' ? SHOW_MS : FADE_MS)
    return () => clearTimeout(timer)
  }, [phase])

  if (phase === 'done') return null
  return (
    <div
      role="status"
      aria-label="Lovable Pet 을 여는 중"
      className={cn(
        'fixed inset-0 z-[100] flex justify-center bg-backdrop transition-opacity ease-out',
        phase === 'leave' && 'pointer-events-none opacity-0',
      )}
      style={{ transitionDuration: `${FADE_MS}ms` }}
    >
      <div className="flex w-full max-w-[480px] flex-col items-center justify-center bg-gradient-to-b from-canvas via-pink-soft to-canvas pb-[8dvh]">
        <RunningDog size={168} />
        {/* 글꼴을 받기 전에도 같은 모양으로 보이게 글자 그림을 쓴다 */}
        <img src={wordmark} alt="" className="mt-1 w-[15rem] animate-rise-in" />
      </div>
    </div>
  )
}
