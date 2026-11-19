import { cn } from '../utils/cn'

export type ButtonVariant = 'primary' | 'sky' | 'soft' | 'outline' | 'ghost' | 'danger'
export type ButtonSize = 'sm' | 'md' | 'lg'

const VARIANT: Record<ButtonVariant, string> = {
  primary: 'bg-primary text-white shadow-[0_6px_16px_rgb(255_113_133/0.35)] hover:bg-primary-strong',
  sky: 'bg-primary text-white shadow-[0_6px_16px_rgb(255_113_133/0.35)] hover:bg-primary-strong',
  soft: 'bg-pink-soft text-primary-deep hover:bg-pink',
  outline: 'bg-surface text-ink shadow-[inset_0_0_0_1.5px_var(--color-line)] hover:bg-pink-soft',
  ghost: 'text-ink-soft hover:bg-pink-soft',
  danger: 'bg-pink-soft text-pink-deep hover:bg-pink',
}

const SIZE: Record<ButtonSize, string> = {
  sm: 'h-9 gap-1.5 rounded-full px-3.5 text-label',
  md: 'h-11 gap-2 rounded-full px-5 text-body',
  lg: 'h-14 gap-2 rounded-full px-6 text-emphasis',
}

/** 링크(<Link>)에도 같은 모양을 입힐 때 쓴다 */
export const buttonClass = ({
  variant = 'primary',
  size = 'md',
  full = false,
  className,
}: { variant?: ButtonVariant; size?: ButtonSize; full?: boolean; className?: string } = {}) =>
  cn(
    'inline-flex items-center justify-center font-bold whitespace-nowrap select-none',
    'transition-[background-color,scale,opacity] duration-150 active:scale-[0.96]',
    'disabled:pointer-events-none disabled:opacity-45',
    VARIANT[variant],
    SIZE[size],
    // 가득 채우는 버튼은 옆 버튼이 있으면 남은 자리만큼 줄어든다
    full ? 'w-full min-w-0' : 'shrink-0',
    className,
  )
