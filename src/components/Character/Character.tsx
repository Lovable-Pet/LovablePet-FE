import type { CSSProperties } from 'react'
import celebrating from '../../assets/characters/dog-celebrating.webp'
import confused from '../../assets/characters/dog-confused.webp'
import happy from '../../assets/characters/dog-happy.webp'
import love from '../../assets/characters/dog-love.webp'
import measuring from '../../assets/characters/dog-measuring.webp'
import oops from '../../assets/characters/dog-oops.webp'
import peeking from '../../assets/characters/dog-peeking.webp'
import runSprite from '../../assets/characters/dog-run-sprite.webp'
import searching from '../../assets/characters/dog-searching.webp'
import sitting from '../../assets/characters/dog-sitting.webp'
import sleeping from '../../assets/characters/dog-sleeping.webp'
import { cn } from '../utils/cn'

export type CharacterName =
  | 'sleeping'
  | 'happy'
  | 'peeking'
  | 'sitting'
  | 'love'
  | 'celebrating'
  | 'confused'
  | 'oops'
  | 'searching'
  | 'measuring'

/** 그림마다 어울리는 움직임. 그림은 한 장이고 CSS 로 숨쉬기·통통 뛰기·갸웃을 준다 */
const CHARACTERS: Record<CharacterName, { src: string; motion: string; origin: string }> = {
  sleeping: { src: sleeping, motion: 'animate-breathe', origin: 'origin-bottom' },
  happy: { src: happy, motion: 'animate-bob', origin: 'origin-bottom' },
  peeking: { src: peeking, motion: 'animate-peek', origin: 'origin-bottom' },
  sitting: { src: sitting, motion: 'animate-wag', origin: 'origin-bottom' },
  love: { src: love, motion: 'animate-bob', origin: 'origin-bottom' },
  celebrating: { src: celebrating, motion: 'animate-bob', origin: 'origin-bottom' },
  confused: { src: confused, motion: 'animate-wag', origin: 'origin-bottom' },
  oops: { src: oops, motion: 'animate-wag', origin: 'origin-bottom' },
  searching: { src: searching, motion: 'animate-wag', origin: 'origin-bottom' },
  measuring: { src: measuring, motion: 'animate-breathe', origin: 'origin-bottom' },
}

interface CharacterProps {
  name: CharacterName
  /** 한 변 길이(px) */
  size?: number
  className?: string
}

/** 움직이는 강아지 캐릭터 (꾸밈 그림이라 읽어 주지 않는다) */
export function Character({ name, size = 120, className }: CharacterProps) {
  const { src, motion, origin } = CHARACTERS[name]
  return (
    <span aria-hidden className={cn('relative inline-block shrink-0', className)} style={{ width: size, height: size }}>
      <img src={src} alt="" draggable={false} className={cn('size-full object-contain select-none', motion, origin)} />
    </span>
  )
}

/** 달리는 강아지 (8칸 스프라이트). 불러오는 중에 쓴다 */
export function RunningDog({ size = 96, className }: { size?: number; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn('dog-run inline-block shrink-0', className)}
      style={
        {
          '--dog-size': `${size}px`,
          width: size,
          height: size,
          backgroundImage: `url(${runSprite})`,
          backgroundSize: `${size * 8}px ${size}px`,
        } as CSSProperties
      }
    />
  )
}
