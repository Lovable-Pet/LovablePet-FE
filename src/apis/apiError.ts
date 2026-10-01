import type { ApiErrorBody, ApiFailResponse } from './dto/common.dto'

export class ApiError extends Error {
  readonly code: string
  readonly details: ApiErrorBody['details']
  readonly status: number
  readonly path: string

  constructor(response: ApiFailResponse, status: number) {
    super(response.error.message)
    this.name = 'ApiError'
    this.code = response.error.code
    this.details = response.error.details
    this.status = status
    this.path = response.meta.path
  }
}
