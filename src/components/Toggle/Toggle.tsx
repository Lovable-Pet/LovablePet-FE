import type { ButtonHTMLAttributes } from 'react'
import { cn } from '../utils/cn'

export interface ToggleProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onChange'> {
  checked: boolean
  onChange: (checked: boolean) => void
}

export function Toggle({ checked, onChange, disabled, className, ...props }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'inline-flex h-[24px] w-[44px] shrink-0 items-center rounded-full p-[2px] transition-colors',
        checked ? 'bg-primary-500' : 'bg-base-200',
        disabled && 'opacity-45 pointer-events-none',
        className,
      )}
      {...props}
    >
      <span
        className={cn(
          'block size-[20px] rounded-full bg-white shadow-sm transition-transform',
          checked ? 'translate-x-[20px]' : 'translate-x-0',
        )}
      />
    </button>
  )
}
