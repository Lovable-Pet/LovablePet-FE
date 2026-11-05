import { useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import type { FitCheckResponse, PetModelAttempt } from '../../../apis/dto/admin.dto'
import type { PetDetail } from '../../../apis/dto/pet.dto'
import { Button } from '../../../components/Button/Button'
import { buttonStyles } from '../../../components/Button/buttonStyles'
import { cn } from '../../../components/utils/cn'
import { FIT_LEVEL_LABEL, MODEL_STATUS_LABEL, PHOTO_QUALITY_LABEL, PHOTO_REJECT_LABEL } from '../../../constants/admin'
import { TEMPLATE_LABEL } from '../../../constants/pet'
import { useNow } from '../../../hooks/useNow'
import { attemptDuration, formatUsd } from '../../../utils/admin'
import { formatWeight, toWithersCm } from '../../../utils/pet'
import { errorMessageOf } from '../errors'
import { useCheckFit, useGenerateModel } from '../queries'

/** 생성은 1.5~4분. 진행 막대는 2분 30초를 기준으로 채우고 95%에서 멈춘다 */
const EXPECTED_MS = 150_000

export interface CreateFlowProps {
  pet: PetDetail
  photoIndex: number
  /** 최근 시도(사진 거부·부적합·실패)가 있으면 안내 */
  lastAttempt: PetModelAttempt | null
  remaining: number | null
}

/** 사진 → 적합도 확인 → 만들기. 사진을 바꾸면 처음부터 다시 */
export function CreateFlow({ pet, photoIndex, lastAttempt, remaining }: CreateFlowProps) {
  const fit = useCheckFit(pet.id)
  const generate = useGenerateModel(pet.id)
  const [force, setForce] = useState(false)
  const [checkedIndex, setCheckedIndex] = useState<number | null>(null)

  // 다른 사진을 고르면 이전 확인 결과는 버린다
  const result = checkedIndex === photoIndex ? fit.data : undefined
  const limitReached = remaining !== null && remaining <= 0

  const check = () => {
    setForce(false)
    setCheckedIndex(photoIndex)
    fit.mutate({ photoIndex })
  }

  const canMake = result ? result.canGenerate && (!result.needsForce || force) : false

  return (
    <>
      {lastAttempt && !result && !fit.isPending && <LastAttemptNote attempt={lastAttempt} />}

      {fit.isPending && checkedIndex === photoIndex ? (
        <div role="status" className="flex items-center gap-3.5 rounded-button bg-canvas p-5">
          <Spinner />
          <div>
            <p className="text-body-lg font-semibold">사진을 읽고 있어요</p>
            <p className="mt-0.5 text-label text-ink-tertiary">5~20초 걸려요. 배포 직후 첫 확인은 30초 넘게 걸릴 수 있어요.</p>
          </div>
        </div>
      ) : result ? (
        <FitResult result={result} weightKg={pet.weightKg} force={force} onForceChange={setForce} />
      ) : (
        <>
          <p className="text-body text-ink-secondary">
            고른 사진으로 이 아이를 만들 수 있는지 먼저 확인해요. 사진이 거부되거나 체형이 템플릿과 다르면 여기서 알려
            드려요.
          </p>
          {fit.isError && checkedIndex === photoIndex && (
            <p role="alert" className="text-label text-danger">
              {errorMessageOf(fit.error, '적합도를 확인하지 못했어요. 다시 시도해 주세요.')}
            </p>
          )}
          <Button variant="dark" fullWidth onClick={check} disabled={fit.isPending}>
            사진 {photoIndex + 1}로 적합도 확인
          </Button>
          <p className="text-caption text-ink-caption">
            5~20초 걸려요 · 한 번에 약 <span className="font-mono">$0.02</span>
          </p>
        </>
      )}

      {result?.canGenerate && (
        <>
          {generate.isError && (
            <p role="alert" className="text-label text-danger">
              {errorMessageOf(generate.error, 'AR 모델을 만들지 못했어요. 다시 시도해 주세요.')}
            </p>
          )}
          {limitReached && (
            <p role="status" className="text-label text-notice-ink">
              오늘 한도를 다 썼어요. 내일 다시 만들 수 있어요.
            </p>
          )}
          <Button
            fullWidth
            onClick={() => generate.mutate({ photoIndex, force: result.needsForce ? force : undefined })}
            disabled={!canMake || limitReached || generate.isPending}
          >
            {generate.isPending ? '등록하는 중…' : 'AR 만들기'}
          </Button>
          <p className="text-caption text-ink-caption">
            1.5~4분 걸려요 · 한 마리 약 <span className="font-mono">$0.075</span>
            {remaining !== null && (
              <>
                {' '}
                · 오늘 <span className="font-mono">{remaining}</span>회 남음
              </>
            )}{' '}
            · 한 번 만든 모델은 다시 만들지 않아요
          </p>
        </>
      )}
    </>
  )
}

function FitResult({
  result,
  weightKg,
  force,
  onForceChange,
}: {
  result: FitCheckResponse
  weightKg: number | null
  force: boolean
  onForceChange: (force: boolean) => void
}) {
  if (!result.canGenerate) {
    const reason = result.photoRejected[0]
    return (
      <>
        <ResultHeading tone="danger" title="사진 거부" note={reason ? PHOTO_REJECT_LABEL[reason] : undefined} />
        {result.reasons.length > 0 && (
          <ul className="list-disc pl-4.5 text-body text-ink-secondary">
            {result.reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        )}
        <p className="text-body text-ink-secondary">이 사진으로는 강제로도 만들 수 없어요.</p>
        <p className="text-body font-semibold text-accent">다른 사진을 골라 주세요.</p>
      </>
    )
  }

  if (result.needsForce) {
    return (
      <>
        <ResultHeading
          tone="warning"
          title={<>{result.label ?? '부적합'} · <span className="font-mono">{result.score ?? '-'}</span>점</>}
          note="체형이 템플릿과 달라요"
        />
        {result.reasons.length > 0 && (
          <ul className="list-disc pl-4.5 text-body text-ink-secondary">
            {result.reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        )}
        <div className="rounded-input border border-notice-line bg-notice px-3.5 py-3 text-label text-notice-ink">
          만들어도 이 아이처럼 보이지 않을 수 있어요. 앱에서는 정상 모델과 똑같이 보이니, 다른 사진이 있으면 먼저 확인해
          보세요.
        </div>
        <label className="flex min-h-11 cursor-pointer items-center gap-2.5 text-body">
          <input
            type="checkbox"
            checked={force}
            onChange={(event) => onForceChange(event.target.checked)}
            className="size-5 accent-accent"
          />
          그래도 만들기 (force)
        </label>
      </>
    )
  }

  const level = result.level ?? 'good'
  const weight = formatWeight(weightKg)
  return (
    <>
      <ResultHeading
        tone={level === 'good' ? 'success' : 'warning'}
        title={<>{FIT_LEVEL_LABEL[level]} · <span className="font-mono">{result.score ?? '-'}</span>점</>}
        note="이 사진으로 만들 수 있어요"
      />
      <dl className="grid grid-cols-[96px_minmax(0,1fr)] gap-y-2 text-body">
        <dt className="text-ink-caption">템플릿</dt>
        <dd>{result.template ? (TEMPLATE_LABEL[result.template] ?? result.template) : '-'}</dd>
        <dt className="text-ink-caption">예상 체고</dt>
        <dd>
          {result.withersM !== null ? <span className="font-mono">{toWithersCm(result.withersM)}cm</span> : '-'}
          {weight && <span className="text-ink-caption"> (체중 {weight} 기준)</span>}
        </dd>
        <dt className="text-ink-caption">사진 품질</dt>
        <dd>{result.photoLevel ? PHOTO_QUALITY_LABEL[result.photoLevel] : '-'}</dd>
        {result.notes.length > 0 && (
          <>
            <dt className="text-ink-caption">참고</dt>
            <dd className="text-ink-secondary">{result.notes.join(' · ')}</dd>
          </>
        )}
      </dl>
    </>
  )
}

const HEADING_TONE = {
  success: 'bg-success-soft text-success-strong',
  warning: 'bg-warning-soft text-warning-strong',
  danger: 'bg-danger-soft text-danger-strong',
}

function ResultHeading({
  tone,
  title,
  note,
}: {
  tone: keyof typeof HEADING_TONE
  title: ReactNode
  note?: string
}) {
  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <span className={cn('rounded-chip px-3 py-1.5 text-body-lg font-bold', HEADING_TONE[tone])}>{title}</span>
      {note && <span className="text-label text-ink-tertiary">{note}</span>}
    </div>
  )
}

/** 직전 시도가 거부·부적합·실패로 끝났으면 무엇 때문인지 알려 준다 */
function LastAttemptNote({ attempt }: { attempt: PetModelAttempt }) {
  const detail = attempt.status === 'FAILED' ? attempt.error : attempt.reasons?.join(' · ')
  return (
    <p className="rounded-input bg-muted px-3.5 py-2.5 text-label text-ink-secondary">
      최근 시도: <strong className="font-semibold">{MODEL_STATUS_LABEL[attempt.status]}</strong>
      {detail && ` · ${detail}`}
    </p>
  )
}

/** 만드는 중 (5초마다 상태 조회는 useLatestModel이 한다) */
export function PendingPanel({ attempt }: { attempt: PetModelAttempt }) {
  const now = useNow(1000)
  const elapsedMs = now - Date.parse(attempt.createdAt)
  const progress = Math.min(elapsedMs / EXPECTED_MS, 0.95)

  return (
    <>
      <div role="status" className="rounded-button border border-info-line bg-info-subtle p-5 text-info-strong">
        <p className="text-emphasis font-bold">만들고 있어요</p>
        <p className="mt-1 text-body">1.5~4분 걸려요. 이 화면을 닫아도 계속 만들어지고, 5초마다 상태를 확인해요.</p>
        <div
          role="progressbar"
          aria-label="만드는 중"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress * 100)}
          className="mt-3.5 h-1.5 overflow-hidden rounded-full bg-info-soft"
        >
          <div className="h-full bg-info transition-[width] duration-1000" style={{ width: `${progress * 100}%` }} />
        </div>
        <p className="mt-2.5 text-caption text-info-ink">
          작업 <span className="font-mono">{attempt.jobId}</span> ·{' '}
          <span className="font-mono">{attemptDuration(attempt.createdAt, null, now)}</span> 지남
        </p>
      </div>
      <Link to="/admin/models" className={buttonStyles({ variant: 'outline', size: 'sm', fullWidth: true })}>
        생성 기록에서 보기
      </Link>
    </>
  )
}

/** 완성. 최근 시도가 없으면(예전에 만든 모델) 상세의 model 값으로 보여 준다 */
export function DonePanel({ pet, attempt }: { pet: PetDetail; attempt: PetModelAttempt | null }) {
  const withersM = attempt?.withersM ?? pet.model?.withersM ?? null
  const template = attempt?.template ?? pet.model?.template ?? null
  const tapAnimation = attempt?.tapAnimation ?? pet.model?.behavior.tapAnimation ?? null
  const playbackRate = attempt?.playbackRate ?? pet.model?.behavior.playbackRate ?? null

  return (
    <>
      <div className="rounded-button border border-success-border bg-success-subtle p-5 text-success-strong">
        <p className="text-emphasis font-bold">완성했어요</p>
        <p className="mt-1 text-body">이제 앱에서 이 아이를 AR로 볼 수 있어요.</p>
        <dl className="mt-3.5 grid grid-cols-[96px_minmax(0,1fr)] gap-y-1.5 text-body">
          <dt>체고</dt>
          <dd className="font-mono">{withersM !== null ? `${toWithersCm(withersM)}cm` : '-'}</dd>
          <dt>템플릿</dt>
          <dd>
            {template ? (TEMPLATE_LABEL[template] ?? template) : '-'}
            {attempt?.forced && ' (force로 만듦)'}
          </dd>
          <dt>탭 반응</dt>
          <dd className="font-mono">
            {tapAnimation ? `${tapAnimation} · ${(playbackRate ?? 1).toFixed(1)}x` : '-'}
          </dd>
          <dt>비용</dt>
          <dd className="font-mono">{formatUsd(attempt?.costUsd ?? null)}</dd>
        </dl>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Link to={`/pets/${pet.id}`} className={buttonStyles({ size: 'md' })}>
          앱에서 보기
        </Link>
        <Link to="/admin" className={buttonStyles({ variant: 'outline', size: 'md' })}>
          다음 아이 만들기
        </Link>
      </div>
    </>
  )
}

function Spinner() {
  return (
    <svg className="size-8 shrink-0 animate-spin" viewBox="0 0 32 32" aria-hidden>
      <circle cx="16" cy="16" r="13" fill="none" strokeWidth="4" className="stroke-line" />
      <path d="M16 3a13 13 0 0 1 13 13" fill="none" strokeWidth="4" strokeLinecap="round" className="stroke-accent" />
    </svg>
  )
}

