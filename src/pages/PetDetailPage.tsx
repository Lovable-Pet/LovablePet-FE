import type { ReactNode } from 'react'
import { ChevronLeft, Info, Phone, Share } from 'lucide-react'
import { Link, useParams } from 'react-router'
import { ApiError } from '../apis/apiError'
import type { PetDetail } from '../apis/dto/pet.dto'
import { Badge, type BadgeTone } from '../components/Badge/Badge'
import { Button } from '../components/Button/Button'
import { buttonStyles } from '../components/Button/buttonStyles'
import { IconButton } from '../components/IconButton/IconButton'
import { StateView } from '../components/StateView/StateView'
import { NEUTERED_LABEL, SEX_LABEL } from '../constants/pet'
import { FavoriteButton } from '../features/favorite/components/FavoriteButton'
import { PhotoGallery } from '../features/pet/components/detail/PhotoGallery'
import { ShelterCard } from '../features/pet/components/detail/ShelterCard'
import { InNoticeBanner, SizeCard } from '../features/pet/components/detail/SizeCard'
import { similarSizeLinkOf } from '../features/pet/browseQuery'
import { usePetDetail } from '../features/pet/queries'
import { useFlash } from '../app/flash'
import { useGoBack } from '../hooks/useGoBack'
import {
  adoptionStateOf,
  formatAge,
  formatMonthDay,
  formatWeight,
  isMetFamily,
  toTelHref,
  type AdoptionState,
} from '../utils/pet'

/** 위쪽 배지. 종료는 카드 문구와 맞춰 입양·반환이면 '입양 완료', 그 밖은 '보호 종료' */
const adoptionBadgeOf = (state: AdoptionState, processState: string): { label: string; tone: BadgeTone } => {
  if (state === 'ADOPTABLE') return { label: '지금 입양할 수 있어요', tone: 'success' }
  if (state === 'IN_NOTICE') return { label: '공고 기간 중', tone: 'warning' }
  return { label: isMetFamily(processState) ? '입양 완료' : '보호 종료', tone: 'closed' }
}

export function PetDetailPage() {
  const { petId } = useParams()
  const id = Number(petId)
  const { data: pet, isPending, isError, error, refetch } = usePetDetail(id)
  const goBack = useGoBack()

  if (!Number.isInteger(id) || id <= 0 || (isError && error instanceof ApiError && error.status === 404)) {
    return (
      <DetailShell onBack={goBack}>
        <StateView
          title="공고를 찾을 수 없어요"
          description="공고가 내려갔거나 주소가 잘못됐어요."
          action={
            <Link to="/" className={buttonStyles({ variant: 'dark', size: 'md' })}>
              둘러보기로 가기
            </Link>
          }
        />
      </DetailShell>
    )
  }

  if (isError) {
    return (
      <DetailShell onBack={goBack}>
        <StateView
          tone="error"
          title="공고를 불러오지 못했어요"
          description="잠시 후 다시 시도해 주세요."
          action={
            <Button variant="outline" size="md" onClick={() => refetch()}>
              다시 시도
            </Button>
          }
        />
      </DetailShell>
    )
  }

  if (isPending) return <DetailSkeleton />

  return <PetDetailView pet={pet} onBack={goBack} />
}

function PetDetailView({ pet, onBack }: { pet: PetDetail; onBack: () => void }) {
  const adoption = adoptionStateOf(pet)
  const badge = adoptionBadgeOf(adoption, pet.processState)
  const weight = formatWeight(pet.weightKg)
  const similarSize = similarSizeLinkOf(pet.weightKg)
  const canPlaceAr = pet.model !== null && pet.weightKg !== null
  const showFlash = useFlash()

  const share = async () => {
    const url = window.location.href
    const title = `${pet.kindName} · ${pet.orgName} | LovablePet`
    try {
      if (navigator.share) {
        await navigator.share({ title, url })
        return
      }
      await navigator.clipboard.writeText(url)
      showFlash('링크를 복사했어요')
    } catch (shareError) {
      // 공유 창을 닫은 경우는 조용히 넘어간다
      if (shareError instanceof DOMException && shareError.name === 'AbortError') return
      showFlash('링크를 복사하지 못했어요')
    }
  }

  const copyAddress = async () => {
    try {
      await navigator.clipboard.writeText(pet.careAddr)
      showFlash('주소를 복사했어요')
    } catch {
      showFlash('주소를 복사하지 못했어요')
    }
  }

  const infoRows: { label: string; value: ReactNode }[] = [
    { label: '털색', value: pet.color },
    { label: '나이', value: formatAge(pet.ageText) },
    {
      label: '체중',
      // 숫자로 바꿀 수 있으면 "14kg", 아니면 공고 원문, 원문도 없으면 '체중 미상'
      value: weight ? <span className="font-mono">{weight}</span> : pet.weightText || '체중 미상',
    },
    { label: '발견 장소', value: pet.happenPlace },
    {
      label: '공고 기간',
      value: (
        <>
          <span className="font-mono">
            {formatMonthDay(pet.noticeStart)} ~ {formatMonthDay(pet.noticeEnd)}
          </span>
          <br />
          {adoption === 'ADOPTABLE' && (
            <span className="text-label text-success-ink">공고가 끝나 지금 입양 신청할 수 있어요</span>
          )}
          {adoption === 'IN_NOTICE' && (
            <span className="text-label text-accent-ink">공고가 끝나면 입양 신청할 수 있어요</span>
          )}
          {adoption === 'CLOSED' && <span className="text-label text-ink-caption">{pet.processState}</span>}
        </>
      ),
    },
    { label: '특징', value: pet.specialMark },
  ]

  return (
    <div className="mx-auto min-h-dvh w-full max-w-[480px] bg-canvas pb-[calc(112px+env(safe-area-inset-bottom))]">
      <PhotoGallery photoUrls={pet.photoUrls} alt={`${pet.kindName} 공고 사진`}>
        {/* 사진은 노치 밑까지 깔고 버튼만 피한다 */}
        <div className="absolute inset-x-2 top-[calc(8px+env(safe-area-inset-top))] flex justify-between">
          <IconButton variant="floating" aria-label="뒤로" onClick={onBack}>
            <BackIcon />
          </IconButton>
          <IconButton variant="floating" aria-label="공유" onClick={share}>
            <Share className="size-5" strokeWidth={2} aria-hidden />
          </IconButton>
        </div>
      </PhotoGallery>

      <div className="relative -mt-4 rounded-t-card-lg bg-canvas px-5 pt-5">
        <div className="flex flex-wrap gap-1.5">
          <Badge tone={badge.tone}>{badge.label}</Badge>
          <Badge tone="neutral" className="font-mono">
            {pet.noticeNo}
          </Badge>
        </div>
        <h1 className="mt-3 text-display font-bold">
          {pet.kindName} · {SEX_LABEL[pet.sex]}
        </h1>
        <p className="mt-1 text-body-lg text-ink-secondary">
          {formatAge(pet.ageText)} · {NEUTERED_LABEL[pet.neutered]} · {pet.orgName}
        </p>
      </div>

      <div className="mx-4 mt-5 flex flex-col gap-3">
        {adoption === 'IN_NOTICE' && <InNoticeBanner noticeEnd={pet.noticeEnd} />}
        <SizeCard pet={pet} closed={adoption === 'CLOSED'} />
      </div>

      <section aria-labelledby="notice-title" className="mx-5 mt-6">
        <h2 id="notice-title" className="mb-2 text-subtitle font-bold">
          공고 정보
        </h2>
        <dl className="grid grid-cols-[88px_minmax(0,1fr)] gap-x-3 gap-y-3 text-body">
          {infoRows.map(({ label, value }) => (
            <div key={label} className="contents">
              <dt className="text-ink-caption">{label}</dt>
              <dd>{value || '–'}</dd>
            </div>
          ))}
        </dl>
      </section>

      <div className="mx-4 mt-6">
        <ShelterCard
          careName={pet.careName}
          careAddr={pet.careAddr}
          careTel={pet.careTel}
          onCopyAddress={copyAddress}
        />
      </div>

      <aside className="mx-4 mt-4 flex gap-2.5 rounded-card bg-muted p-4">
        <Info className="mt-px size-5 shrink-0 text-ink-tertiary" strokeWidth={2} aria-hidden />
        <p className="text-label text-ink-secondary">
          LovablePet은 보호소 방문을 대신하지 않아요. 우리 집에 맞는지 미리 확인한 뒤, 직접 만나서 교감하고 결정해
          주세요.
        </p>
      </aside>

      <div
        // 토스트가 이 바 위에 뜨게 (index.css --toast-offset)
        data-bottom-bar="action"
        className="fixed inset-x-0 bottom-0 z-10 mx-auto flex w-full max-w-[480px] gap-2 border-t border-line bg-surface px-4 pt-3 pb-[calc(28px+env(safe-area-inset-bottom))]"
      >
        <FavoriteButton petId={pet.id} favorited={pet.favorited} variant="outline" size="lg" />
        {adoption === 'CLOSED' ? (
          similarSize ? (
            <Link to={similarSize.to} className={buttonStyles({ variant: 'dark', className: 'flex-1' })}>
              <span>
                체중 <span className="font-mono">{similarSize.range}</span> 유기견 보기
              </span>
            </Link>
          ) : (
            <Link to="/" className={buttonStyles({ variant: 'soft', className: 'flex-1' })}>
              다른 유기견 둘러보기
            </Link>
          )
        ) : (
          <>
            <a
              href={toTelHref(pet.careTel)}
              className={buttonStyles({
                variant: 'soft',
                // 360px 보다 좁으면(최소 320) AR 버튼 글자가 들어가도록 전화 아이콘만 남긴다
                className: canPlaceAr ? 'flex-1 max-[359px]:w-13 max-[359px]:flex-none max-[359px]:px-0' : 'flex-1',
              })}
            >
              {canPlaceAr && <Phone className="hidden size-5 max-[359px]:block" strokeWidth={2} aria-hidden />}
              <span className={canPlaceAr ? 'max-[359px]:sr-only' : undefined}>보호소 문의</span>
            </a>
            {canPlaceAr && (
              <Link
                to={`/pets/${pet.id}/ar`}
                className={buttonStyles({ variant: 'primary', className: 'flex-[1.4] max-[359px]:px-3' })}
              >
                우리 집에 놓아 보기
              </Link>
            )}
          </>
        )}
      </div>
    </div>
  )
}

/** 뒤로 화살표. 버튼에 마우스를 올리면 뒤쪽(왼쪽)으로 2px */
function BackIcon() {
  return (
    <ChevronLeft
      className="size-5.5 transition group-hover:-translate-x-0.5"
      strokeWidth={2}
      aria-hidden
    />
  )
}

/** 오류·없는 공고일 때도 뒤로 갈 수 있게 */
function DetailShell({ onBack, children }: { onBack: () => void; children: ReactNode }) {
  return (
    <div className="mx-auto min-h-dvh w-full max-w-[480px] bg-canvas pt-[env(safe-area-inset-top)]">
      <div className="px-2 pt-2">
        <IconButton aria-label="뒤로" onClick={onBack}>
          <BackIcon />
        </IconButton>
      </div>
      <div className="px-4 pt-10">{children}</div>
    </div>
  )
}

function DetailSkeleton() {
  return (
    <div className="mx-auto min-h-dvh w-full max-w-[480px] bg-canvas" aria-busy="true" aria-label="공고 불러오는 중">
      <div className="h-90 skeleton" />
      <div className="flex flex-col gap-3 px-5 pt-5">
        <div className="h-6.5 w-40 rounded-badge skeleton" />
        <div className="h-8 w-48 rounded skeleton" />
        <div className="h-5 w-64 rounded skeleton" />
      </div>
      <div className="mx-4 mt-5 h-80 rounded-sheet skeleton" />
    </div>
  )
}
