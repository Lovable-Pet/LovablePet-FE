import { cn } from '../utils/cn'

/**
 * ghost: 헤더 아이콘 (배경 없음)
 * floating: 사진 위 흰 원 (뒤로, 공유, 찜)
 * outline: 흰 바탕 + 선 (찜 취소, 상세 하단 찜)
 */
export type IconButtonVariant = 'ghost' | 'floating' | 'outline'

/** sm 40 (카드 위 찜) / md 44 (최소 터치 영역) / lg 52 (주 버튼 옆) */
export type IconButtonSize = 'sm' | 'md' | 'lg'

const variantClasses: Record<IconButtonVariant, string> = {
  ghost: 'rounded-input bg-transparent',
  floating: 'rounded-full bg-white/92',
  outline: 'border border-line bg-surface',
}

const sizeClasses: Record<IconButtonSize, string> = {
  sm: 'size-10',
  md: 'size-11',
  lg: 'size-13',
}

export interface IconButtonStyleOptions {
  variant?: IconButtonVariant
  size?: IconButtonSize
  /**
   * 아이콘 색 클래스 (기본 text-ink).
   * cn은 클래스를 합치지 않으므로 색은 className이 아니라 여기로 넘긴다
   */
  color?: string
  className?: string
}

/** <IconButton>과 아이콘 링크(<Link>)가 같은 모양을 쓰도록 클래스만 만든다 */
export const iconButtonStyles = ({
  variant = 'ghost',
  size = 'md',
  color = 'text-ink',
  className,
}: IconButtonStyleOptions = {}) =>
  cn(
    'inline-flex shrink-0 items-center justify-center',
    color,
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
    'disabled:pointer-events-none disabled:opacity-45',
    variantClasses[variant],
    sizeClasses[size],
    // outline은 크기마다 둥글기가 다르다 (44 → 12, 52 → 14)
    variant === 'outline' && (size === 'lg' ? 'rounded-button' : 'rounded-input'),
    className,
  )
