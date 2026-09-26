import type { HTMLAttributes } from 'react'
import { cn } from '../utils/cn'

export type BadgeColor =
  | 'primary'
  | 'rose'
  | 'success'
  | 'warning'
  | 'neutral'
  | 'info'
  | 'violet'
export type BadgeVariant = 'filled' | 'outlined'
export type BadgeSize = 'lg' | 'md' | 'sm'

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  color?: BadgeColor
  variant?: BadgeVariant
  size?: BadgeSize
}

const sizeClasses: Record<BadgeSize, string> = {
  lg: 'px-[12px] py-[6px] text-[12px]',
  md: 'px-[10px] py-[4px] text-[10px]',
  sm: 'px-[8px] py-[2px] text-[9px]',
}

const darkTextColors: BadgeColor[] = ['warning']

const filledBg: Record<BadgeColor, string> = {
  primary: 'bg-primary-500',
  rose: 'bg-rose-500',
  success: 'bg-success-500',
  warning: 'bg-warning-500',
  neutral: 'bg-base-500',
  info: 'bg-info-500',
  violet: 'bg-violet-500',
}

const outlinedColors: Record<BadgeColor, string> = {
  primary: 'bg-primary-50 border border-primary-500 text-primary-500',
  rose: 'bg-rose-50 border border-rose-500 text-rose-500',
  success: 'bg-success-50 border border-success-500 text-success-500',
  warning: 'bg-warning-50 border border-warning-500 text-warning-500',
  neutral: 'bg-base-50 border border-base-500 text-base-500',
  info: 'bg-info-50 border border-info-500 text-info-500',
  violet: 'bg-violet-50 border border-violet-500 text-violet-500',
}

export function Badge({
  color = 'primary',
  variant = 'filled',
  size = 'md',
  className,
  children,
  ...props
}: BadgeProps) {
  const colorClass =
    variant === 'filled'
      ? cn(filledBg[color], darkTextColors.includes(color) ? 'text-warning-950' : 'text-white')
      : outlinedColors[color]

  return (
    <span
      className={cn(
        'inline-flex items-center justify-center rounded-full font-[Geist] font-bold tracking-[0.5px] whitespace-nowrap',
        sizeClasses[size],
        colorClass,
        className,
      )}
      {...props}
    >
      {children}
    </span>
  )
}
