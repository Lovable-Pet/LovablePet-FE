import type { ReactNode } from 'react'
import { cn } from '../utils/cn'

export type BadgeTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger'

const TONE: Record<BadgeTone, string> = {
  neutral: 'bg-pink-soft text-primary-deep',
  info: 'bg-sky-soft text-sky-deep',
  success: 'bg-mint-soft text-mint-deep',
  warning: 'bg-apricot-soft text-apricot-deep',
  danger: 'bg-pink-soft text-pink-deep',
}

/** 상태를 알리는 작은 딱지 */
export function Badge({ tone = 'neutral', className, children }: { tone?: BadgeTone; className?: string; children: ReactNode }) {
  return (
    <span
      className={cn(
        'inline-flex h-6 shrink-0 items-center gap-1 rounded-full px-2.5 text-caption font-bold whitespace-nowrap',
        TONE[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}
