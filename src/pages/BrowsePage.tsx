import { Box, Search, SlidersHorizontal } from 'lucide-react'
import { Link, useSearchParams } from 'react-router'
import type { PetSort } from '../apis/dto/pet.dto'
import { Button } from '../components/Button/Button'
import { buttonClass } from '../components/Button/buttonClass'
import { Chip } from '../components/Chip/Chip'
import { Dropdown } from '../components/Dropdown/Dropdown'
import { LoadMore } from '../components/LoadMore/LoadMore'
import { LoadingDog } from '../components/LoadingScreen/LoadingScreen'
import { Logo } from '../components/Logo/Logo'
import { StateView } from '../components/StateView/StateView'
import { SORT_LABEL, WEIGHT_PRESETS, type WeightPresetKey } from '../constants/pet'
import {
  activeFilterCount,
  parseBrowseQuery,
  toListParams,
  toSearchParams,
  weightPresetOf,
  type BrowseQuery,
} from '../features/pet/browseQuery'
import { PetCard } from '../features/pet/components/PetCard'
import { usePetList } from '../features/pet/queries'
import { useEntranceStagger } from '../hooks/useEntranceStagger'

const SORT_OPTIONS = (Object.keys(SORT_LABEL) as PetSort[]).map((value) => ({ value, label: SORT_LABEL[value] }))

const SIZE_CHIPS: { key: WeightPresetKey; label: string }[] = [
  { key: 'SMALL', label: '소형견' },
  { key: 'MEDIUM', label: '중형견' },
  { key: 'LARGE', label: '대형견' },
]

// /search — 검색 탭. 검색창·조건 버튼(→ 조건 고르기 화면), 크기 칩, 두 줄 카드 목록. 조건과 정렬은 주소(쿼리)에 담는다
export function BrowsePage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const query = parseBrowseQuery(searchParams)
  const list = usePetList(toListParams(query))
  const pages = list.data?.pages ?? []
  const total = pages[0]?.totalElements
  const entrance = useEntranceStagger(pages.length, searchParams.toString())

  const update = (next: BrowseQuery) => setSearchParams(toSearchParams(next), { preventScrollReset: true })
  const preset = weightPresetOf(query)
  const hasSize = query.minWeight !== undefined || query.maxWeight !== undefined
  const pickSize = (key: WeightPresetKey | null) => {
    const { minWeight, maxWeight } = key ? WEIGHT_PRESETS[key] : { minWeight: undefined, maxWeight: undefined }
    update({ ...query, minWeight, maxWeight })
  }
  const searchTo = `/search/filters?${toSearchParams(query)}`
  const searchLabel = [query.region, query.kind].filter(Boolean).join(', ')
  const filterCount = activeFilterCount(query)

  return (
    <main>
      <header className="px-5 pt-[calc(16px+env(safe-area-inset-top))] pb-2">
        <Logo />
        <div className="mt-4 flex gap-2">
          <Link
            to={searchTo}
            className="flex h-12 min-w-0 flex-1 items-center gap-2.5 rounded-full bg-surface px-4 shadow-soft transition-[scale] duration-150 active:scale-[0.98]"
          >
            <Search className="size-5 shrink-0 text-ink-mute" strokeWidth={2.2} aria-hidden />
            <span className={searchLabel ? 'truncate text-body font-bold text-ink' : 'truncate text-body text-ink-mute'}>
              {searchLabel || '지역, 품종으로 찾아보세요!'}
            </span>
          </Link>
          <Link
            to={searchTo}
            aria-label={filterCount > 0 ? `조건 ${filterCount}개 적용됨, 바꾸기` : '조건 고르기'}
            className="relative flex size-12 shrink-0 items-center justify-center rounded-full bg-surface text-ink shadow-soft transition-[scale] duration-150 active:scale-[0.96]"
          >
            <SlidersHorizontal className="size-5" strokeWidth={2.2} aria-hidden />
            {filterCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 flex size-5 items-center justify-center rounded-full bg-primary text-[0.6875rem] font-extrabold text-white tabular-nums">
                {filterCount}
              </span>
            )}
          </Link>
        </div>
      </header>

      <div className="no-scrollbar sticky top-0 z-30 flex scroll-px-5 gap-2 overflow-x-auto bg-canvas/90 px-5 pt-[calc(8px+env(safe-area-inset-top))] pb-2 backdrop-blur">
        <Chip selected={!hasSize} onClick={() => pickSize(null)}>
          모든 크기
        </Chip>
        {SIZE_CHIPS.map(({ key, label }) => (
          <Chip key={key} selected={preset === key} onClick={() => pickSize(preset === key ? null : key)}>
            {label}
          </Chip>
        ))}
        <Chip selected={!!query.hasModel} onClick={() => update({ ...query, hasModel: query.hasModel ? undefined : true })}>
          <Box className="size-4" strokeWidth={2.2} aria-hidden />
          AR 가능
        </Chip>
      </div>

      <section aria-label="유기견 목록" className="px-5 pt-2">
        <div className="mb-2 flex min-h-9 items-center justify-between">
          <p className="text-label text-ink-soft">
            {total !== undefined && (
              <>
                <span className="font-extrabold text-ink tabular-nums">{total.toLocaleString()}</span>마리가 가족을 기다려요
              </>
            )}
          </p>
          <Dropdown label="정렬" value={query.sort} options={SORT_OPTIONS} onChange={(sort) => update({ ...query, sort })} />
        </div>

        {list.isPending ? (
          <LoadingDog description="유기견들을 데려오고 있어요" />
        ) : list.isError && pages.length === 0 ? (
          <StateView
            tone="error"
            title="목록을 불러오지 못했어요"
            description="인터넷 연결을 확인하고 다시 시도해 주세요."
            action={
              <Button variant="outline" onClick={() => list.refetch()}>
                다시 시도
              </Button>
            }
          />
        ) : total === 0 ? (
          <StateView
            character="searching"
            title="조건에 맞는 유기견이 없어요"
            description="조건을 줄이면 더 많은 유기견을 볼 수 있어요."
            action={
              <Link to="/search" className={buttonClass({ variant: 'soft' })}>
                조건 모두 지우기
              </Link>
            }
          />
        ) : (
          <>
            <ul className="grid grid-cols-2 gap-3">
              {pages.map((page, pageIndex) =>
                page.items.map((pet, index) => {
                  const motion = entrance(pageIndex, index)
                  return (
                    <li key={pet.id}>
                      <PetCard pet={pet} className={motion?.className} style={motion?.style} />
                    </li>
                  )
                }),
              )}
            </ul>
            <LoadMore
              hasNext={list.hasNextPage}
              isLoading={list.isFetchingNextPage}
              isError={list.isFetchNextPageError}
              onLoad={() => list.fetchNextPage()}
            />
          </>
        )}
      </section>
    </main>
  )
}
