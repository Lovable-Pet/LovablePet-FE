import { PawPrint } from 'lucide-react'
import { Link, Navigate, useSearchParams } from 'react-router'
import { Button } from '../components/Button/Button'
import { LoadMore } from '../components/LoadMore/LoadMore'
import { LoadingDog } from '../components/LoadingScreen/LoadingScreen'
import { Logo } from '../components/Logo/Logo'
import { StateView } from '../components/StateView/StateView'
import { cn } from '../components/utils/cn'
import { ArShowcase } from '../features/pet/components/ArShowcase'
import { PetTile } from '../features/pet/components/PetTile'
import { usePetList } from '../features/pet/queries'
import { hasWelcomed } from '../features/welcome/welcomed'
import { useEntranceStagger } from '../hooks/useEntranceStagger'

/** 홈 사진 격자의 한 줄 칸 수 */
const HOME_COLUMNS: 3 | 4 = 3

// / — 홈. 로고, AR 로 볼 수 있는 유기견 캐러셀, '가족을 기다리는 유기견' 기본순 사진 격자 (조건으로 찾는 것은 검색 탭)
export function HomePage() {
  const [searchParams] = useSearchParams()
  const list = usePetList({ sort: 'MIXED' })
  const pages = list.data?.pages ?? []
  const entrance = useEntranceStagger(pages.length, 'home')

  // 조건이 붙은 예전 홈 주소(/?region=…)는 검색 탭으로 넘긴다
  if (searchParams.size > 0) return <Navigate to={`/search?${searchParams}`} replace />
  // 처음 온 사람은 시작 화면부터
  if (!hasWelcomed()) return <Navigate to="/welcome" replace />

  return (
    <main>
      <header className="px-5 pt-[calc(16px+env(safe-area-inset-top))] pb-1">
        <Logo />
      </header>

      <ArShowcase />

      <section aria-labelledby="home-list-title" className="px-5 pt-7">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 id="home-list-title" className="flex items-center gap-1.5 font-display text-heading">
            <PawPrint className="size-5 fill-primary text-primary" strokeWidth={2} aria-hidden />
            가족을 기다리는 유기견
          </h2>
          <Link to="/search" className="-mr-2 flex h-9 shrink-0 items-center rounded-full px-2 text-label font-bold text-ink-soft">
            더보기
          </Link>
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
        ) : pages[0]?.totalElements === 0 ? (
          <StateView character="searching" title="지금은 공고가 없어요" description="새 공고가 올라오면 여기에 보여요." />
        ) : (
          <>
            <ul className={cn('grid gap-2.5', HOME_COLUMNS === 4 ? 'grid-cols-4' : 'grid-cols-3')}>
              {pages.map((page, pageIndex) =>
                page.items.map((pet, index) => {
                  const motion = entrance(pageIndex, index)
                  return (
                    <li key={pet.id}>
                      <PetTile pet={pet} className={motion?.className} style={motion?.style} />
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
