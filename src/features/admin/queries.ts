import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { adminApi } from '../../apis/admin'
import type { FitCheckRequest, GenerateModelRequest, PetModelAttempt } from '../../apis/dto/admin.dto'
import { MODEL_POLL_INTERVAL_MS } from '../../constants/admin'
import { petKeys } from '../pet/queries'

export const adminKeys = {
  all: ['admin'] as const,
  attempts: () => [...adminKeys.all, 'attempts'] as const,
  latestModel: (petId: number) => [...adminKeys.all, 'latestModel', petId] as const,
}

const hasPending = (items: PetModelAttempt[] | undefined) => items?.some((item) => item.status === 'PENDING') ?? false

/**
 * 최근 생성 시도 100건 + 오늘 사용량. 상태별 건수는 이 100건에서 센다.
 * 만드는 중인 기록이 하나라도 있으면 5초마다 다시 불러온다
 */
export const useModelAttempts = () =>
  useQuery({
    queryKey: adminKeys.attempts(),
    queryFn: () => adminApi.getModelAttempts(),
    refetchInterval: (query) => (hasPending(query.state.data?.items) ? MODEL_POLL_INTERVAL_MS : false),
  })

/** 이 아이의 가장 최근 생성 시도 (없으면 null). PENDING이면 5초마다 다시 불러온다 */
export const useLatestModel = (petId: number) =>
  useQuery({
    queryKey: adminKeys.latestModel(petId),
    queryFn: () => adminApi.getLatestModel(petId),
    enabled: Number.isInteger(petId) && petId > 0,
    refetchInterval: (query) => (query.state.data?.status === 'PENDING' ? MODEL_POLL_INTERVAL_MS : false),
  })

/** 공공데이터 동기화. 끝나면 동물 목록을 다시 불러온다 */
export const useSyncPets = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: adminApi.syncPets,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: petKeys.all }),
  })
}

/** 적합도 확인 (5~20초, 약 $0.02) */
export const useCheckFit = (petId: number) =>
  useMutation({
    mutationFn: (body: FitCheckRequest) => adminApi.checkFit(petId, body),
  })

/** 생성 등록 (202). 등록한 시도를 바로 최근 시도로 넣어 진행 화면으로 바꾼다 */
export const useGenerateModel = (petId: number) => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: GenerateModelRequest) => adminApi.generateModel(petId, body),
    onSuccess: (attempt) => {
      queryClient.setQueryData(adminKeys.latestModel(petId), attempt)
      queryClient.invalidateQueries({ queryKey: adminKeys.attempts() })
    },
  })
}
