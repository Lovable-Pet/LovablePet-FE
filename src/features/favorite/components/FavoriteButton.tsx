import { useState, type CSSProperties } from 'react'
import { Heart, PawPrint } from 'lucide-react'
import { cn } from '../../../components/utils/cn'
import { useToggleFavorite } from '../useToggleFavorite'

/** 하트 둘레로 튀는 점 (각도, 색) */
const SPARKS = [
  { angle: 0, color: 'bg-primary' },
  { angle: 60, color: 'bg-apricot' },
  { angle: 120, color: 'bg-pink' },
  { angle: 180, color: 'bg-primary' },
  { angle: 240, color: 'bg-apricot' },
  { angle: 300, color: 'bg-pink' },
]

interface FavoriteButtonProps {
  petId: number
  favorited: boolean
  /** 읽어 줄 이름 (예: 믹스견) */
  name: string
  /** 사진 위에 놓일 때: 꺼진 하트를 흰색으로 그린다 */
  onPhoto?: boolean
  className?: string
}

/**
 * 찜 하트. 찜하면 강아지 발바닥이 톡 찍혔다가 하트로 바뀌고 점들이 퍼진다.
 * 찜을 풀 때와 처음 그릴 때는 움직이지 않는다. 로그인하지 않았으면 로그인 화면으로 간다
 */
export function FavoriteButton({ petId, favorited, name, onPhoto = false, className }: FavoriteButtonProps) {
  const { toggle } = useToggleFavorite()
  // 방금 찜을 눌렀을 때만 켠다 (하트 애니메이션이 끝나면 끈다)
  const [celebrating, setCelebrating] = useState(false)
  const playing = celebrating && favorited

  return (
    <button
      type="button"
      aria-pressed={favorited}
      aria-label={`${name} 찜하기`}
      onClick={(event) => {
        // 카드 링크 안에 있어도 화면이 넘어가지 않게
        event.preventDefault()
        event.stopPropagation()
        setCelebrating(!favorited)
        toggle(petId, !favorited)
      }}
      className={cn(
        'flex size-11 shrink-0 items-center justify-center rounded-full transition-[scale] duration-150 active:scale-[0.96]',
        className,
      )}
    >
      {/* 발바닥·점의 기준 상자. 버튼 자체에 relative 를 주면 카드에서 주는 absolute 위치와 부딪힌다 */}
      <span className="relative flex size-full items-center justify-center">
      <Heart
        aria-hidden
        strokeWidth={2}
        onAnimationEnd={() => setCelebrating(false)}
        className={cn(
          'size-6',
          favorited ? 'fill-primary text-primary' : onPhoto ? 'fill-black/15 text-white' : 'fill-transparent text-ink',
          playing && 'animate-heart-in',
        )}
      />
      {playing && (
        <span aria-hidden className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <PawPrint className="size-7 animate-paw-pop fill-apricot text-apricot drop-shadow-[0_1px_2px_rgb(0_0_0/0.25)]" strokeWidth={1.5} />
          {SPARKS.map(({ angle, color }) => (
            <span
              key={angle}
              className="absolute top-1/2 left-1/2 -mt-[3px] -ml-[3px]"
              style={{ rotate: `${angle}deg` }}
            >
              <span className={cn('block size-1.5 animate-spark rounded-full', color)} style={{ '--spark-distance': '-20px' } as CSSProperties} />
            </span>
          ))}
        </span>
      )}
      </span>
    </button>
  )
}
