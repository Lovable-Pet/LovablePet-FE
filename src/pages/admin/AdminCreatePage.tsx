import { useState, type ReactNode } from 'react'
import { Check } from 'lucide-react'
import { Link, useParams } from 'react-router'
import { ApiError } from '../../apis/apiError'
import type { FitCheckResponse, FitLevel, PetModelAttempt } from '../../apis/dto/admin.dto'
import type { PetDetail } from '../../apis/dto/pet.dto'
import { Badge, type BadgeTone } from '../../components/Badge/Badge'
import { Button } from '../../components/Button/Button'
import { buttonClass } from '../../components/Button/buttonClass'
import { PawDots } from '../../components/LoadingScreen/LoadingScreen'
import { StateView } from '../../components/StateView/StateView'
import { cn } from '../../components/utils/cn'
import { FIT_LEVEL_LABEL, PHOTO_QUALITY_LABEL, PHOTO_REJECT_LABEL } from '../../constants/admin'
import { TEMPLATE_LABEL } from '../../constants/pet'
import { ForbiddenView, StatusBadge } from '../../features/admin/components/AdminCommon'
import { errorMessageOf, isForbidden } from '../../features/admin/errors'
import { useCheckFit, useGenerateModel, useLatestModel } from '../../features/admin/queries'
import { petFacts } from '../../features/pet/petFacts'
import { PetPhoto } from '../../features/pet/components/PetPhoto'
import { usePetDetail } from '../../features/pet/queries'
import { useNow } from '../../hooks/useNow'
import { attemptDuration, formatUsd } from '../../utils/admin'
import { toWithersCm } from '../../utils/pet'

const LEVEL_TONE: Record<FitLevel, BadgeTone> = { good: 'success', fair: 'warning', poor: 'danger' }

// /admin/pets/:petId/model — 사진 고르기 → 적합도 확인 → 만들기 → 진행 상태
export function AdminCreatePage() {
  const { petId } = useParams()
  const id = Number(petId)
  const pet = usePetDetail(id)
  const latest = useLatestModel(id)

  if (isForbidden(latest.error)) return <ForbiddenView />
  if (!Number.isInteger(id) || id <= 0 || (pet.error instanceof ApiError && pet.error.status === 404)) {
    return (
      <StateView
        title="공고를 찾을 수 없어요"
        action={
          <Link to="/admin" className={buttonClass()}>
            유기견 목록으로 가기
          </Link>
        }
      />
    )
  }
  if (pet.isError || latest.isError) {
    return (
      <StateView
        tone="error"
        title="정보를 불러오지 못했어요"
        action={
          <Button
            variant="outline"
            onClick={() => {
              pet.refetch()
              latest.refetch()
            }}
          >
            다시 시도
          </Button>
        }
      />
    )
  }
  if (pet.isPending || latest.isPending) {
    return (
      <div className="flex justify-center py-20">
        <PawDots label="불러오는 중" />
      </div>
    )
  }
  return <Workspace pet={pet.data} latest={latest.data} />
}

function Workspace({ pet, latest }: { pet: PetDetail; latest: PetModelAttempt | null }) {
  const [photoIndex, setPhotoIndex] = useState(0)
  /** 지난 결과를 접고 새로 만들기를 시작했는지 */
  const [restart, setRestart] = useState(false)
  const checkFit = useCheckFit(pet.id)
  const generate = useGenerateModel(pet.id)
  // 사진을 바꾸면 pickPhoto 가 결과를 지우므로 남아 있는 결과는 지금 고른 사진의 것이다
  const fit = checkFit.data

  const pickPhoto = (index: number) => {
    setPhotoIndex(index)
    checkFit.reset()
    generate.reset()
  }
  const startGenerate = (force: boolean) =>
    generate.mutate({ photoIndex, force: force || undefined }, { onSuccess: () => setRestart(false) })

  const showAttempt = latest && (latest.status === 'PENDING' || !restart)

  return (
    <main>
      <div className="flex items-center gap-3">
        <PetPhoto src={pet.photoUrls[0] ?? null} alt="" seed={pet.id} className="size-14 shrink-0 rounded-tile" />
        <div className="min-w-0">
          <h1 className="truncate font-display text-heading">{pet.kindName} AR 모델</h1>
          <p className="truncate text-label text-ink-soft">
            {petFacts(pet)} / {pet.careName}
          </p>
        </div>
      </div>

      {showAttempt ? (
        <AttemptPanel pet={pet} attempt={latest} onRestart={() => setRestart(true)} />
      ) : pet.weightKg === null ? (
        <StateView title="체중 정보가 없어 만들 수 없어요" description="체중을 알아야 실제 크기를 정할 수 있어요." />
      ) : pet.photoUrls.length === 0 ? (
        <StateView title="공고에 사진이 없어요" description="사진이 있어야 AR 모델을 만들 수 있어요." />
      ) : (
        <>
          <Step number={1} title="사진을 골라 주세요" note="유기견 한 마리만, 몸 전체가 가려지지 않고 보이는 사진이 좋아요.">
            <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5">
              {pet.photoUrls.map((url, index) => (
                <li key={url}>
                  <button
                    type="button"
                    aria-pressed={photoIndex === index}
                    aria-label={`${index + 1}번 사진 고르기`}
                    onClick={() => pickPhoto(index)}
                    disabled={checkFit.isPending || generate.isPending}
                    className={cn(
                      'relative block w-full rounded-tile p-1 transition-[box-shadow,scale] duration-150 active:scale-[0.97]',
                      photoIndex === index ? 'shadow-[0_0_0_3px_var(--color-primary-deep)]' : 'shadow-[0_0_0_1.5px_var(--color-line)]',
                    )}
                  >
                    <PetPhoto src={url} alt={`${index + 1}번 사진`} seed={pet.id + index} className="aspect-square w-full rounded-[0.875rem]" />
                    {photoIndex === index && (
                      <span className="absolute top-2.5 right-2.5 flex size-6 items-center justify-center rounded-full bg-primary-deep text-white">
                        <Check className="size-4" strokeWidth={3} aria-hidden />
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </Step>

          <Step number={2} title="만들 수 있는 사진인지 확인해요" note="5~20초 걸리고, 한 번에 약 $0.02가 들어요.">
            {fit ? (
              <FitResult fit={fit} />
            ) : (
              <Button variant="soft" onClick={() => checkFit.mutate({ photoIndex })} disabled={checkFit.isPending}>
                {checkFit.isPending ? <PawDots label="확인하는 중" /> : '이 사진 확인하기'}
              </Button>
            )}
            {checkFit.isPending && <p className="mt-2 text-caption text-ink-mute">배포 직후 첫 확인은 30초 넘게 걸릴 수 있어요.</p>}
            {checkFit.isError && <ErrorNote>{errorMessageOf(checkFit.error, '확인하지 못했어요. 다시 시도해 주세요.')}</ErrorNote>}
          </Step>

          {fit && (
            <Step number={3} title="AR 모델을 만들어요" note="1분 30초~4분 걸리고, 한 번에 약 $0.075가 들어요.">
              {!fit.canGenerate ? (
                <p className="rounded-tile bg-pink-soft px-4 py-3 text-label font-bold text-pink-deep">
                  이 사진으로는 만들 수 없어요. 1번에서 다른 사진을 골라 주세요.
                </p>
              ) : fit.needsForce ? (
                <div className="rounded-tile bg-apricot-soft p-4">
                  <p className="text-label text-ink-soft">
                    체형이 템플릿과 맞지 않아요. 그래도 만들 수 있지만 이 유기견처럼 보이지 않을 수 있어요.
                  </p>
                  <Button variant="outline" className="mt-3" onClick={() => startGenerate(true)} disabled={generate.isPending}>
                    {generate.isPending ? '등록하는 중' : '그래도 만들기'}
                  </Button>
                </div>
              ) : (
                <Button size="lg" onClick={() => startGenerate(false)} disabled={generate.isPending}>
                  {generate.isPending ? '등록하는 중' : 'AR 모델 만들기'}
                </Button>
              )}
              {generate.isError && <ErrorNote>{errorMessageOf(generate.error, '만들기를 시작하지 못했어요. 다시 시도해 주세요.')}</ErrorNote>}
            </Step>
          )}

          {latest && (
            <button type="button" onClick={() => setRestart(false)} className="mt-6 h-11 text-label font-bold text-primary-deep underline underline-offset-4">
              지난 결과로 돌아가기
            </button>
          )}
        </>
      )}
    </main>
  )
}

function Step({ number, title, note, children }: { number: number; title: string; note: string; children: ReactNode }) {
  return (
    <section className="mt-7">
      <h2 className="flex items-center gap-2 text-emphasis font-extrabold">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-pink text-label tabular-nums">{number}</span>
        {title}
      </h2>
      <p className="mt-1 mb-3 text-label text-ink-mute">{note}</p>
      {children}
    </section>
  )
}

function ErrorNote({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="mt-3 rounded-tile bg-pink-soft px-4 py-3 text-label font-bold text-pink-deep">
      {children}
    </p>
  )
}

function FitResult({ fit }: { fit: FitCheckResponse }) {
  const rejected = fit.photoRejected.map((reason) => PHOTO_REJECT_LABEL[reason])
  return (
    <div className="rounded-card bg-surface p-4 shadow-soft">
      <div className="flex flex-wrap items-center gap-2">
        {fit.level && <Badge tone={LEVEL_TONE[fit.level]}>{fit.label ?? FIT_LEVEL_LABEL[fit.level]}</Badge>}
        {fit.score !== null && (
          <p className="text-body">
            <span className="text-heading font-extrabold tabular-nums">{fit.score}</span>점
          </p>
        )}
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="체형">{fit.template ? (TEMPLATE_LABEL[fit.template] ?? fit.template) : '-'}</Stat>
        <Stat label="예상 어깨 높이">{fit.withersM !== null ? `${toWithersCm(fit.withersM)}cm` : '-'}</Stat>
        <Stat label="체중">{fit.weightKg}kg</Stat>
        <Stat label="사진 품질">{fit.photoLevel ? PHOTO_QUALITY_LABEL[fit.photoLevel] : '-'}</Stat>
      </dl>
      {rejected.length > 0 && <NoteList tone="danger" title="사진을 쓸 수 없는 이유" items={rejected} />}
      {fit.reasons.length > 0 && <NoteList tone="warning" title="확인할 점" items={fit.reasons} />}
      {fit.notes.length > 0 && <NoteList tone="neutral" title="참고" items={fit.notes} />}
    </div>
  )
}

function Stat({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="rounded-tile bg-pink-soft px-3 py-2.5">
      <dt className="text-caption text-ink-mute">{label}</dt>
      <dd className="text-body font-extrabold tabular-nums">{children}</dd>
    </div>
  )
}

function NoteList({ tone, title, items }: { tone: 'danger' | 'warning' | 'neutral'; title: string; items: string[] }) {
  const color = { danger: 'bg-pink-soft text-pink-deep', warning: 'bg-apricot-soft text-apricot-deep', neutral: 'bg-canvas text-ink-soft' }[tone]
  return (
    <div className={cn('mt-3 rounded-tile px-4 py-3', color)}>
      <p className="text-caption font-extrabold">{title}</p>
      <ul className="mt-1 list-disc pl-4 text-label">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  )
}

/** 가장 최근 시도: 만드는 중이면 지난 시간, 끝났으면 결과 */
function AttemptPanel({ pet, attempt, onRestart }: { pet: PetDetail; attempt: PetModelAttempt; onRestart: () => void }) {
  const pending = attempt.status === 'PENDING'
  const now = useNow(1000, pending)
  const notes = [...(attempt.reasons ?? []), ...(attempt.error ? [attempt.error] : [])]

  return (
    <section aria-live="polite" className={cn('mt-6 rounded-card p-5', pending ? 'bg-apricot-soft' : attempt.status === 'DONE' ? 'bg-mint-soft' : 'bg-surface shadow-soft')}>
      <div className="flex items-start gap-4">
        <PetPhoto src={attempt.photoUrl} alt="고른 사진" seed={pet.id} className="size-24 shrink-0 rounded-tile" />
        <div className="min-w-0 flex-1">
          <StatusBadge status={attempt.status} />
          {pending ? (
            <>
              <p className="mt-2 text-title font-extrabold tabular-nums">{attemptDuration(attempt.createdAt, null, now)}</p>
              <p className="text-label text-ink-soft">보통 1분 30초~4분 걸려요. 이 화면을 떠나도 계속 만들어요.</p>
              <PawDots label="만드는 중" className="mt-3" />
            </>
          ) : (
            <>
              <h2 className="mt-2 text-heading font-extrabold">
                {attempt.status === 'DONE' ? 'AR 모델이 완성됐어요' : attempt.status === 'PHOTO_REJECTED' ? '이 사진은 쓸 수 없어요' : attempt.status === 'UNSUITABLE' ? '체형이 맞지 않아 멈췄어요' : '만들지 못했어요'}
              </h2>
              <p className="mt-1 text-label text-ink-soft tabular-nums">
                걸린 시간 {attemptDuration(attempt.createdAt, attempt.finishedAt)}, 비용 {formatUsd(attempt.costUsd)}
                {attempt.withersM !== null && `, 어깨 높이 ${toWithersCm(attempt.withersM)}cm`}
              </p>
            </>
          )}
        </div>
      </div>

      {notes.length > 0 && <NoteList tone={attempt.status === 'UNSUITABLE' ? 'warning' : 'danger'} title="이유" items={notes} />}

      {!pending && (
        <div className="mt-4 flex flex-wrap gap-2">
          {attempt.status === 'DONE' && (
            <Link to={`/pets/${pet.id}/ar`} className={buttonClass({ variant: 'sky' })}>
              AR로 확인하기
            </Link>
          )}
          <Button variant="outline" onClick={onRestart}>
            {attempt.status === 'PHOTO_REJECTED' ? '다른 사진으로 만들기' : '다시 만들기'}
          </Button>
          <Link to={`/pets/${pet.id}`} className={buttonClass({ variant: 'ghost' })}>
            공고 보기
          </Link>
        </div>
      )}
    </section>
  )
}
