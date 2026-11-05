export interface ApiMeta {
  timestamp: string
  path: string
}

/** 입력값 검증 실패(COMMON_400)일 때 항목별 사유 */
export interface ApiFieldError {
  field: string
  rejectedValue: unknown
  reason: string
}

export interface ApiErrorBody {
  /** 예: COMMON_400, AUTH_401_TOKEN, PET_404 */
  code: string
  message: string
  /** 입력값 검증 실패일 때만 채워지고 그 외에는 null */
  details: ApiFieldError[] | null
}

export interface ApiSuccessResponse<T> {
  resultType: 'SUCCESS'
  success: { data: T }
  error: null
  meta: ApiMeta
}

export interface ApiFailResponse {
  resultType: 'FAIL'
  success: null
  error: ApiErrorBody
  meta: ApiMeta
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiFailResponse
