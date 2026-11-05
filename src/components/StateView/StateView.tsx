import type { ReactNode } from 'react'
import { cn } from '../utils/cn'

export interface StateViewProps {
  title: string
  description?: ReactNode
  /** 버튼 등 (예: 다시 시도, 필터 초기화) */
  action?: ReactNode
  /** 오류면 role="alert"로 읽힌다 */
  tone?: 'empty' | 'error'
  className?: string
}

/** 빈 목록·오류 안내. 캔버스의 '아직 찜한 아이가 없어요' 카드와 같은 톤 */
export function StateView({ title, description, action, tone = 'empty', className }: StateViewProps) {
  return (
    <div
      role={tone === 'error' ? 'alert' : undefined}
      className={cn('rounded-card-lg bg-surface px-6 py-12 text-center', className)}
    >
      <p className="text-emphasis font-semibold">{title}</p>
      {description && <p className="mt-1.5 text-body text-ink-tertiary">{description}</p>}
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  )
}
