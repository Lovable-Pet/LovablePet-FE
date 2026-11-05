import { useMemo, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router'
import type { PetModelAttempt, PetSyncResult } from '../../apis/dto/admin.dto'
import type { PetListParams, PetSort, PetSummary } from '../../apis/dto/pet.dto'
import { Button } from '../../components/Button/Button'
import { buttonStyles } from '../../components/Button/buttonStyles'
import { LoadMore } from '../../components/LoadMore/LoadMore'
import { StateView } from '../../components/StateView/StateView'
import { MODEL_ACTION_LABEL } from '../../constants/admin'
import { SEX_LABEL, SORT_LABEL } from '../../constants/pet'
import { AdminForbidden, AdminPageHeader, ModelStatusBadge, UsageMeter } from '../../features/admin/components/AdminCommon'
import { isForbidden } from '../../features/admin/errors'
import { useModelAttempts, useSyncPets } from '../../features/admin/queries'
import { PetPhoto } from '../../features/pet/components/PetPhoto'
import { usePetFilters, usePetList } from '../../features/pet/queries'
import { formatWeight, waitingDays } from '../../utils/pet'

const SORTS: PetSort[] = ['OLDEST', 'NEWEST']

/** 12 · AR 모델 만들기: 모델 없는 입양 가능한 아이들 */
export function AdminPetsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const region = searchParams.get('region') || undefined
  const kind = searchParams.get('kind') || undefined
  const sort: PetSort = searchParams.get('sort') === 'NEWEST' ? 'NEWEST' : 'OLDEST'
  const params = useMemo<PetListParams>(() => ({ hasModel: false, sort, region, kind }), [sort, region, kind])

  const list = usePetList(params)
  const attempts = useModelAttempts()
  const filters = usePetFilters()
  const sync = useSyncPets()

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams)
    if (value) next.set(key, value)
    else next.delete(key)
    setSearchParams(next, { replace: true })
  }

  if (isForbidden(list.error) || isForbidden(attempts.error)) return <AdminForbidden />

  // 최근 100건에서 아이마다 가장 최근 시도 (목록은 최근 순)
  const latestByPet = new Map<number, PetModelAttempt>()
  attempts.data?.items.forEach((attempt) => {
    if (!latestByPet.has(attempt.petId)) latestByPet.set(attempt.petId, attempt)
  })
  const usage = attempts.data
  const limitReached = usage ? usage.todayCount >= usage.dailyLimit : false

  const pets = list.data?.pages.flatMap((page) => page.items) ?? []
  const total = list.data?.pages[0]?.totalElements

  return (
    <div className="flex flex-col gap-5">
      <AdminPageHeader
        title="AR 모델 만들기"
        description="아직 AR 모델이 없는 입양 가능한 아이들이에요. 오래 기다린 아이부터 보여 드려요."
        aside={
          <>
            {usage && <UsageMeter todayCount={usage.todayCount} dailyLimit={usage.dailyLimit} showRemaining />}
            <div className="flex items-center gap-3 rounded-button border border-line bg-surface px-3.5 py-2.5">
              <div>
                <p className="text-caption text-ink-caption">공공데이터 동기화</p>
                <p className="mt-0.5 text-label text-ink-secondary">매주 월요일 새벽 4시 자동</p>
              </div>
              <Button variant="outline-strong" size="sm" onClick={() => sync.mutate()} disabled={sync.isPending}>
                {sync.isPending ? '가져오는 중…' : '지금 동기화'}
              </Button>
            </div>
          </>
        }
      />

      {sync.isSuccess && <SyncResultBanner result={sync.data} />}
      {sync.isError && (
        <p role="alert" className="rounded-input bg-danger-soft px-4 py-3 text-body text-danger-ink">
          {isForbidden(sync.error) ? '관리자만 동기화할 수 있어요.' : '동기화하지 못했어요. 잠시 후 다시 시도해 주세요.'}
        </p>
      )}
      {limitReached && (
        <p role="status" className="rounded-input border border-notice-line bg-notice px-4 py-3 text-body text-notice-ink">
          오늘 한도를 다 썼어요. 내일 다시 만들 수 있어요.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <SelectBox label="지역" value={region ?? ''} onChange={(value) => setParam('region', value)}>
          <option value="">전체</option>
          {filters.data?.regions.map((option) => (
            <option key={option.name} value={option.name}>
              {option.name}
            </option>
          ))}
        </SelectBox>
        <SelectBox label="품종" value={kind ?? ''} onChange={(value) => setParam('kind', value)}>
          <option value="">전체</option>
          {filters.data?.kinds.map((option) => (
            <option key={option.name} value={option.name}>
              {option.name}
            </option>
          ))}
        </SelectBox>
        <SelectBox label="정렬" value={sort} onChange={(value) => setParam('sort', value === 'OLDEST' ? '' : value)}>
          {SORTS.map((value) => (
            <option key={value} value={value}>
              {SORT_LABEL[value]}
            </option>
          ))}
        </SelectBox>
        <span className="ml-auto text-body text-ink-secondary">
          <strong className="font-mono font-semibold">{total?.toLocaleString() ?? '–'}</strong>마리
        </span>
      </div>

      {list.isError ? (
        <StateView
          tone="error"
          title="목록을 불러오지 못했어요"
          description="잠시 후 다시 시도해 주세요."
          action={
            <Button variant="outline" size="md" onClick={() => list.refetch()}>
              다시 시도
            </Button>
          }
        />
      ) : !list.isPending && pets.length === 0 ? (
        <StateView title="AR 모델이 없는 아이가 없어요" description="모든 아이가 AR로 보여요. 필터를 바꿔 보세요." />
      ) : (
        <div className="relative overflow-x-auto rounded-card border border-line bg-surface">
          <table className="w-full min-w-[820px] border-collapse text-body">
            <thead>
              <tr className="text-left text-label text-ink-tertiary">
                {['아이', '체중', '사진', '기다린 날', '최근 시도'].map((heading) => (
                  <th key={heading} scope="col" className="border-b border-line-subtle px-4 py-3 font-medium">
                    {heading}
                  </th>
                ))}
                <th scope="col" className="border-b border-line-subtle px-4 py-3">
                  <span className="sr-only">작업</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {list.isPending
                ? Array.from({ length: 6 }, (_, index) => <SkeletonRow key={index} />)
                : pets.map((pet) => (
                    <PetRow key={pet.id} pet={pet} latest={latestByPet.get(pet.id)} limitReached={limitReached} />
                  ))}
            </tbody>
          </table>
        </div>
      )}

      {pets.length > 0 && (
        <LoadMore
          hasNextPage={list.hasNextPage}
          isFetching={list.isFetchingNextPage}
          isError={list.isFetchNextPageError}
          onLoadMore={() => list.fetchNextPage()}
        />
      )}
      <p className="text-caption text-ink-caption">
        최근 시도는 생성 기록(최근 100건)에서 찾아 붙여요. 기록에 없으면 '-'로 보여요.
      </p>
    </div>
  )
}

function PetRow({ pet, latest, limitReached }: { pet: PetSummary; latest?: PetModelAttempt; limitReached: boolean }) {
  const weight = formatWeight(pet.weightKg)
  const hasPhoto = pet.thumbnailUrl !== null
  const blockedReason = weight === null ? '체중이 없어 만들 수 없어요' : !hasPhoto ? '사진이 없어 만들 수 없어요' : null
  const status = latest?.status
  // 상태 보기·결과 보기는 새로 만드는 게 아니라서 한도와 상관없다
  const createsNew = status === undefined || status === 'PHOTO_REJECTED' || status === 'UNSUITABLE' || status === 'FAILED'
  const actionLabel = MODEL_ACTION_LABEL[status ?? 'NONE']

  return (
    <tr>
      <td className="border-b border-line-subtle px-4 py-3">
        <div className="flex items-center gap-3">
          <PetPhoto
            src={pet.thumbnailUrl}
            alt={`${pet.kindName} 공고 사진`}
            showPlaceholderLabel={false}
            className="size-12 shrink-0 rounded-button-sm"
          />
          <div>
            <p className="font-semibold">
              {pet.kindName} · {SEX_LABEL[pet.sex]}
            </p>
            <p className="mt-0.5 text-caption text-ink-caption">
              {pet.orgName} · <span className="font-mono">#{pet.id}</span>
            </p>
          </div>
        </div>
      </td>
      <td className="border-b border-line-subtle px-4 py-3">
        {weight ? <span className="font-mono">{weight}</span> : <span className="font-semibold text-danger">미상</span>}
      </td>
      <td className="border-b border-line-subtle px-4 py-3">{hasPhoto ? '있음' : <span className="text-danger">없음</span>}</td>
      <td className="border-b border-line-subtle px-4 py-3">
        <span className="font-mono">{waitingDays(pet.noticeStart)}</span>일
      </td>
      <td className="border-b border-line-subtle px-4 py-3">{status ? <ModelStatusBadge status={status} /> : '-'}</td>
      <td className="border-b border-line-subtle px-4 py-3 text-right">
        {blockedReason ? (
          <span className="text-caption whitespace-nowrap text-ink-caption">{blockedReason}</span>
        ) : createsNew && limitReached ? (
          <span aria-disabled="true" className={buttonStyles({ variant: 'dark', size: 'xs' })}>
            {actionLabel}
          </span>
        ) : (
          <Link to={`/admin/pets/${pet.id}/model`} className={buttonStyles({ variant: 'dark', size: 'xs' })}>
            {actionLabel}
          </Link>
        )}
      </td>
    </tr>
  )
}

function SkeletonRow() {
  return (
    <tr aria-hidden>
      <td colSpan={6} className="border-b border-line-subtle px-4 py-3">
        <div className="flex animate-pulse items-center gap-3">
          <div className="size-12 rounded-button-sm bg-muted" />
          <div className="h-4 w-1/3 rounded bg-muted" />
        </div>
      </td>
    </tr>
  )
}

function SyncResultBanner({ result }: { result: PetSyncResult }) {
  const items: [string, number][] = [
    ['받음', result.fetched],
    ['새로 저장', result.created],
    ['덮어씀', result.updated],
    ['목록에서 내림', result.unlisted],
    ['건너뜀', result.skipped],
  ]
  return (
    <div role="status" className="flex flex-wrap gap-x-4 gap-y-1 rounded-input bg-success-soft px-4 py-3 text-body text-success-strong">
      <strong className="font-semibold">
        동기화 끝 · <span className="font-mono">{(result.tookMs / 1000).toFixed(1)}</span>초
      </strong>
      {items.map(([label, value]) => (
        <span key={label}>
          {label} <span className="font-mono">{value.toLocaleString()}</span>
        </span>
      ))}
    </div>
  )
}

interface SelectBoxProps {
  label: string
  value: string
  onChange: (value: string) => void
  children: ReactNode
}

function SelectBox({ label, value, onChange, children }: SelectBoxProps) {
  return (
    <label className="flex h-10 items-center gap-2 rounded-button-sm border border-line bg-surface px-3 text-label text-ink-tertiary focus-within:outline-2 focus-within:outline-accent">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="bg-transparent text-body font-semibold text-ink outline-none"
      >
        {children}
      </select>
    </label>
  )
}
