import type { ButtonHTMLAttributes } from 'react'
import { cn } from '../utils/cn'

export type ChipColor =
  | 'primary'
  | 'rose'
  | 'success'
  | 'warning'
  | 'neutral'
  | 'info'
  | 'violet'
export type ChipVariant = 'filled' | 'outlined'
export type ChipSize = 'lg' | 'md' | 'sm'

export interface ChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  color?: ChipColor
  variant?: ChipVariant
  size?: ChipSize
  selected?: boolean
  onDismiss?: () => void
}

const sizeClasses: Record<ChipSize, string> = {
  lg: 'px-[14px] py-[8px] text-[13px]',
  md: 'px-[12px] py-[6px] text-[11px]',
  sm: 'px-[10px] py-[4px] text-[10px]',
}

const darkTextColors: ChipColor[] = ['warning']

const filledBg: Record<ChipColor, string> = {
  primary: 'bg-primary-500',
  rose: 'bg-rose-500',
  success: 'bg-success-500',
  warning: 'bg-warning-500',
  neutral: 'bg-base-500',
  info: 'bg-info-500',
  violet: 'bg-violet-500',
}

const outlinedColors: Record<ChipColor, string> = {
  primary: 'bg-primary-50 border border-primary-500 text-primary-500',
  rose: 'bg-rose-50 border border-rose-500 text-rose-500',
  success: 'bg-success-50 border border-success-500 text-success-500',
  warning: 'bg-warning-50 border border-warning-500 text-warning-500',
  neutral: 'bg-base-50 border border-base-500 text-base-500',
  info: 'bg-info-50 border border-info-500 text-info-500',
  violet: 'bg-violet-50 border border-violet-500 text-violet-500',
}

const unselectedClass = 'bg-white border border-base-200 text-base-600'

export function Chip({
  color = 'primary',
  variant = 'filled',
  size = 'md',
  selected,
  onDismiss,
  className,
  children,
  ...props
}: ChipProps) {
  const colorClass =
    selected === false
      ? unselectedClass
      : variant === 'filled'
        ? cn(filledBg[color], darkTextColors.includes(color) ? 'text-warning-950' : 'text-white')
        : outlinedColors[color]

  return (
    <button
      type="button"
      className={cn(
        'inline-flex items-center justify-center gap-[6px] rounded-full font-[Sora] font-semibold whitespace-nowrap',
        sizeClasses[size],
        colorClass,
        className,
      )}
      {...props}
    >
      {children}
      {onDismiss && (
        <span
          role="button"
          aria-label="remove"
          onClick={(e) => {
            e.stopPropagation()
            onDismiss()
          }}
          className="inline-flex size-[10px] items-center justify-center rounded-full bg-black/15"
        >
          ×
        </span>
      )}
    </button>
  )
}
