import { useState } from 'react'
import { Link } from 'react-router'
import type { PetModelAttempt, PetModelStatus } from '../../apis/dto/admin.dto'
import { Badge } from '../../components/Badge/Badge'
import { Button } from '../../components/Button/Button'
import { Chip } from '../../components/Chip/Chip'
import { PawDots } from '../../components/LoadingScreen/LoadingScreen'
import { StateView } from '../../components/StateView/StateView'
import { FIT_LEVEL_LABEL, MODEL_STATUS_LABEL } from '../../constants/admin'
import { TEMPLATE_LABEL } from '../../constants/pet'
import { ForbiddenView, StatusBadge, UsageMeter } from '../../features/admin/components/AdminCommon'
import { isForbidden } from '../../features/admin/errors'
import { useModelAttempts } from '../../features/admin/queries'
import { PetPhoto } from '../../features/pet/components/PetPhoto'
import { useNow } from '../../hooks/useNow'
import { attemptDuration, formatDateTime, formatUsd } from '../../utils/admin'
import { toWithersCm } from '../../utils/pet'

const STATUSES = Object.keys(MODEL_STATUS_LABEL) as PetModelStatus[]

// /admin/models — 최근 생성 시도 100건과 오늘 사용량
export function AdminAttemptsPage() {
  const { data, isPending, isError, error, refetch } = useModelAttempts()
  const [filter, setFilter] = useState<PetModelStatus | null>(null)
  const hasPending = data?.items.some((item) => item.status === 'PENDING') ?? false
  const now = useNow(1000, hasPending)

  if (isForbidden(error)) return <ForbiddenView />
  if (isPending) {
    return (
      <div className="flex justify-center py-20">
        <PawDots label="생성 기록을 불러오는 중" />
      </div>
    )
  }
  if (isError) {
    return (
      <StateView
        tone="error"
        title="생성 기록을 불러오지 못했어요"
        action={
          <Button variant="outline" onClick={() => refetch()}>
            다시 시도
          </Button>
        }
      />
    )
  }

  const countOf = (status: PetModelStatus) => data.items.filter((item) => item.status === status).length
  const visible = filter ? data.items.filter((item) => item.status === filter) : data.items
  const totalCost = data.items.reduce((sum, item) => sum + (item.costUsd ?? 0), 0)

  return (
    <main>
      <h1 className="font-display text-title">생성 기록</h1>
      <p className="mt-1 text-body text-ink-soft">
        최근 {data.items.length}건, 쓴 비용 <span className="font-bold tabular-nums">{formatUsd(totalCost)}</span>
      </p>

      <div className="mt-5">
        <UsageMeter todayCount={data.todayCount} dailyLimit={data.dailyLimit} />
      </div>

      <div role="group" aria-label="상태로 걸러 보기" className="no-scrollbar -mx-4 mt-3.5 flex scroll-px-4 gap-2 overflow-x-auto px-4 py-1.5 sm:flex-wrap">
        <Chip selected={filter === null} onClick={() => setFilter(null)}>
          전체 <span className="font-normal tabular-nums opacity-70">{data.items.length}</span>
        </Chip>
        {STATUSES.map((status) => (
          <Chip key={status} selected={filter === status} onClick={() => setFilter(filter === status ? null : status)}>
            {MODEL_STATUS_LABEL[status]} <span className="font-normal tabular-nums opacity-70">{countOf(status)}</span>
          </Chip>
        ))}
      </div>

      {visible.length === 0 ? (
        <StateView
          title={filter ? `${MODEL_STATUS_LABEL[filter]} 기록이 없어요` : '아직 만든 기록이 없어요'}
          description={filter ? undefined : '유기견 목록에서 AR 모델을 만들어 보세요.'}
        />
      ) : (
        <ul className="mt-4 flex flex-col gap-3">
          {visible.map((attempt) => (
            <li key={attempt.id}>
              <AttemptRow attempt={attempt} now={now} />
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}

function AttemptRow({ attempt, now }: { attempt: PetModelAttempt; now: number }) {
  const notes = [...(attempt.reasons ?? []), ...(attempt.error ? [attempt.error] : [])]
  return (
    <article className="rounded-card bg-surface p-3 shadow-soft">
      <div className="flex gap-3">
        <PetPhoto src={attempt.photoUrl} alt={`${attempt.petId}번 유기견의 고른 사진`} seed={attempt.petId} className="size-16 shrink-0 rounded-tile" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <StatusBadge status={attempt.status} />
            {attempt.forced && <Badge tone="warning">강제 생성</Badge>}
            <Link to={`/admin/pets/${attempt.petId}/model`} className="-my-2 ml-auto py-2 text-label font-bold text-primary-deep underline underline-offset-4">
              {attempt.petId}번 유기견
            </Link>
          </div>
          <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-label sm:grid-cols-4">
            <Cell label="요청">{formatDateTime(attempt.createdAt)}</Cell>
            <Cell label={attempt.finishedAt ? '걸린 시간' : '지난 시간'}>
              {attemptDuration(attempt.createdAt, attempt.finishedAt, now)}
            </Cell>
            <Cell label="비용">{formatUsd(attempt.costUsd)}</Cell>
            <Cell label="적합도">
              {attempt.fitLevel ? `${FIT_LEVEL_LABEL[attempt.fitLevel]}${attempt.fitScore !== null ? ` ${attempt.fitScore}점` : ''}` : '-'}
            </Cell>
            <Cell label="체형">{attempt.template ? (TEMPLATE_LABEL[attempt.template] ?? attempt.template) : '-'}</Cell>
            <Cell label="어깨 높이">{attempt.withersM !== null ? `${toWithersCm(attempt.withersM)}cm` : '-'}</Cell>
            <Cell label="체중">{attempt.weightKg}kg</Cell>
          </dl>
        </div>
      </div>
      {notes.length > 0 && (
        <ul className="mt-3 list-disc rounded-tile bg-pink-soft py-2.5 pr-3 pl-7 text-label text-pink-deep">
          {notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      )}
    </article>
  )
}

function Cell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <dt className="shrink-0 text-caption text-ink-mute">{label}</dt>
      <dd className="truncate font-bold tabular-nums">{children}</dd>
    </div>
  )
}
