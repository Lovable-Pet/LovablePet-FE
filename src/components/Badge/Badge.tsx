import type { HTMLAttributes } from 'react'
import { cn } from '../utils/cn'

export type BadgeTone =
  | 'measure' // AR로 보기, 관리자 (노랑 + 진한 글자)
  | 'dark' // 기다린 지 N일
  | 'closed' // 입양 완료
  | 'success' // 입양 가능, 완성
  | 'info' // 만드는 중
  | 'danger' // 사진 거부, 실패
  | 'warning' // 체형 부적합
  | 'neutral' // 공고번호 등

/** sm 24 / md 26 */
export type BadgeSize = 'sm' | 'md'

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone
  size?: BadgeSize
}

const toneClasses: Record<BadgeTone, string> = {
  measure: 'bg-measure text-ink font-bold',
  dark: 'bg-ink text-white font-semibold',
  closed: 'bg-ink-secondary text-white font-semibold',
  success: 'bg-success-soft text-success-ink font-semibold',
  info: 'bg-info-soft text-info-ink font-semibold',
  danger: 'bg-danger-soft text-danger-ink font-semibold',
  warning: 'bg-warning-soft text-warning-ink font-semibold',
  neutral: 'bg-muted text-ink-tertiary font-medium',
}

const sizeClasses: Record<BadgeSize, string> = {
  sm: 'h-6',
  md: 'h-6.5',
}

export function Badge({ tone = 'neutral', size = 'md', className, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-badge px-2 text-caption whitespace-nowrap',
        sizeClasses[size],
        toneClasses[tone],
        className,
      )}
      {...props}
    />
  )
}
