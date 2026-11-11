import { useMemo } from 'react'
import { Box, SlidersVertical } from 'lucide-react'
import { useSearchParams } from 'react-router'
import type { PetSort } from '../apis/dto/pet.dto'
import { Button } from '../components/Button/Button'
import { Chip } from '../components/Chip/Chip'
import { LoadMore } from '../components/LoadMore/LoadMore'
import { Logo } from '../components/Logo/Logo'
import { StateView } from '../components/StateView/StateView'
import {
  activeFilterCount,
  parseBrowseQuery,
  toListParams,
  toSearchParams,
  weightLabelOf,
  type BrowseFilters,
} from '../features/pet/browseQuery'
import { FilterSheet } from '../features/pet/components/FilterSheet'
import { PetCard, PetCardSkeleton } from '../features/pet/components/PetCard'
import { SortToggle } from '../features/pet/components/SortToggle'
import { WaitingRail } from '../features/pet/components/WaitingRail'
import { usePetList, useWaitingPets } from '../features/pet/queries'
import { useEntranceStagger } from '../hooks/useEntranceStagger'
import { useOverlay } from '../hooks/useOverlay'

export function BrowsePage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const query = useMemo(() => parseBrowseQuery(searchParams), [searchParams])
  const listParams = useMemo(() => toListParams(query), [query])
  // 필터 시트는 방문 기록에 남겨서 뒤로가기로 닫힌다
  const filterSheet = useOverlay('filter')

  const list = usePetList(listParams)
  // 오래 기다린 순으로 보는 중이면 아래 목록과 겹치므로 가로 목록을 숨긴다
  const showWaiting = query.sort !== 'OLDEST'
  const waiting = useWaitingPets(listParams, showWaiting)

  // 같은 화면 안에서 조건만 바뀌니 스크롤은 그대로 둔다
  const setQuery = (next: typeof query) => setSearchParams(toSearchParams(next), { preventScrollReset: true })
  // 시트 기록을 새 조건 주소로 바꿔서 시트가 같이 닫힌다 (뒤로가면 시트를 열기 전 조건)
  const applyFilters = (filters: BrowseFilters) =>
    setSearchParams(toSearchParams({ ...filters, sort: query.sort }), { replace: true, preventScrollReset: true })

  const filterCount = activeFilterCount(query)
  const weightLabel = weightLabelOf(query)
  const appliedChips = [query.region, query.kind, weightLabel].filter((label): label is string => Boolean(label))

  const pages = list.data?.pages ?? []
  const pets = pages.flatMap((page) => page.items)
  const total = pages[0]?.totalElements
  const waitingPets = waiting.data?.items ?? []

  // 새로 받은 페이지만 아래에서 올라온다 (캐시에서 바로 보인 목록·뒤로가기는 그대로)
  const animationKey = JSON.stringify(listParams)
  const entrance = useEntranceStagger(pages.length, animationKey)

  return (
    <>
      <header className="flex h-14 items-center pt-3 pr-4 pb-1 pl-5">
        <Logo withText />
      </header>

      <section className="px-5 pt-4 pb-5">
        <h1 className="text-display font-bold">
          만나러 가기 전에,
          <br />
          우리 집에서 크기부터
        </h1>
        <p className="mt-2 text-body-lg text-ink-tertiary">
          공고 사진으로는 알 수 없는 실제 크기를
          <br />
          AR로 우리 집 바닥에 놓아 확인해요.
        </p>
      </section>

      <div className="flex items-center gap-2 overflow-x-auto px-5 no-scrollbar">
        <button
          type="button"
          onClick={filterSheet.open}
          className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-ink px-3.5 text-body font-semibold text-white transition hover:bg-ink-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent active:scale-99"
        >
          <SlidersVertical className="size-4" strokeWidth={2} aria-hidden />
          필터{filterCount > 0 && ` ${filterCount}`}
        </button>
        <Chip
          variant="accent"
          selected={query.hasModel === true}
          onClick={() => setQuery({ ...query, hasModel: query.hasModel ? undefined : true })}
        >
          <Box className="size-4" strokeWidth={2} aria-hidden />
          AR로 볼 수 있는 유기견
        </Chip>
      </div>
      {appliedChips.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-5 pt-2.5">
          {appliedChips.map((label) => (
            <Chip key={label} size="sm" onClick={filterSheet.open} aria-label={`${label} 필터 바꾸기`}>
              {label}
            </Chip>
          ))}
        </div>
      )}

      {showWaiting && (waiting.isPending || waitingPets.length > 0) && (
        <WaitingRail pets={waitingPets} isLoading={waiting.isPending} animationKey={animationKey} />
      )}

      <section aria-labelledby="list-title" className="mt-6 px-5 pb-24">
        <div className="flex items-center justify-between">
          <p id="list-title" className="text-body text-ink-secondary">
            입양 가능한 유기견{' '}
            <strong className="font-mono font-semibold text-ink">{total?.toLocaleString() ?? '–'}</strong>
            마리
          </p>
          <SortToggle value={query.sort} onChange={(sort: PetSort) => setQuery({ ...query, sort })} />
        </div>

        <div className="mt-3.5">
          {list.isPending ? (
            <div className="grid grid-cols-2 gap-x-3 gap-y-4" aria-busy="true" aria-label="목록 불러오는 중">
              {Array.from({ length: 6 }, (_, index) => (
                <PetCardSkeleton key={index} />
              ))}
            </div>
          ) : list.isError ? (
            <StateView
              tone="error"
              title="유기견 목록을 불러오지 못했어요"
              description="잠시 후 다시 시도해 주세요."
              action={
                <Button variant="outline" size="md" onClick={() => list.refetch()}>
                  다시 시도
                </Button>
              }
            />
          ) : pets.length === 0 ? (
            <StateView
              title="조건에 맞는 유기견이 없어요"
              description="필터를 바꾸거나 초기화해 보세요."
              action={
                <Button variant="dark" size="md" onClick={() => setQuery({ sort: query.sort })}>
                  필터 초기화
                </Button>
              }
            />
          ) : (
            <>
              <ul className="grid grid-cols-2 gap-x-3 gap-y-4">
                {pages.flatMap((page, pageIndex) =>
                  page.items.map((pet, index) => {
                    const enter = entrance(pageIndex, index)
                    return (
                      <li key={pet.id} className={enter?.className} style={enter?.style}>
                        <PetCard pet={pet} />
                      </li>
                    )
                  }),
                )}
              </ul>
              <LoadMore
                hasNextPage={list.hasNextPage}
                isFetching={list.isFetchingNextPage}
                isError={list.isFetchNextPageError}
                onLoadMore={() => list.fetchNextPage()}
              />
            </>
          )}
        </div>
      </section>

      {filterSheet.isOpen && (
        <FilterSheet initial={query} sort={query.sort} onApply={applyFilters} onClose={filterSheet.close} />
      )}
    </>
  )
}
