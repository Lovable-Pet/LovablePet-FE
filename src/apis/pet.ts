import { apiClient } from './client'
import type { PetDetail, PetFilterOptions, PetListParams, PetPageResponse } from './dto/pet.dto'

// GET /api/pets/** 는 로그인 없이 열려 있다. 토큰이 있으면 favorited 가 채워진다
export const petApi = {
  getList: (params: PetListParams = {}) => apiClient.get<PetPageResponse>('/pets', { params }),
  getFilters: () => apiClient.get<PetFilterOptions>('/pets/filters'),
  getDetail: (petId: number) => apiClient.get<PetDetail>(`/pets/${petId}`),
}

/**
 * model.glbUrl 은 API 서버 루트 기준 경로(/models/...)라 /api 아래가 아니다.
 * VITE_API_BASE_URL 의 출처(origin)에 붙여 절대 주소로 만든다.
 */
export const resolveModelUrl = (glbUrl: string) =>
  new URL(glbUrl, new URL(import.meta.env.VITE_API_BASE_URL, window.location.origin)).toString()
