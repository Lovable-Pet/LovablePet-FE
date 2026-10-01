export interface ApiMeta {
  timestamp: string
  path: string
}

export interface ApiErrorBody {
  code: string
  message: string
  details: unknown | null
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
