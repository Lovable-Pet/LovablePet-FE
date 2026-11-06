import type { ButtonHTMLAttributes } from 'react'
import { cn } from '../utils/cn'

/**
 * filter: 필터 알약 (선택 시 진한 면)
 * accent: AR 토글처럼 켜짐을 주황으로 보여주는 칩
 */
export type ChipVariant = 'filter' | 'accent'

/** md 40 알약 / sm 30 작은 칩 (적용된 필터 표시, 터치 영역은 44로 넓힌다) */
export type ChipSize = 'md' | 'sm'

export interface ChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ChipVariant
  size?: ChipSize
  /** 켜고 끄는 칩이면 넘긴다 (aria-pressed). 안 넘기면 일반 버튼 */
  selected?: boolean
  /** 옆에 붙는 마릿수 (모노 숫자) */
  count?: number
}

const sizeClasses: Record<ChipSize, string> = {
  md: 'h-10 gap-1.5 rounded-full px-3.5 text-body',
  sm: 'h-7.5 gap-1 rounded-chip px-2.5 text-label touch-target',
}

const selectedClasses: Record<ChipVariant, string> = {
  filter: 'border-ink bg-ink text-white font-medium hover:bg-ink-hover',
  accent: 'border-accent-line bg-accent-soft text-accent-ink font-semibold hover:bg-accent-soft-hover',
}

const unselectedClasses: Record<ChipVariant, string> = {
  filter: 'border-line bg-surface text-ink-secondary font-medium hover:bg-surface-hover',
  accent: 'border-line bg-surface text-ink-secondary font-semibold hover:bg-surface-hover',
}

export function Chip({
  variant = 'filter',
  size = 'md',
  selected,
  count,
  type = 'button',
  className,
  children,
  ...props
}: ChipProps) {
  return (
    <button
      type={type}
      aria-pressed={selected}
      className={cn(
        'inline-flex shrink-0 items-center border whitespace-nowrap transition active:scale-99',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
        'disabled:pointer-events-none disabled:opacity-45',
        sizeClasses[size],
        selected ? selectedClasses[variant] : unselectedClasses[variant],
        className,
      )}
      {...props}
    >
      {children}
      {count !== undefined && (
        <span className="font-mono text-caption opacity-75">{count.toLocaleString()}</span>
      )}
    </button>
  )
}
