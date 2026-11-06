import { useState } from 'react'
import { Link } from 'react-router'
import type { PetModelAttempt, PetModelStatus } from '../../apis/dto/admin.dto'
import { Badge } from '../../components/Badge/Badge'
import { Button } from '../../components/Button/Button'
import { StateView } from '../../components/StateView/StateView'
import { cn } from '../../components/utils/cn'
import { FIT_LEVEL_LABEL, MODEL_STATUS_LABEL } from '../../constants/admin'
import { TEMPLATE_LABEL } from '../../constants/pet'
import { AdminForbidden, AdminPageHeader, ModelStatusBadge, UsageMeter } from '../../features/admin/components/AdminCommon'
import { isForbidden } from '../../features/admin/errors'
import { useModelAttempts } from '../../features/admin/queries'
import { PetPhoto } from '../../features/pet/components/PetPhoto'
import { useNow } from '../../hooks/useNow'
import { attemptDuration, formatDateTime, formatUsd } from '../../utils/admin'
import { formatWeight, toWithersCm } from '../../utils/pet'

const TABS: (PetModelStatus | 'ALL')[] = ['ALL', 'PENDING', 'DONE', 'PHOTO_REJECTED', 'UNSUITABLE', 'FAILED']

/** 14 · 생성 기록 (최근 100건). 상태별 개수도 이 100건에서 센다 */
export function AdminAttemptsPage() {
  const [tab, setTab] = useState<PetModelStatus | 'ALL'>('ALL')
  const attempts = useModelAttempts()
  const items = attempts.data?.items ?? []
  const hasPending = items.some((item) => item.status === 'PENDING')
  // 만드는 중 기록의 '지난 시간'을 1초마다 다시 그린다
  const now = useNow(1000, hasPending)

  if (isForbidden(attempts.error)) return <AdminForbidden />

  const countOf = (key: PetModelStatus | 'ALL') =>
    key === 'ALL' ? items.length : items.filter((item) => item.status === key).length
  const visible = tab === 'ALL' ? items : items.filter((item) => item.status === tab)

  return (
    <div className="flex flex-col gap-5">
      <AdminPageHeader
        title="생성 기록"
        description="최근 100건이에요. 만드는 중인 기록은 5초마다 새로 고쳐요."
        aside={
          attempts.data && (
            <UsageMeter
              todayCount={attempts.data.todayCount}
              dailyLimit={attempts.data.dailyLimit}
              label="오늘 생성 시도 (한국 날짜)"
            />
          )
        }
      />

      <div role="tablist" aria-label="상태로 거르기" className="flex flex-wrap gap-1.5">
        {TABS.map((key) => {
          const selected = tab === key
          return (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls="attempts-table"
              onClick={() => setTab(key)}
              className={cn(
                'h-9.5 rounded-full border px-3.5 text-body font-medium',
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
                selected ? 'border-ink bg-ink text-white' : 'border-line bg-surface text-ink-secondary',
              )}
            >
              {key === 'ALL' ? '전체' : MODEL_STATUS_LABEL[key]}{' '}
              <span className="font-mono">{attempts.data ? countOf(key) : '–'}</span>
            </button>
          )
        })}
      </div>

      {attempts.isError ? (
        <StateView
          tone="error"
          title="생성 기록을 불러오지 못했어요"
          description="잠시 후 다시 시도해 주세요."
          action={
            <Button variant="outline" size="md" onClick={() => attempts.refetch()}>
              다시 시도
            </Button>
          }
        />
      ) : attempts.data && visible.length === 0 ? (
        <StateView title={tab === 'ALL' ? '아직 생성 기록이 없어요' : '이 상태의 기록이 없어요'} />
      ) : (
        <div id="attempts-table" role="tabpanel" className="relative overflow-x-auto rounded-card border border-line bg-surface">
          <table className="w-full min-w-[980px] border-collapse text-body">
            <thead>
              <tr className="text-left text-label text-ink-tertiary">
                {['요청 시각', '동물', '상태', '적합도', '결과', '걸린 시간', '비용'].map((heading) => (
                  <th key={heading} scope="col" className="border-b border-line-subtle px-4 py-3 font-medium">
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {attempts.isPending
                ? Array.from({ length: 6 }, (_, index) => (
                    <tr key={index} aria-hidden>
                      <td colSpan={7} className="border-b border-line-subtle px-4 py-3">
                        <div className="h-10 rounded skeleton" />
                      </td>
                    </tr>
                  ))
                : visible.map((attempt) => <AttemptRow key={attempt.id} attempt={attempt} now={now} />)}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

const CELL = 'border-b border-line-subtle px-4 py-3'

/** 결과 칸: 상태마다 사람이 읽을 한 줄 */
const resultOf = (attempt: PetModelAttempt) => {
  switch (attempt.status) {
    case 'PENDING':
      return `만드는 중 · 작업 ${attempt.jobId}`
    case 'DONE': {
      const template = attempt.template ? (TEMPLATE_LABEL[attempt.template] ?? attempt.template) : '템플릿 미상'
      return attempt.withersM !== null ? `${template} · 체고 ${toWithersCm(attempt.withersM)}cm` : template
    }
    case 'PHOTO_REJECTED':
      return attempt.reasons?.join(' · ') || '사진이 거부됐어요'
    case 'UNSUITABLE':
      return `${attempt.reasons?.join(' · ') || '체형이 템플릿과 달라요'} · force로 다시 만들 수 있어요`
    case 'FAILED':
      return `${attempt.error ?? '만들지 못했어요'} · 다시 시도해 주세요`
  }
}

function AttemptRow({ attempt, now }: { attempt: PetModelAttempt; now: number }) {
  const weight = formatWeight(attempt.weightKg)
  const pending = attempt.status === 'PENDING'

  return (
    <tr className="align-top">
      <td className={cn(CELL, 'whitespace-nowrap')}>
        <span className="font-mono">{formatDateTime(attempt.createdAt)}</span>
      </td>
      <td className={CELL}>
        <Link to={`/admin/pets/${attempt.petId}/model`} className="flex items-center gap-2.5">
          <PetPhoto
            src={attempt.photoUrl || null}
            alt={`동물 #${attempt.petId} 사진`}
            showPlaceholderLabel={false}
            className="size-10 shrink-0 rounded-chip"
          />
          <span>
            <span className="block font-semibold">
              동물 <span className="font-mono">#{attempt.petId}</span>
            </span>
            {weight && <span className="block font-mono text-caption text-ink-caption">{weight}</span>}
          </span>
        </Link>
      </td>
      <td className={CELL}>
        <ModelStatusBadge status={attempt.status} />
      </td>
      <td className={CELL}>
        {attempt.fitLevel ? (
          <span>
            {FIT_LEVEL_LABEL[attempt.fitLevel]} {attempt.fitScore ?? ''}
          </span>
        ) : (
          '-'
        )}
        {attempt.forced && (
          <Badge tone="warning" size="sm" className="ml-1.5">
            force
          </Badge>
        )}
      </td>
      <td className={cn(CELL, 'max-w-80 text-label text-ink-secondary')}>{resultOf(attempt)}</td>
      <td className={cn(CELL, 'whitespace-nowrap')}>
        <span className="font-mono">{attemptDuration(attempt.createdAt, attempt.finishedAt, now)}</span>
        {pending && ' 지남'}
      </td>
      <td className={cn(CELL, 'whitespace-nowrap')}>
        <span className="font-mono">{formatUsd(attempt.costUsd)}</span>
      </td>
    </tr>
  )
}
