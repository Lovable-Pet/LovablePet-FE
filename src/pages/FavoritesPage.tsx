import { Link } from 'react-router'
import type { PetSummary } from '../apis/dto/pet.dto'
import { Badge } from '../components/Badge/Badge'
import { Button } from '../components/Button/Button'
import { buttonClass } from '../components/Button/buttonClass'
import { LoadMore } from '../components/LoadMore/LoadMore'
import { LoadingDog } from '../components/LoadingScreen/LoadingScreen'
import { StateView } from '../components/StateView/StateView'
import { cn } from '../components/utils/cn'
import { FavoriteButton } from '../features/favorite/components/FavoriteButton'
import { useFavoriteList } from '../features/favorite/queries'
import { petFacts } from '../features/pet/petFacts'
import { PetPhoto } from '../features/pet/components/PetPhoto'

// /favorites — 내가 찜한 유기견 (최근에 찜한 순). 로그인해야 들어온다
export function FavoritesPage() {
  const list = useFavoriteList(true)
  const pages = list.data?.pages ?? []
  const total = pages[0]?.totalElements

  return (
    <main className="px-5 pt-[calc(20px+env(safe-area-inset-top))]">
      <h1 className="font-display text-title">관심목록</h1>
      {total !== undefined && total > 0 && (
        <p className="mt-1 text-body text-ink-soft">
          <span className="font-bold tabular-nums">{total}</span>마리를 찜했어요
        </p>
      )}

      {list.isPending ? (
        <LoadingDog description="찜한 유기견을 불러오고 있어요" />
      ) : list.isError && pages.length === 0 ? (
        <StateView
          tone="error"
          title="찜 목록을 불러오지 못했어요"
          description="잠시 후 다시 시도해 주세요."
          action={
            <Button variant="outline" onClick={() => list.refetch()}>
              다시 시도
            </Button>
          }
        />
      ) : total === 0 ? (
        <StateView
          character="love"
          title="아직 찜한 유기견이 없어요"
          description="마음이 가는 유기견의 하트를 누르면 여기에 모여요."
          action={
            <Link to="/" className={buttonClass()}>
              유기견 둘러보기
            </Link>
          }
        />
      ) : (
        <>
          <ul className="mt-5 flex flex-col gap-3">
            {pages.flatMap((page) => page.items).map((pet) => (
              <li key={pet.id}>
                <FavoriteRow pet={pet} />
              </li>
            ))}
          </ul>
          <LoadMore
            hasNext={list.hasNextPage}
            isLoading={list.isFetchingNextPage}
            isError={list.isFetchNextPageError}
            onLoad={() => list.fetchNextPage()}
          />
        </>
      )}
    </main>
  )
}

function FavoriteRow({ pet }: { pet: PetSummary }) {
  return (
    <Link
      to={`/pets/${pet.id}`}
      className="flex items-center gap-3.5 rounded-card bg-surface p-2 shadow-soft transition-[scale] duration-150 active:scale-[0.98]"
    >
      <PetPhoto
        src={pet.thumbnailUrl}
        alt={`${pet.kindName} 공고 사진`}
        seed={pet.id}
        className={cn('size-24 shrink-0 rounded-tile', !pet.adoptable && 'opacity-60 grayscale-[0.4]')}
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap gap-1">
          {pet.adoptable ? <Badge tone="success">입양 가능</Badge> : <Badge>보호 종료</Badge>}
          {pet.hasModel && <Badge tone="info">AR</Badge>}
        </div>
        <h2 className="mt-1.5 truncate text-body font-extrabold">{pet.kindName}</h2>
        <p className="truncate text-label text-ink-soft">{petFacts(pet)}</p>
        <p className="truncate text-caption text-ink-mute">{pet.careName}</p>
      </div>
      <FavoriteButton petId={pet.id} favorited={pet.favorited} name={pet.kindName} className="mr-1" />
    </Link>
  )
}
