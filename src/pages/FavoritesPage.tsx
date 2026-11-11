import { Link } from 'react-router'
import { Button } from '../components/Button/Button'
import { buttonStyles } from '../components/Button/buttonStyles'
import { StateView } from '../components/StateView/StateView'
import { useAuth } from '../features/auth/useAuth'
import { FavoriteCard, FavoriteCardSkeleton } from '../features/favorite/components/FavoriteCard'
import { useFavoriteList } from '../features/favorite/queries'
import { LoadMore } from '../components/LoadMore/LoadMore'
import { useEntranceStagger } from '../hooks/useEntranceStagger'

/** 찜한 아이 (RequireAuth 안에서만 보인다) */
export function FavoritesPage() {
  const { isLoggedIn } = useAuth()
  const list = useFavoriteList(isLoggedIn)

  const pages = list.data?.pages ?? []
  const pets = pages.flatMap((page) => page.items)
  const total = pages[0]?.totalElements
  const entrance = useEntranceStagger(pages.length, 'favorites')

  return (
    <div className="pb-6">
      <header className="flex h-14 items-center px-5">
        <h1 className="text-title font-bold">
          찜한 유기견{' '}
          {total !== undefined && <span className="font-mono text-accent">{total.toLocaleString()}</span>}
        </h1>
      </header>

      <p className="mx-5 mt-1 mb-4 text-body text-ink-tertiary">
        찜해 둔 유기견을 우리 집에 다시 놓아 보고,
        <br />
        마음이 정해지면 보호소에 연락해 보세요.
      </p>

      <div className="px-4">
        {list.isPending ? (
          <div className="flex flex-col gap-3" aria-busy="true" aria-label="찜 목록 불러오는 중">
            {Array.from({ length: 3 }, (_, index) => (
              <FavoriteCardSkeleton key={index} />
            ))}
          </div>
        ) : list.isError ? (
          <StateView
            tone="error"
            title="찜 목록을 불러오지 못했어요"
            description="잠시 후 다시 시도해 주세요."
            action={
              <Button variant="outline" size="md" onClick={() => list.refetch()}>
                다시 시도
              </Button>
            }
          />
        ) : pets.length === 0 ? (
          <StateView
            title="아직 찜한 유기견이 없어요"
            description="마음에 남는 유기견을 찜해 두면 여기서 다시 볼 수 있어요."
            action={
              <Link to="/" className={buttonStyles({ variant: 'dark', size: 'md' })}>
                유기견 둘러보기
              </Link>
            }
          />
        ) : (
          <>
            <ul className="flex flex-col gap-3">
              {pages.flatMap((page, pageIndex) =>
                page.items.map((pet, index) => {
                  const enter = entrance(pageIndex, index)
                  return (
                    <li key={pet.id} className={enter?.className} style={enter?.style}>
                      <FavoriteCard pet={pet} />
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
    </div>
  )
}
