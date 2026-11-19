import { ChevronRight, Heart, PawPrint } from 'lucide-react'
import { useNavigate } from 'react-router'
import { Button } from '../components/Button/Button'
import { Character } from '../components/Character/Character'
import { LogoStacked } from '../components/Logo/Logo'
import { markWelcomed } from '../features/welcome/welcomed'

/** 화면 곳곳에 흩어 놓는 발바닥 (위치 %, 크기 px, 기울기) */
const PAWS = [
  { left: '10%', top: '26%', size: 26, rotate: -18 },
  { left: '82%', top: '70%', size: 24, rotate: 14 },
  { left: '6%', top: '67%', size: 30, rotate: -8 },
  { left: '84%', top: '80%', size: 30, rotate: 22 },
  { left: '12%', top: '93%', size: 28, rotate: -20 },
]

// /welcome — 처음 들어왔을 때 한 번 보이는 시작 화면
export function WelcomePage() {
  const navigate = useNavigate()
  const start = () => {
    markWelcomed()
    navigate('/', { replace: true })
  }

  return (
    <main className="app-column relative flex flex-col items-center overflow-hidden bg-gradient-to-b from-canvas via-pink-soft to-canvas px-8 pt-[calc(48px+env(safe-area-inset-top))] pb-[calc(40px+env(safe-area-inset-bottom))]">
      {PAWS.map((paw, index) => (
        <PawPrint
          key={index}
          aria-hidden
          className="absolute animate-twinkle fill-apricot/70 text-transparent"
          style={{
            left: paw.left,
            top: paw.top,
            width: paw.size,
            height: paw.size,
            rotate: `${paw.rotate}deg`,
            animationDelay: `${index * 0.4}s`,
          }}
        />
      ))}
      <Heart aria-hidden className="absolute top-[30%] left-[8%] size-9 animate-bob fill-primary text-primary" />

      <div className="relative mt-[6dvh]">
        {/* 강아지가 엎드린 분홍 방석 */}
        <span aria-hidden className="absolute inset-x-[-8%] bottom-[6%] h-[34%] rounded-[50%] bg-pink/70" />
        <Character name="sleeping" size={260} className="relative" />
      </div>

      <LogoStacked className="mt-4 animate-rise-in" />
      <p className="mt-6 animate-rise-in text-center text-emphasis font-bold text-ink [animation-delay:120ms]">
        지금, 우리 집에
        <br />
        어울리는 유기견을 만나보세요!
      </p>

      <Button size="lg" full onClick={start} className="mt-auto max-w-[300px] animate-rise-in [animation-delay:240ms]">
        시작하기
        <ChevronRight className="size-5" strokeWidth={2.5} aria-hidden />
      </Button>
    </main>
  )
}
