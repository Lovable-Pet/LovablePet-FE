import type { ButtonHTMLAttributes } from 'react'
import { cn } from '../utils/cn'

export interface ToggleProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onChange'> {
  checked: boolean
  onChange: (checked: boolean) => void
}

/** 52×32 스위치. 화면에 보이는 이름이 없으면 aria-label을 꼭 넘긴다 */
export function Toggle({ checked, onChange, className, ...props }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        'inline-flex h-8 w-13 shrink-0 items-center rounded-full p-[3px] transition-colors',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
        'disabled:pointer-events-none disabled:opacity-45',
        checked ? 'bg-accent' : 'bg-line-strong',
        className,
      )}
      {...props}
    >
      <span
        className={cn(
          'block size-6.5 rounded-full bg-white shadow-knob transition-transform',
          checked ? 'translate-x-5' : 'translate-x-0',
        )}
      />
    </button>
  )
}
