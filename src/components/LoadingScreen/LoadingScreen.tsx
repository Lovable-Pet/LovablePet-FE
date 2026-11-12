import type { CSSProperties } from 'react'
import runSprite from '../../assets/characters/dog-run-sprite.webp'
import { cn } from '../utils/cn'

// 달리는 강아지 로딩. dog-run-sprite.webp 는 8프레임(한 칸 240px)을 가로로 붙인 한 장이라,
// CSS 로 칸을 넘겨 움직인다 (index.css 의 dog-run). 원본 프레임과 만든 과정: 피그마 "07 로딩 애니메이션" v2
const FRAMES = 8

export interface RunningDogProps {
  /** 한 변 크기 (px) */
  size?: number
  className?: string
}

/** 꾸밈용 그림이라 화면 읽기 도구는 건너뛴다. 동작 줄이기 설정이면 첫 장면에 멈춘다 */
export function RunningDog({ size = 120, className }: RunningDogProps) {
  return (
    <span
      aria-hidden
      className={cn('dog-run block shrink-0', className)}
      style={
        {
          '--dog-size': `${size}px`,
          width: size,
          height: size,
          backgroundImage: `url(${runSprite})`,
          backgroundSize: `${size * FRAMES}px ${size}px`,
        } as CSSProperties
      }
    />
  )
}

export interface LoadingScreenProps {
  /** 큰 글씨 (기본: 불러오는 중이에요) */
  title?: string
  /** 아래 작은 설명 */
  description?: string
  className?: string
}

/** 화면 전체를 기다릴 때 (화면 코드 받기, AR 공고 불러오기, 카카오 로그인 처리) */
export function LoadingScreen({ title = '불러오는 중이에요', description, className }: LoadingScreenProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'mx-auto flex min-h-dvh w-full max-w-[480px] flex-col items-center justify-center bg-canvas px-6 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] text-center',
        className,
      )}
    >
      <RunningDog size={120} />
      <p className="mt-2 text-emphasis font-semibold">{title}</p>
      {description && <p className="mt-1 text-body text-ink-tertiary">{description}</p>}
    </div>
  )
}
