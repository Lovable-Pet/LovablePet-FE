// 찜 DTO. 백엔드 FavoriteController 기준 (모두 로그인 필요)

export interface FavoriteStatus {
  petId: number
  /** 요청 후 찜 상태 */
  favorited: boolean
}

export interface FavoriteListParams {
  page?: number
  size?: number
}
