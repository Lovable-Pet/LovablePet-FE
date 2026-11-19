import { useMemo } from 'react'
import { RefreshCw } from 'lucide-react'
import { Link } from 'react-router'
import type { PetModelAttempt, PetSyncResult } from '../../apis/dto/admin.dto'
import type { PetSummary } from '../../apis/dto/pet.dto'
import { Button } from '../../components/Button/Button'
import { buttonClass } from '../../components/Button/buttonClass'
import { LoadMore } from '../../components/LoadMore/LoadMore'
import { PawDots } from '../../components/LoadingScreen/LoadingScreen'
import { StateView } from '../../components/StateView/StateView'
import { cn } from '../../components/utils/cn'
import { MODEL_ACTION_LABEL } from '../../constants/admin'
import { ForbiddenView, StatusBadge, UsageMeter } from '../../features/admin/components/AdminCommon'
import { errorMessageOf, isForbidden } from '../../features/admin/errors'
import { useModelAttempts, useSyncPets } from '../../features/admin/queries'
import { petFacts } from '../../features/pet/petFacts'
import { PetPhoto } from '../../features/pet/components/PetPhoto'
import { usePetList } from '../../features/pet/queries'

// /admin — 입양 가능한 유기견 목록에서 AR 모델을 만들 유기견을 고른다
export function AdminPetsPage() {
  const list = usePetList({ sort: 'NEWEST' })
  const attempts = useModelAttempts()
  const sync = useSyncPets()

  // 유기견마다 가장 최근 시도 하나 (최근 100건 안에서)
  const latestByPet = useMemo(() => {
    const map = new Map<number, PetModelAttempt>()
    for (const attempt of attempts.data?.items ?? []) {
      const current = map.get(attempt.petId)
      if (!current || Date.parse(attempt.createdAt) > Date.parse(current.createdAt)) map.set(attempt.petId, attempt)
    }
    return map
  }, [attempts.data])

  if (isForbidden(attempts.error) || isForbidden(sync.error)) return <ForbiddenView />

  const pages = list.data?.pages ?? []
  const total = pages[0]?.totalElements

  return (
    <main>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-title">유기견 목록</h1>
          <p className="mt-1 text-body text-ink-soft">
            {total === undefined ? 'AR 모델을 만들 유기견을 골라 주세요.' : `입양할 수 있는 유기견 ${total.toLocaleString()}마리`}
          </p>
        </div>
        <Button variant="outline" onClick={() => sync.mutate()} disabled={sync.isPending}>
          <RefreshCw className={cn('size-4.5', sync.isPending && 'animate-spin')} strokeWidth={2} aria-hidden />
          {sync.isPending ? '공고 가져오는 중 (10초쯤)' : '공공데이터 공고 가져오기'}
        </Button>
      </div>

      {sync.isSuccess && <SyncResult result={sync.data} />}
      {sync.isError && (
        <p role="alert" className="mt-3 rounded-tile bg-pink-soft px-4 py-3 text-label font-bold text-pink-deep">
          {errorMessageOf(sync.error, '공고를 가져오지 못했어요. 다시 시도해 주세요.')}
        </p>
      )}

      {attempts.data && (
        <div className="mt-5">
          <UsageMeter todayCount={attempts.data.todayCount} dailyLimit={attempts.data.dailyLimit} />
        </div>
      )}

      {list.isPending ? (
        <div className="flex justify-center py-20">
          <PawDots label="목록을 불러오는 중" />
        </div>
      ) : list.isError && pages.length === 0 ? (
        <StateView
          tone="error"
          title="목록을 불러오지 못했어요"
          action={
            <Button variant="outline" onClick={() => list.refetch()}>
              다시 시도
            </Button>
          }
        />
      ) : (
        <>
          <ul className="mt-5 grid gap-3 sm:grid-cols-2">
            {pages.flatMap((page) => page.items).map((pet) => (
              <li key={pet.id}>
                <PetRow pet={pet} attempt={latestByPet.get(pet.id)} />
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

function PetRow({ pet, attempt }: { pet: PetSummary; attempt: PetModelAttempt | undefined }) {
  const canCreate = pet.weightKg !== null
  return (
    <div className="flex h-full items-center gap-3 rounded-card bg-surface p-2 shadow-soft">
      <PetPhoto src={pet.thumbnailUrl} alt={`${pet.kindName} 공고 사진`} seed={pet.id} className="size-20 shrink-0 rounded-tile" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <h2 className="truncate text-body font-extrabold">{pet.kindName}</h2>
          {attempt && <StatusBadge status={attempt.status} />}
        </div>
        <p className="truncate text-label text-ink-soft">{petFacts(pet)}</p>
        <p className="truncate text-caption text-ink-mute">{pet.careName}</p>
      </div>
      {canCreate ? (
        <Link
          to={`/admin/pets/${pet.id}/model`}
          className={buttonClass({ variant: attempt ? 'soft' : 'primary', size: 'sm', className: 'mr-1' })}
        >
          {MODEL_ACTION_LABEL[attempt?.status ?? 'NONE']}
        </Link>
      ) : (
        <p className="mr-2 max-w-[7em] text-right text-caption text-ink-mute">체중 정보가 없어 만들 수 없어요</p>
      )}
    </div>
  )
}

function SyncResult({ result }: { result: PetSyncResult }) {
  const items = [
    ['가져옴', result.fetched],
    ['새로 등록', result.created],
    ['바뀜', result.updated],
    ['내려감', result.unlisted],
    ['건너뜀', result.skipped],
  ] as const
  return (
    <div role="status" className="mt-3 rounded-card bg-mint-soft p-4">
      <p className="text-label font-bold text-mint-deep">
        공고를 가져왔어요 ({(result.tookMs / 1000).toFixed(1)}초)
      </p>
      <dl className="mt-2 flex flex-wrap gap-x-5 gap-y-1">
        {items.map(([label, value]) => (
          <div key={label} className="flex items-baseline gap-1.5">
            <dt className="text-caption text-ink-soft">{label}</dt>
            <dd className="text-body font-extrabold tabular-nums">{value.toLocaleString()}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
