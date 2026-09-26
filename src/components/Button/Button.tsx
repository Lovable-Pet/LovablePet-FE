import type { ButtonHTMLAttributes } from 'react'
import { cn } from '../utils/cn'

export type ButtonColor = 'primary' | 'secondary' | 'neutral' | 'danger'
export type ButtonVariant = 'solid' | 'outline' | 'ghost'
export type ButtonSize = 'lg' | 'md' | 'sm'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  color?: ButtonColor
  variant?: ButtonVariant
  size?: ButtonSize
}

const sizeClasses: Record<ButtonSize, string> = {
  lg: 'h-[44px] px-[22px] py-[12px] text-[14px]',
  md: 'h-[38px] px-[16px] py-[10px] text-[13px]',
  sm: 'h-[32px] px-[12px] py-[8px] text-[11px]',
}

const colorClasses: Record<ButtonColor, Record<ButtonVariant, string>> = {
  primary: {
    solid: 'bg-primary-500 text-white',
    outline: 'bg-white border-[1.5px] border-primary-500 text-primary-500',
    ghost: 'bg-transparent text-primary-500',
  },
  secondary: {
    solid: 'bg-base-800 text-white',
    outline: 'bg-white border-[1.5px] border-base-800 text-base-800',
    ghost: 'bg-transparent text-base-800',
  },
  neutral: {
    solid: 'bg-neutral-50 border-[1.5px] border-neutral-200 text-neutral-500',
    outline: 'bg-white border-[1.5px] border-neutral-200 text-neutral-500',
    ghost: 'bg-transparent text-neutral-500',
  },
  danger: {
    solid: 'bg-danger-400 text-white',
    outline: 'bg-white border-[1.5px] border-danger-400 text-danger-400',
    ghost: 'bg-transparent text-danger-400',
  },
}

export function Button({
  color = 'primary',
  variant = 'solid',
  size = 'md',
  disabled,
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      className={cn(
        'inline-flex items-center justify-center rounded-lg font-[Sora] font-bold tracking-[0.5px] transition-opacity',
        sizeClasses[size],
        colorClasses[color][variant],
        disabled && 'opacity-45 pointer-events-none',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
}
