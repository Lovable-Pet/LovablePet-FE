import { apiClient } from './client'
import type {
  FitCheckRequest,
  FitCheckResponse,
  GenerateModelRequest,
  PetModelAttempt,
  PetModelAttemptList,
  PetModelStatus,
  PetSyncResult,
} from './dto/admin.dto'

// 적합도 확인은 5~20초, 동기화는 10초 안팎이라 기본 타임아웃(10초)보다 길게 잡는다
const LONG_TIMEOUT = 60_000

export const adminApi = {
  /** 고른 사진으로 만들 수 있는지 미리 본다 (약 $0.02) */
  checkFit: (petId: number, body: FitCheckRequest) =>
    apiClient.post<FitCheckResponse, FitCheckRequest>(`/admin/pets/${petId}/model/fit`, body, {
      timeout: LONG_TIMEOUT,
    }),
  /** 생성 등록 (202, 약 $0.075). 이후 getLatestModel 을 몇 초마다 조회한다 */
  generateModel: (petId: number, body: GenerateModelRequest) =>
    apiClient.post<PetModelAttempt, GenerateModelRequest>(`/admin/pets/${petId}/model`, body),
  /** 이 개의 최근 생성 시도. 시도가 없으면 null */
  getLatestModel: (petId: number) => apiClient.get<PetModelAttempt | null>(`/admin/pets/${petId}/model`),
  /** 최근 100건과 오늘 사용량 */
  getModelAttempts: (status?: PetModelStatus) =>
    apiClient.get<PetModelAttemptList>('/admin/pet-models', { params: { status } }),
  /** 매주 월요일 자동 동기화를 지금 실행 */
  syncPets: () =>
    apiClient.post<PetSyncResult, undefined>('/admin/pets/sync', undefined, { timeout: LONG_TIMEOUT }),
}
