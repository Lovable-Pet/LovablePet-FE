import { apiClient } from './client'
import type { FavoriteListParams, FavoriteStatus } from './dto/favorite.dto'
import type { PetPageResponse } from './dto/pet.dto'

// 모두 로그인 필요. 찜하기·취소는 여러 번 호출해도 성공한다(멱등)
// 백엔드 FavoriteController: /api/members/me/favorites/{petId}
export const favoriteApi = {
  add: (petId: number) => apiClient.put<FavoriteStatus, undefined>(`/members/me/favorites/${petId}`, undefined),
  remove: (petId: number) => apiClient.delete<FavoriteStatus>(`/members/me/favorites/${petId}`),
  /** 최근에 찜한 순. 입양·반환된 동물도 adoptable=false 로 남는다 */
  getList: (params: FavoriteListParams = {}) =>
    apiClient.get<PetPageResponse>('/members/me/favorites', { params }),
}
