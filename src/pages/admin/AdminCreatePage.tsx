import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { ChevronLeft } from 'lucide-react'
import { Link, useParams } from 'react-router'
import { ApiError } from '../../apis/apiError'
import type { PetModelAttempt } from '../../apis/dto/admin.dto'
import type { PetDetail } from '../../apis/dto/pet.dto'
import { Button } from '../../components/Button/Button'
import { buttonStyles } from '../../components/Button/buttonStyles'
import { StateView } from '../../components/StateView/StateView'
import { cn } from '../../components/utils/cn'
import { SEX_LABEL } from '../../constants/pet'
import { AdminForbidden } from '../../features/admin/components/AdminCommon'
import { CreateFlow, DonePanel, PendingPanel } from '../../features/admin/components/CreatePanels'
import { isForbidden } from '../../features/admin/errors'
import { useLatestModel, useModelAttempts } from '../../features/admin/queries'
import { PetPhoto } from '../../features/pet/components/PetPhoto'
import { petKeys, usePetDetail } from '../../features/pet/queries'
import { formatAge, formatWeight } from '../../utils/pet'

/** 13 · AR 만들기 (/admin/pets/:petId/model) */
export function AdminCreatePage() {
  const { petId } = useParams()
  const id = Number(petId)
  const detail = usePetDetail(id)
  const latest = useLatestModel(id)
  const attempts = useModelAttempts()
  const queryClient = useQueryClient()

  // 만드는 중 → 완성으로 바뀌면 앱 쪽 목록·상세도 다시 불러온다 (hasModel, model이 바뀐다)
  const status = latest.data?.status
  const previousStatus = useRef(status)
  useEffect(() => {
    if (previousStatus.current === 'PENDING' && status === 'DONE') {
      queryClient.invalidateQueries({ queryKey: petKeys.all })
    }
    previousStatus.current = status
  }, [status, queryClient])

  if (isForbidden(detail.error) || isForbidden(latest.error)) return <AdminForbidden />

  if (detail.isError) {
    const notFound = detail.error instanceof ApiError && detail.error.status === 404
    return (
      <StateView
        tone="error"
        title={notFound ? '공고를 찾을 수 없어요' : '공고를 불러오지 못했어요'}
        description={notFound ? '공고가 내려갔거나 주소가 잘못됐어요.' : '잠시 후 다시 시도해 주세요.'}
        action={
          notFound ? (
            <Link to="/admin" className={buttonStyles({ variant: 'dark', size: 'md' })}>
              목록으로
            </Link>
          ) : (
            <Button variant="outline" size="md" onClick={() => detail.refetch()}>
              다시 시도
            </Button>
          )
        }
      />
    )
  }

  const usage = attempts.data
  const remaining = usage ? Math.max(0, usage.dailyLimit - usage.todayCount) : null

  return (
    <div>
      <Link
        to="/admin"
        className="group inline-flex h-11 items-center gap-1 text-body text-ink-tertiary transition hover:text-ink"
      >
        <ChevronLeft className="size-4.5 transition group-hover:-translate-x-0.5" strokeWidth={2} aria-hidden />
        AR 모델 만들기 목록
      </Link>

      {detail.isPending ? (
        <div className="mt-2 h-9 w-72 rounded skeleton" aria-busy="true" aria-label="공고 불러오는 중" />
      ) : (
        <PetHeading pet={detail.data} />
      )}

      {detail.data && !latest.isPending ? (
        <CreateBody
          // 아이가 바뀌면 고른 사진 등 화면 상태를 처음부터
          key={detail.data.id}
          pet={detail.data}
          latest={latest.data ?? null}
          remaining={remaining}
        />
      ) : (
        <div className="mt-5 h-80 rounded-card-lg skeleton" aria-busy="true" aria-label="불러오는 중" />
      )}
    </div>
  )
}

const CHIP = 'rounded-chip border border-line bg-surface px-2.5 py-1'

function PetHeading({ pet }: { pet: PetDetail }) {
  const weight = formatWeight(pet.weightKg)
  return (
    <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-3">
      <h1 className="text-display font-bold">
        {pet.kindName} · {SEX_LABEL[pet.sex]}
      </h1>
      <ul className="flex flex-wrap gap-1.5 text-label">
        <li className={CHIP}>
          체중 <strong className="font-mono font-semibold">{weight ?? '미상'}</strong>
        </li>
        <li className={CHIP}>{formatAge(pet.ageText)}</li>
        <li className={CHIP}>{pet.orgName}</li>
        <li className={cn(CHIP, 'font-mono')}>{pet.noticeNo}</li>
      </ul>
      <Link to={`/pets/${pet.id}`} className="ml-auto text-label font-semibold text-accent">
        앱 상세 화면 보기
      </Link>
    </div>
  )
}

interface CreateBodyProps {
  pet: PetDetail
  /** 이 아이의 가장 최근 시도. 없으면 null */
  latest: PetModelAttempt | null
  remaining: number | null
}

function CreateBody({ pet, latest, remaining }: CreateBodyProps) {
  // 최근 시도에 쓴 사진이 있으면 그 사진부터 고른다
  const [photoIndex, setPhotoIndex] = useState(() => {
    const used = latest ? pet.photoUrls.indexOf(latest.photoUrl) : -1
    return used >= 0 ? used : 0
  })

  const pending = latest?.status === 'PENDING'
  const done = latest?.status === 'DONE' || pet.model !== null
  // 만드는 중이거나 이미 만들었으면 사진을 바꿀 수 없다
  const locked = pending || done

  return (
    <div className="mt-5 flex flex-wrap items-start gap-5">
      <section
        aria-labelledby="step-photo"
        className="min-w-0 flex-[999_1_520px] rounded-card-lg border border-line bg-surface p-5"
      >
        <StepHeading id="step-photo" step={1}>
          사진 고르기
        </StepHeading>
        <p className="mt-1.5 text-body text-ink-tertiary">
          털색과 무늬를 읽을 사진 한 장을 골라요. 몸 전체가 보이고 손·철창에 덜 가린 사진이 좋아요.
        </p>
        {pet.photoUrls.length === 0 ? (
          <p className="mt-4 rounded-input bg-muted px-4 py-3 text-body text-ink-secondary">
            공고 사진이 없어 만들 수 없어요.
          </p>
        ) : (
          <div role="radiogroup" aria-label="공고 사진" className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {pet.photoUrls.map((url, index) => {
              const selected = photoIndex === index
              return (
                <button
                  key={url}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  disabled={locked}
                  onClick={() => setPhotoIndex(index)}
                  className={cn(
                    'rounded-card border-2 bg-surface p-2 text-left',
                    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
                    'disabled:cursor-not-allowed',
                    selected ? 'border-accent' : 'border-line',
                    locked && !selected && 'opacity-50',
                  )}
                >
                  <PetPhoto
                    src={url}
                    alt={`공고 사진 ${index + 1}`}
                    showPlaceholderLabel={false}
                    className="aspect-square rounded-input"
                  />
                  <span className="mt-2 flex items-center justify-between text-label">
                    <span className="font-semibold">사진 {index + 1}</span>
                    <span className="font-mono text-ink-caption">photoIndex {index}</span>
                  </span>
                </button>
              )
            })}
          </div>
        )}
      </section>

      <section
        aria-labelledby="step-make"
        className="flex min-w-0 flex-[1_1_380px] flex-col gap-3.5 rounded-card-lg border border-line bg-surface p-5"
      >
        <StepHeading id="step-make" step={2}>
          확인하고 만들기
        </StepHeading>
        {pending && latest ? (
          <PendingPanel attempt={latest} />
        ) : done ? (
          <DonePanel pet={pet} attempt={latest?.status === 'DONE' ? latest : null} />
        ) : pet.weightKg === null ? (
          <p className="text-body text-ink-secondary">공고에 체중이 없어 실제 크기로 만들 수 없어요.</p>
        ) : pet.photoUrls.length === 0 ? (
          <p className="text-body text-ink-secondary">공고 사진이 없어 만들 수 없어요.</p>
        ) : (
          <CreateFlow pet={pet} photoIndex={photoIndex} lastAttempt={latest} remaining={remaining} />
        )}
      </section>
    </div>
  )
}

function StepHeading({ id, step, children }: { id: string; step: number; children: ReactNode }) {
  return (
    <h2 id={id} className="flex items-center gap-2 text-emphasis font-bold">
      <span className="inline-flex size-6.5 items-center justify-center rounded-full bg-ink font-mono text-label text-measure">
        {step}
      </span>
      {children}
    </h2>
  )
}
