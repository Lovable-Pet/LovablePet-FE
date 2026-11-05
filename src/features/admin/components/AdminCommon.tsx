import type { ReactNode } from 'react'
import { Link } from 'react-router'
import type { PetModelStatus } from '../../../apis/dto/admin.dto'
import { Badge } from '../../../components/Badge/Badge'
import { buttonStyles } from '../../../components/Button/buttonStyles'
import { StateView } from '../../../components/StateView/StateView'
import { MODEL_STATUS_LABEL, MODEL_STATUS_TONE } from '../../../constants/admin'

export function AdminForbidden() {
  return (
    <StateView
      tone="error"
      title="관리자만 볼 수 있어요"
      description="관리자 계정으로 다시 로그인해 주세요."
      action={
        <Link to="/" className={buttonStyles({ variant: 'dark', size: 'md' })}>
          앱으로 돌아가기
        </Link>
      }
      className="mx-auto max-w-md"
    />
  )
}

export interface UsageMeterProps {
  todayCount: number
  dailyLimit: number
  /** 제목 옆 설명 (예: 한국 날짜) */
  label?: string
  showRemaining?: boolean
}

/** 오늘 생성 시도 N / 한도 */
export function UsageMeter({ todayCount, dailyLimit, label = '오늘 생성 시도', showRemaining }: UsageMeterProps) {
  const remaining = Math.max(0, dailyLimit - todayCount)
  const ratio = dailyLimit > 0 ? Math.min(todayCount / dailyLimit, 1) : 1
  return (
    <div className="min-w-50 rounded-button border border-line bg-surface px-3.5 py-2.5">
      <p className="text-caption text-ink-caption">{label}</p>
      <p className="mt-0.5 mb-1.5 text-body-lg font-semibold">
        <span className="font-mono">{todayCount}</span> / <span className="font-mono">{dailyLimit}</span>회
        {showRemaining && (
          <span className="text-caption font-normal text-ink-caption">
            {' '}
            · {remaining === 0 ? '오늘 한도를 다 썼어요' : `${remaining}회 남음`}
          </span>
        )}
      </p>
      <div
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={dailyLimit}
        aria-valuenow={todayCount}
        className="h-1.5 overflow-hidden rounded-full bg-muted"
      >
        <div className={remaining === 0 ? 'h-full bg-danger' : 'h-full bg-accent'} style={{ width: `${ratio * 100}%` }} />
      </div>
    </div>
  )
}

export function ModelStatusBadge({ status }: { status: PetModelStatus }) {
  return <Badge tone={MODEL_STATUS_TONE[status]}>{MODEL_STATUS_LABEL[status]}</Badge>
}

/** 관리자 화면 제목 + 설명 + 오른쪽 카드들 */
export function AdminPageHeader({ title, description, aside }: { title: string; description: string; aside?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-display font-bold">{title}</h1>
        <p className="mt-1.5 text-body text-ink-tertiary">{description}</p>
      </div>
      {aside && <div className="flex flex-wrap items-stretch gap-3">{aside}</div>}
    </div>
  )
}
