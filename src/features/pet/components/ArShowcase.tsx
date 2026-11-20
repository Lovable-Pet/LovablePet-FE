import { lazy, Suspense, useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react'
import { Box, RefreshCw } from 'lucide-react'
import { Link } from 'react-router'
import { resolveModelUrl } from '../../../apis/pet'
import type { PetSummary } from '../../../apis/dto/pet.dto'
import { buttonClass } from '../../../components/Button/buttonClass'
import { PawDots } from '../../../components/LoadingScreen/LoadingScreen'
import { cn } from '../../../components/utils/cn'
import { formatWeight, toWithersCm, waitingDays } from '../../../utils/pet'
import { usePetDetail, usePetList } from '../queries'
import { PetPhoto } from './PetPhoto'
import { SexSymbol } from './SexSymbol'

const ModelPreview = lazy(() => import('./ModelPreview'))

/** 양옆 조각 사진의 너비와, 가운데 카드와의 간격 (px) */
const SLIVER = 30
const GAP = 6
/** 이만큼 넘게 밀면 다음(이전) 유기견으로 넘어간다 (px) */
const SWIPE_DISTANCE = 24
/** 이만큼 넘게 움직이면 누르기가 아니라 끌기로 본다 (px) */
const DRAG_START = 6
/** 점은 이만큼만 보인다 (더 많으면 가장자리 점이 작아진다) */
const DOT_WINDOW = 5

const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)'
const MOVE = ['left', 'top', 'width', 'height', 'border-radius'].map((property) => `${property} 240ms ${EASE}`).join(', ')

const chipClass =
  'absolute top-3 left-3 flex h-8 items-center gap-1.5 rounded-full pr-3 pl-2.5 text-label font-extrabold shadow-[0_2px_8px_rgb(102_59_43/0.22)]'
const faceClass = 'absolute inset-0 overflow-hidden rounded-[inherit] bg-pink-soft shadow-soft [backface-visibility:hidden]'

/**
 * 홈 맨 위: AR 모델이 있는 유기견을 한 마리씩 넘겨 보는 캐러셀.
 * 가운데 카드가 크게 보이고 양옆에 이전·다음 유기견이 세로 조각으로 보인다. 맨 끝에서 처음으로 이어진다 (목록을 끝까지 받은 뒤부터).
 * 넘기기: 옆 조각 누르기, 옆으로 밀기(끌기), 키보드 좌우 키.
 * 가운데 카드를 누르면 뒤집혀 3D 모델 그림이 나온다 (다시 누르면 사진으로).
 * 상세 화면·AR 화면으로는 카드 아래 글줄에서 간다. 모델이 있는 유기견이 없으면 아무것도 그리지 않는다
 */
export function ArShowcase() {
  const list = usePetList({ hasModel: true, sort: 'MIXED' })
  const pets = list.data?.pages.flatMap((page) => page.items) ?? []
  const count = pets.length
  const allLoaded = !list.hasNextPage
  const [position, setPosition] = useState(0)
  const index = count > 0 ? Math.min(position, count - 1) : 0
  const [flipped, setFlipped] = useState(false)
  // 한 번이라도 뒤집었으면 모델 정보(그림 주소·어깨 높이)를 받아 둔다
  const [modelWanted, setModelWanted] = useState(false)
  const [dragX, setDragX] = useState(0)
  const drag = useRef<{ startX: number; moved: boolean } | null>(null)
  const suppressClick = useRef(false)
  const active: PetSummary | undefined = pets[index]
  // 목록에는 모델 주소가 없어서, 뒤집을 때 그 유기견의 상세를 받는다
  const detail = usePetDetail(modelWanted && active ? active.id : 0)
  const model = detail.data?.id === active?.id ? detail.data?.model : undefined
  // 서버가 찍어 둔 그림이 있으면 그 그림만 보여 준다. 없거나 못 불러오면 모델 파일을 받아 같은 구도로 그린다
  const [failedPreview, setFailedPreview] = useState<string | null>(null)
  const previewUrl = model?.previewUrl ?? null
  const previewSrc = previewUrl && failedPreview !== resolveModelUrl(previewUrl) ? resolveModelUrl(previewUrl) : null

  // 처음부터 왼쪽 조각(맨 마지막 유기견)이 보이고 한 바퀴 돌 수 있게, 남은 쪽을 이어서 끝까지 받는다
  const { hasNextPage, isFetchingNextPage, isFetchNextPageError, fetchNextPage } = list
  useEffect(() => {
    if (hasNextPage && !isFetchingNextPage && !isFetchNextPageError) void fetchNextPage()
  }, [hasNextPage, isFetchingNextPage, isFetchNextPageError, fetchNextPage])

  if (!active) return null

  /** 가운데에서 한 칸 옆의 유기견 번호. 없으면 null (아직 다 못 받았을 때 맨 앞·맨 뒤, 한 마리뿐일 때) */
  const neighborOf = (direction: 1 | -1) => {
    const next = index + direction
    if (next >= 0 && next < count) return next
    if (!allLoaded || count < 2) return null
    return (next + count) % count
  }
  const prev = count >= 3 ? neighborOf(-1) : null
  const next = neighborOf(1)

  const go = (direction: 1 | -1) => {
    const target = direction === 1 ? next : (prev ?? (count === 2 ? next : null))
    if (target === null) return
    setPosition(target)
    setFlipped(false)
  }
  const flip = () => {
    setModelWanted(true)
    setFlipped((current) => !current)
  }

  // 옆으로 끌어서 넘기기
  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    suppressClick.current = false
    if (count < 2 || (event.pointerType === 'mouse' && event.button !== 0)) return
    drag.current = { startX: event.clientX, moved: false }
  }
  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const state = drag.current
    if (!state) return
    const delta = event.clientX - state.startX
    if (!state.moved && Math.abs(delta) < DRAG_START) return
    if (!state.moved) {
      state.moved = true
      event.currentTarget.setPointerCapture(event.pointerId)
    }
    setDragX(delta)
  }
  const onPointerEnd = (event: ReactPointerEvent<HTMLDivElement>) => {
    const state = drag.current
    drag.current = null
    if (!state?.moved) return
    // 끌고 난 뒤에 따라오는 클릭으로 카드가 뒤집히거나 넘어가지 않게
    suppressClick.current = true
    window.setTimeout(() => (suppressClick.current = false), 0)
    const delta = event.clientX - state.startX
    setDragX(0)
    if (Math.abs(delta) > SWIPE_DISTANCE) go(delta < 0 ? 1 : -1)
  }
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowRight') go(1)
    else if (event.key === 'ArrowLeft') go(-1)
    else return
    event.preventDefault()
  }

  /** 카드 자리. 옆에 조각이 없으면 가운데 카드가 그 자리까지 넓어진다 */
  const leftSpace = prev !== null ? SLIVER + GAP : 0
  const rightSpace = next !== null ? SLIVER + GAP : 0
  const slotOf = (rel: -1 | 0 | 1): CSSProperties =>
    rel === 0
      ? { left: leftSpace, top: 0, width: `calc(100% - ${leftSpace + rightSpace}px)`, height: '100%', borderRadius: '1.75rem', zIndex: 2 }
      : { left: rel < 0 ? 0 : `calc(100% - ${SLIVER}px)`, top: '11%', width: SLIVER, height: '78%', borderRadius: '0.9375rem', zIndex: 1 }

  const cards: { petIndex: number; rel: -1 | 0 | 1 }[] = [{ petIndex: index, rel: 0 }]
  if (prev !== null && prev !== index) cards.push({ petIndex: prev, rel: -1 })
  if (next !== null && next !== index && next !== prev) cards.push({ petIndex: next, rel: 1 })

  const weight = formatWeight(active.weightKg)

  return (
    <section aria-labelledby="ar-showcase-title" className="px-5 pt-3">
      <h2 id="ar-showcase-title" className="flex items-center gap-1.5 font-display text-heading">
        <Box className="size-5 text-primary" strokeWidth={2.2} aria-hidden />
        AR로 미리 만나 보세요
      </h2>

      <div
        role="group"
        aria-roledescription="유기견 넘겨 보기"
        aria-label={`AR로 볼 수 있는 유기견, ${index + 1}번째`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        onClickCapture={(event) => {
          if (!suppressClick.current) return
          suppressClick.current = false
          event.preventDefault()
          event.stopPropagation()
        }}
        onKeyDown={onKeyDown}
        className="relative mt-3 aspect-[4/3.1] w-full touch-pan-y select-none"
        style={{
          transform: `translateX(${Math.round(dragX * 0.45)}px)`,
          transition: dragX ? 'none' : `transform 240ms ${EASE}`,
        }}
      >
        {cards.map(({ petIndex, rel }) => {
          const pet = pets[petIndex]
          const isActive = rel === 0
          const showModel = isActive && flipped
          const name = `${pet.kindName} ${formatWeight(pet.weightKg) ?? ''}`.trim()
          // 뒤집기가 반쯤 돌았을 때 안 보이는 면을 완전히 감춘다
          const faceStyle = (hidden: boolean): CSSProperties => ({ visibility: hidden ? 'hidden' : 'visible', transition: 'visibility 0s linear 210ms' })

          return (
            <div key={pet.id} className="absolute animate-fade-in [perspective:1000px]" style={{ ...slotOf(rel), transition: MOVE }}>
              <div
                className="absolute inset-0 rounded-[inherit] transition-transform duration-[420ms] [transform-style:preserve-3d]"
                style={{ transform: showModel ? 'rotateY(180deg)' : 'rotateY(0deg)', transitionTimingFunction: EASE }}
              >
                {/* 앞면: 사진 */}
                <button
                  type="button"
                  inert={showModel}
                  aria-label={isActive ? `${name} 사진, 누르면 3D 모델로 바뀌어요` : `${name} 보기`}
                  onClick={() => (isActive ? flip() : go(rel < 0 ? -1 : 1))}
                  className={cn(faceClass, 'block p-0')}
                  style={faceStyle(showModel)}
                >
                  <PetPhoto src={pet.thumbnailUrl} alt="" seed={pet.id} eager className="pointer-events-none size-full" />
                  {isActive && (
                    <span className={cn(chipClass, 'bg-surface text-ink')}>
                      <RefreshCw className="size-4" strokeWidth={2.6} aria-hidden />
                      사진
                    </span>
                  )}
                </button>

                {/* 뒷면: 3D 모델 그림. 누르면 사진으로 돌아간다 */}
                {isActive && (
                  <button
                    type="button"
                    inert={!showModel}
                    aria-label={`${name} 3D 모델, 누르면 사진으로 바뀌어요`}
                    onClick={flip}
                    className={cn(faceClass, 'block bg-linear-to-b from-pink-soft to-canvas p-0 [transform:rotateY(180deg)]')}
                    style={faceStyle(!showModel)}
                  >
                    {previewSrc ? (
                      <img
                        src={previewSrc}
                        alt=""
                        draggable={false}
                        onError={() => setFailedPreview(previewSrc)}
                        className="pointer-events-none block size-full object-contain"
                      />
                    ) : model ? (
                      <Suspense fallback={<ModelLoading />}>
                        <ModelPreview src={resolveModelUrl(model.glbUrl)} alt="" />
                      </Suspense>
                    ) : detail.isError || (detail.isSuccess && model === null) ? (
                      <span className="absolute inset-0 flex items-center justify-center px-6 text-center text-label font-bold text-ink-soft">
                        3D 모델을 불러오지 못했어요
                      </span>
                    ) : (
                      modelWanted && <ModelLoading />
                    )}
                    <span className={cn(chipClass, 'bg-primary-deep text-white')}>
                      <RefreshCw className="size-4" strokeWidth={2.6} aria-hidden />
                      AR
                    </span>
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <Dots count={count} index={index} hasMore={!allLoaded} />

      {/* 글줄: 왼쪽 글은 상세 화면으로, 오른쪽 버튼은 사진 면에서 상세·AR 면에서 AR 화면으로 */}
      <div className="mt-1 flex items-center gap-3">
        <Link to={`/pets/${active.id}`} className="min-w-0 flex-1 rounded-xl py-1">
          <p className="flex items-baseline gap-1.5 font-display text-emphasis">
            <span className="truncate">{active.kindName}</span>
            <SexSymbol sex={active.sex} className="text-body" />
            {weight && <span className="shrink-0 font-sans text-label font-bold tabular-nums">{weight}</span>}
          </p>
          <p className="mt-0.5 truncate text-caption text-ink-soft">
            {flipped ? (
              <>
                {model && <span className="tabular-nums">어깨 높이 {toWithersCm(model.withersM)}cm · </span>}
                실제 크기로 놓아 봐요
              </>
            ) : (
              <>
                {active.careName} · <span className="tabular-nums">{waitingDays(active.noticeStart)}일째</span> 기다려요
              </>
            )}
          </p>
        </Link>
        {flipped ? (
          <Link to={`/pets/${active.id}/ar`} className={buttonClass({ size: 'sm' })}>
            AR로 보기
          </Link>
        ) : (
          <Link to={`/pets/${active.id}`} className={buttonClass({ variant: 'soft', size: 'sm' })}>
            자세히 보기
          </Link>
        )}
      </div>
    </section>
  )
}

function ModelLoading() {
  return (
    <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
      <PawDots label="3D 모델을 불러오고 있어요" />
    </span>
  )
}

/** 지금 몇 번째인지 알려 주는 점. 많아도 다섯 개만 보이고, 더 있는 쪽 끝의 점은 작다 */
function Dots({ count, index, hasMore }: { count: number; index: number; hasMore: boolean }) {
  if (count < 2) return <div className="h-3" />
  const size = Math.min(DOT_WINDOW, count)
  const start = Math.max(0, Math.min(index - Math.floor(size / 2), count - size))
  return (
    <div aria-hidden className="mt-2 flex h-6 items-center justify-center gap-1.5">
      {Array.from({ length: size }, (_, offset) => {
        const dotIndex = start + offset
        const current = dotIndex === index
        const moreBefore = offset === 0 && dotIndex > 0
        const moreAfter = offset === size - 1 && (dotIndex < count - 1 || hasMore)
        return (
          <span
            key={dotIndex}
            className={cn(
              'block rounded-full transition-[width,height,background-color] duration-200',
              current ? 'h-1.5 w-4.5 bg-primary-deep' : moreBefore || moreAfter ? 'size-1 bg-line' : 'size-1.5 bg-line',
            )}
          />
        )
      })}
    </div>
  )
}
