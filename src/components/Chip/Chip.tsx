import type { ButtonHTMLAttributes } from 'react'
import { cn } from '../utils/cn'

interface ChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  selected?: boolean
  /** 고르면 칠해지는 색 */
  tone?: 'lilac' | 'sky'
}

/** 켜고 끄는 알약 버튼 (필터 조건 등) */
export function Chip({ selected = false, tone = 'lilac', className, type = 'button', ...rest }: ChipProps) {
  return (
    <button
      type={type}
      aria-pressed={selected}
      className={cn(
        'inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full px-4 text-label font-bold whitespace-nowrap',
        'transition-[background-color,box-shadow,scale] duration-150 active:scale-[0.96]',
        selected
          ? tone === 'sky'
            ? 'bg-sky text-ink'
            : 'bg-primary text-white shadow-[0_4px_12px_rgb(255_113_133/0.35)]'
          : 'bg-surface text-ink shadow-soft',
        className,
      )}
      {...rest}
    />
  )
}
