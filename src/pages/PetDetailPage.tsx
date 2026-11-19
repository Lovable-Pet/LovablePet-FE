import { useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { Box, Cake, CalendarDays, ChevronRight, Link2, MapPin, PawPrint, Phone, Ruler, Wand2 } from 'lucide-react'
import { Link, useParams } from 'react-router'
import { ApiError } from '../apis/apiError'
import type { PetDetail } from '../apis/dto/pet.dto'
import { useFlash } from '../app/flash'
import { Badge } from '../components/Badge/Badge'
import { Button } from '../components/Button/Button'
import { buttonClass } from '../components/Button/buttonClass'
import { IconButton } from '../components/IconButton/IconButton'
import { LoadingScreen } from '../components/LoadingScreen/LoadingScreen'
import { PageHeader } from '../components/PageHeader/PageHeader'
import { StateView } from '../components/StateView/StateView'
import { cn } from '../components/utils/cn'
import { NEUTERED_LABEL, PUPPY_NOTICE, TEMPLATE_LABEL } from '../constants/pet'
import { useAuth } from '../features/auth/useAuth'
import { FavoriteButton } from '../features/favorite/components/FavoriteButton'
import { similarSizeLinkOf } from '../features/pet/browseQuery'
import { PetPhoto } from '../features/pet/components/PetPhoto'
import { SexSymbol } from '../features/pet/components/SexSymbol'
import { usePetDetail } from '../features/pet/queries'
import { useGoBack } from '../hooks/useGoBack'
import {
  adoptionStateOf,
  formatAge,
  formatMonthDay,
  formatWeight,
  isLikelyPuppy,
  isMetFamily,
  toTelHref,
  toWithersCm,
  waitingDays,
} from '../utils/pet'

// /pets/:petId — 공고 상세
export function PetDetailPage() {
  const { petId } = useParams()
  const id = Number(petId)
  const goBack = useGoBack('/')
  const { data: pet, isPending, isError, error, refetch } = usePetDetail(id)

  const notFound = !Number.isInteger(id) || id <= 0 || (isError && error instanceof ApiError && error.status === 404)
  if (notFound || isError) {
    return (
      <div className="app-column">
        <PageHeader onBack={goBack} />
        {notFound ? (
          <StateView
            title="공고를 찾을 수 없어요"
            description="공고가 내려갔거나 주소가 잘못됐어요."
            action={
              <Link to="/" replace className={buttonClass()}>
                다른 유기견 둘러보기
              </Link>
            }
          />
        ) : (
          <StateView
            tone="error"
            title="공고를 불러오지 못했어요"
            description="인터넷 연결을 확인하고 다시 시도해 주세요."
            action={
              <Button variant="outline" onClick={() => refetch()}>
                다시 시도
              </Button>
            }
          />
        )}
      </div>
    )
  }
  if (isPending) return <LoadingScreen description="공고를 불러오고 있어요" />
  return <Detail pet={pet} onBack={goBack} />
}

function Detail({ pet, onBack }: { pet: PetDetail; onBack: () => void }) {
  const { isAdmin } = useAuth()
  const showFlash = useFlash()
  const state = adoptionStateOf(pet)
  const weight = formatWeight(pet.weightKg) ?? pet.weightText

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      showFlash('주소를 복사했어요')
    } catch {
      showFlash('주소를 복사하지 못했어요')
    }
  }

  // 공고에 적힌 사실을 꼬리표로 보여 준다
  const tags = [
    pet.color && { label: pet.color, tone: 'sky' },
    { label: NEUTERED_LABEL[pet.neutered].replace(/\s/g, ''), tone: 'sky' },
    pet.model && { label: 'AR로볼수있어요', tone: 'violet' },
    state === 'ADOPTABLE' && { label: '지금입양가능', tone: 'violet' },
  ].filter((tag): tag is { label: string; tone: string } => !!tag)

  return (
    <div className="app-column pb-[calc(112px+env(safe-area-inset-bottom))]">
      <PageHeader
        onBack={onBack}
        trailing={
          <>
            <IconButton aria-label="주소 복사" onClick={copyLink}>
              <Link2 className="size-5.5" strokeWidth={2} aria-hidden />
            </IconButton>
            <FavoriteButton petId={pet.id} favorited={pet.favorited} name={pet.kindName} />
          </>
        }
      />

      <Gallery pet={pet} />

      <main className="px-5 pt-5">
        <div className="flex items-center gap-2.5">
          <h1 className="min-w-0 truncate font-display text-[1.75rem] leading-tight">{pet.kindName}</h1>
          {pet.sex !== 'Q' && (
            <span className="flex h-7 shrink-0 items-center gap-1 rounded-full bg-pink-soft px-2.5 text-label font-extrabold text-primary-deep">
              <SexSymbol sex={pet.sex} />
              {pet.sex === 'F' ? '여아' : '남아'}
            </span>
          )}
          <span className="ml-auto shrink-0 text-emphasis font-bold tabular-nums">{weight}</span>
        </div>

        <StateBanner pet={pet} state={state} />

        <Section title="유기견에 대해 알려드려요!">
          <p className="text-body leading-relaxed">{pet.specialMark || '공고에 적힌 특징이 없어요.'}</p>
          <ul className="mt-3.5 flex flex-wrap gap-2">
            <InfoChip icon={<Cake className="size-4 text-primary" strokeWidth={2.2} aria-hidden />}>{formatAge(pet.ageText)}</InfoChip>
            <InfoChip icon={<MapPin className="size-4 fill-primary text-surface" strokeWidth={2} aria-hidden />}>{pet.orgName}</InfoChip>
            <InfoChip icon={<CalendarDays className="size-4 text-primary" strokeWidth={2.2} aria-hidden />}>
              <span className="tabular-nums">
                공고 {formatMonthDay(pet.noticeStart)}~{formatMonthDay(pet.noticeEnd)}
              </span>
            </InfoChip>
          </ul>
        </Section>

        <Section title="이런 유기견이에요!">
          <ul className="flex flex-wrap gap-2">
            {tags.map((tag) => (
              <li
                key={tag.label}
                className={cn(
                  'flex h-8 items-center rounded-full px-3 text-label font-bold',
                  tag.tone === 'sky' ? 'bg-sky-soft text-sky-deep' : 'bg-violet-soft text-violet-deep',
                )}
              >
                #{tag.label}
              </li>
            ))}
          </ul>
        </Section>

        <SizeCard pet={pet} isAdmin={isAdmin} />

        <Section title="여기서 기다리고 있어요!">
          <div className="rounded-card bg-surface p-4 shadow-soft">
            <p className="font-display text-emphasis">{pet.careName}</p>
            <p className="mt-1 text-label text-ink-soft">{pet.careAddr}</p>
            <p className="mt-2 text-caption text-ink-mute">
              발견된 곳 {pet.happenPlace} / 공고번호 {pet.noticeNo}
            </p>
            {pet.careTel && (
              <a href={toTelHref(pet.careTel)} className={buttonClass({ variant: 'soft', className: 'mt-3.5' })}>
                <Phone className="size-4.5" strokeWidth={2.2} aria-hidden />
                <span className="tabular-nums">{pet.careTel}</span>
              </a>
            )}
          </div>
        </Section>
      </main>

      <BottomBar pet={pet} closed={state === 'CLOSED'} />
    </div>
  )
}

/**
 * 사진을 옆으로 넘겨 본다. 둥근 틀 안에 들어간다.
 * 손가락으로 밀기, 마우스로 끌기, 아래 점, 키보드 좌우 키로 넘길 수 있다
 */
function Gallery({ pet }: { pet: PetDetail }) {
  const trackRef = useRef<HTMLUListElement>(null)
  const drag = useRef<{ startX: number; startScroll: number; moved: boolean } | null>(null)
  const [index, setIndex] = useState(0)
  const photos = pet.photoUrls
  const frame = 'aspect-[4/3.1] w-full'

  if (photos.length === 0) {
    return (
      <div className="px-4">
        <PetPhoto src={null} alt={`${pet.kindName} 공고 사진`} seed={pet.id} className={cn(frame, 'rounded-[1.75rem]')} />
      </div>
    )
  }

  const goTo = (next: number) => {
    const track = trackRef.current
    if (!track) return
    const clamped = Math.max(0, Math.min(photos.length - 1, next))
    track.scrollTo({ left: clamped * track.clientWidth, behavior: 'smooth' })
  }

  // 마우스로 끌어서 넘기기 (터치는 브라우저가 알아서 민다)
  const onPointerDown = (event: ReactPointerEvent<HTMLUListElement>) => {
    if (event.pointerType !== 'mouse' || event.button !== 0) return
    drag.current = { startX: event.clientX, startScroll: event.currentTarget.scrollLeft, moved: false }
  }
  const onPointerMove = (event: ReactPointerEvent<HTMLUListElement>) => {
    const state = drag.current
    if (!state) return
    const delta = event.clientX - state.startX
    if (!state.moved && Math.abs(delta) < 4) return
    if (!state.moved) {
      state.moved = true
      event.currentTarget.setPointerCapture(event.pointerId)
      // 끄는 동안에는 자석(스냅)을 끈다
      event.currentTarget.style.scrollSnapType = 'none'
    }
    event.currentTarget.scrollLeft = state.startScroll - delta
  }
  const onPointerEnd = (event: ReactPointerEvent<HTMLUListElement>) => {
    const state = drag.current
    drag.current = null
    if (!state?.moved) return
    const track = event.currentTarget
    track.style.scrollSnapType = ''
    const delta = event.clientX - state.startX
    const start = Math.round(state.startScroll / track.clientWidth)
    // 사진 너비의 15% 넘게 끌었으면 다음(이전) 사진으로
    goTo(Math.abs(delta) > track.clientWidth * 0.15 ? start + (delta < 0 ? 1 : -1) : start)
  }

  return (
    <div className="px-4">
      <div
        role="group"
        aria-roledescription="사진 넘겨 보기"
        aria-label={`${pet.kindName} 공고 사진 ${photos.length}장`}
        className="relative rounded-[1.75rem] shadow-soft"
      >
        <ul
          ref={trackRef}
          tabIndex={photos.length > 1 ? 0 : undefined}
          onScroll={(event) => {
            const { scrollLeft, clientWidth } = event.currentTarget
            setIndex(Math.round(scrollLeft / clientWidth))
          }}
          onKeyDown={(event) => {
            if (event.key === 'ArrowRight') goTo(index + 1)
            else if (event.key === 'ArrowLeft') goTo(index - 1)
            else return
            event.preventDefault()
          }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerEnd}
          onPointerCancel={onPointerEnd}
          className={cn(
            'no-scrollbar flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain rounded-[1.75rem] -outline-offset-4',
            photos.length > 1 && 'cursor-grab active:cursor-grabbing',
          )}
        >
          {photos.map((url, photoIndex) => (
            <li key={url} className="w-full shrink-0 snap-center snap-always">
              <PetPhoto
                src={url}
                alt={`${pet.kindName} 공고 사진 ${photoIndex + 1}`}
                seed={pet.id + photoIndex}
                eager={photoIndex === 0}
                className={cn(frame, 'pointer-events-none select-none')}
              />
            </li>
          ))}
        </ul>

        {photos.length > 1 && (
          <>
            <div className="absolute inset-x-0 bottom-1 flex justify-center">
              {photos.map((url, dotIndex) => (
                <button
                  key={url}
                  type="button"
                  aria-label={`${dotIndex + 1}번째 사진 보기`}
                  aria-current={dotIndex === index ? 'true' : undefined}
                  onClick={() => goTo(dotIndex)}
                  className="flex h-8 items-center px-1 -outline-offset-2"
                >
                  <span
                    className={cn(
                      'block h-2 rounded-full shadow-[0_0_0_1px_rgb(0_0_0/0.12)] transition-[width,background-color] duration-200',
                      dotIndex === index ? 'w-5 bg-primary' : 'w-2 bg-white',
                    )}
                  />
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function InfoChip({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <li className="flex h-9 items-center gap-1.5 rounded-full bg-surface px-3 text-label font-bold shadow-soft">
      {icon}
      {children}
    </li>
  )
}

function StateBanner({ pet, state }: { pet: PetDetail; state: ReturnType<typeof adoptionStateOf> }) {
  const similar = similarSizeLinkOf(pet.weightKg)

  if (state === 'ADOPTABLE') {
    const days = waitingDays(pet.noticeStart)
    return (
      <div className="mt-5 flex items-center gap-3 rounded-card bg-mint-soft px-4 py-3.5">
        <Badge tone="success" className="bg-mint">
          입양 가능
        </Badge>
        <p className="text-label text-ink-soft">
          <span className="font-extrabold text-ink tabular-nums">{days}일째</span> 가족을 기다리고 있어요
        </p>
      </div>
    )
  }
  if (state === 'IN_NOTICE') {
    return (
      <div className="mt-5 rounded-card bg-apricot-soft px-4 py-3.5">
        <Badge tone="warning" className="bg-apricot">
          공고 기간
        </Badge>
        <p className="mt-2 text-label text-ink-soft">
          원래 가족을 찾는 기간이에요.{' '}
          <span className="font-extrabold text-ink tabular-nums">{formatMonthDay(pet.noticeEnd)}</span>이 지나면 입양할 수
          있어요.
        </p>
      </div>
    )
  }
  return (
    <div className="mt-5 rounded-card bg-pink-soft px-4 py-3.5">
      <Badge className="bg-primary text-white">보호 종료</Badge>
      <p className="mt-2 text-label text-ink-soft">
        {isMetFamily(pet.processState) ? '가족을 만나 보호소를 떠났어요.' : '이 공고는 보호가 끝났어요.'}
      </p>
      {similar && (
        <Link to={similar.to} className={buttonClass({ variant: 'outline', size: 'sm', className: 'mt-3' })}>
          비슷한 크기({similar.range}) 유기견 보기
        </Link>
      )}
    </div>
  )
}

/** 이 서비스의 중심: 실제 크기. 모델이 있으면 체고를 익숙한 물건 높이와 나란히 보여 준다 */
function SizeCard({ pet, isAdmin }: { pet: PetDetail; isAdmin: boolean }) {
  const model = pet.model
  const adminLink = isAdmin && (
    <Link to={`/admin/pets/${pet.id}/model`} className={buttonClass({ variant: 'outline', size: 'sm', className: 'mt-3' })}>
      <Wand2 className="size-4" strokeWidth={2} aria-hidden />
      관리자: AR 모델 {model ? '다시 만들기' : '만들기'}
    </Link>
  )

  if (!model) {
    return (
      <section aria-labelledby="size-title" className="mt-7 rounded-card bg-surface p-4 shadow-soft">
        <h2 id="size-title" className="font-display text-heading">
          실제 크기
        </h2>
        <p className="mt-1 text-label text-ink-soft">
          아직 3D 모델이 없어요. 준비되면 우리 집에 실제 크기로 놓아 볼 수 있어요.
        </p>
        {adminLink}
      </section>
    )
  }

  const withersCm = toWithersCm(model.withersM)
  return (
    <section aria-labelledby="size-title" className="mt-7 rounded-card bg-apricot-soft p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 id="size-title" className="flex items-center gap-1.5 font-display text-heading">
          <Ruler className="size-5 text-apricot-deep" strokeWidth={2.2} aria-hidden />
          실제 크기
        </h2>
        {TEMPLATE_LABEL[model.template] && <Badge tone="warning">{TEMPLATE_LABEL[model.template]}</Badge>}
      </div>
      <HeightCompare withersCm={withersCm} />
      {isLikelyPuppy(pet.birthYear) && <p className="mt-3 text-caption text-apricot-deep">{PUPPY_NOTICE}</p>}
      {adminLink}
    </section>
  )
}

/** 체고를 집 안 물건 높이와 같은 눈금에 세운 막대 */
const REFERENCES = [
  { label: '의자 앉는 곳', cm: 45 },
  { label: '식탁', cm: 72 },
]

function HeightCompare({ withersCm }: { withersCm: number }) {
  const max = Math.max(withersCm, ...REFERENCES.map((item) => item.cm))
  const bars = [{ label: '어깨 높이', cm: withersCm, isDog: true }, ...REFERENCES.map((item) => ({ ...item, isDog: false }))]
  return (
    <figure className="mt-4">
      <div className="flex h-32 items-end gap-3 border-b-2 border-apricot-deep/25 px-2">
        {bars.map((bar) => (
          <div key={bar.label} className="flex flex-1 flex-col items-center justify-end" style={{ height: '100%' }}>
            <span className={cn('mb-1 text-label tabular-nums', bar.isDog ? 'font-extrabold text-ink' : 'text-ink-mute')}>
              {bar.cm}cm
            </span>
            <span
              aria-hidden
              className={cn('w-full rounded-t-xl', bar.isDog ? 'bg-apricot' : 'bg-surface')}
              style={{ height: `${Math.max(8, (bar.cm / max) * 76)}%` }}
            />
          </div>
        ))}
      </div>
      <figcaption className="flex gap-3 px-2 pt-1.5">
        {bars.map((bar) => (
          <span key={bar.label} className={cn('flex-1 text-center text-caption', bar.isDog ? 'font-bold text-ink' : 'text-ink-mute')}>
            {bar.label}
          </span>
        ))}
      </figcaption>
    </figure>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-7">
      <h2 className="mb-2.5 flex items-center gap-1.5 font-display text-heading">
        <PawPrint className="size-5 fill-apricot text-apricot" strokeWidth={1.5} aria-hidden />
        {title}
      </h2>
      {children}
    </section>
  )
}

/** 화면 아래에 붙는 주요 동작: AR 로 놓아 보기(모델이 있을 때), 보호소에 전화 */
function BottomBar({ pet, closed }: { pet: PetDetail; closed: boolean }) {
  const hasTel = !!pet.careTel && !closed
  if (!pet.model && !hasTel) return null
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center">
      <div className="pointer-events-auto flex w-full max-w-[480px] gap-2.5 bg-gradient-to-t from-canvas from-70% to-transparent px-5 pt-6 pb-[calc(16px+env(safe-area-inset-bottom))]">
        {hasTel && (
          <a
            href={toTelHref(pet.careTel)}
            className={buttonClass({ variant: pet.model ? 'outline' : 'primary', size: 'lg', full: !pet.model })}
          >
            <Phone className="size-5" strokeWidth={2} aria-hidden />
            {pet.model ? '전화' : '보호소에 전화하기'}
          </a>
        )}
        {pet.model && (
          <Link to={`/pets/${pet.id}/ar`} className={buttonClass({ variant: 'sky', size: 'lg', full: true })}>
            <Box className="size-5" strokeWidth={2.2} aria-hidden />
            AR로 보기
            <ChevronRight className="size-5" strokeWidth={2.5} aria-hidden />
          </Link>
        )}
      </div>
    </div>
  )
}
