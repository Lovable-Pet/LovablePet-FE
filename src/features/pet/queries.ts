import { keepPreviousData, useInfiniteQuery, useQuery } from '@tanstack/react-query'
import type { PetListParams } from '../../apis/dto/pet.dto'
import { petApi } from '../../apis/pet'

export const PET_PAGE_SIZE = 20
export const WAITING_RAIL_SIZE = 6

/**
 * 쿼리 키. 찜 낙관적 업데이트가 ['pets', 'list'] 아래를 한꺼번에 고치므로
 * 목록 모양(무한 목록·한 페이지)이 달라도 같은 'list' 아래에 둔다
 */
export const petKeys = {
  all: ['pets'] as const,
  lists: () => [...petKeys.all, 'list'] as const,
  list: (params: PetListParams) => [...petKeys.lists(), params] as const,
  count: (params: PetListParams) => [...petKeys.all, 'count', params] as const,
  filters: () => [...petKeys.all, 'filters'] as const,
  details: () => [...petKeys.all, 'detail'] as const,
  detail: (petId: number) => [...petKeys.details(), petId] as const,
}

/** 둘러보기 목록 (스크롤 끝에서 다음 페이지) */
export const usePetList = (params: PetListParams) =>
  useInfiniteQuery({
    queryKey: petKeys.list({ ...params, size: PET_PAGE_SIZE }),
    queryFn: ({ pageParam }) => petApi.getList({ ...params, page: pageParam, size: PET_PAGE_SIZE }),
    initialPageParam: 0,
    getNextPageParam: (lastPage) => (lastPage.hasNext ? lastPage.page + 1 : undefined),
    staleTime: 60_000,
  })

/** 오래 기다린 아이들: 같은 필터, 항상 OLDEST, 6마리 */
export const useWaitingPets = (params: PetListParams, enabled: boolean) => {
  const waitingParams: PetListParams = { ...params, sort: 'OLDEST', page: 0, size: WAITING_RAIL_SIZE }
  return useQuery({
    queryKey: petKeys.list(waitingParams),
    queryFn: () => petApi.getList(waitingParams),
    enabled,
    staleTime: 60_000,
  })
}

/** 필터 시트의 'N마리 보기'. 바뀌는 동안 이전 숫자를 유지해 깜빡이지 않게 한다 */
export const usePetCount = (params: PetListParams) =>
  useQuery({
    queryKey: petKeys.count(params),
    queryFn: () => petApi.getList({ ...params, page: 0, size: 1 }).then((page) => page.totalElements),
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  })

/** 지역·품종별 마릿수 */
export const usePetFilters = () =>
  useQuery({
    queryKey: petKeys.filters(),
    queryFn: petApi.getFilters,
    staleTime: 10 * 60_000,
  })

/** 공고 상세 */
export const usePetDetail = (petId: number) =>
  useQuery({
    queryKey: petKeys.detail(petId),
    queryFn: () => petApi.getDetail(petId),
    enabled: Number.isInteger(petId) && petId > 0,
    staleTime: 60_000,
  })
