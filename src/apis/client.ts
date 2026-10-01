import axios, { type AxiosRequestConfig } from 'axios'
import { ApiError } from './apiError'
import { axiosInstance } from './axios'
import type { ApiFailResponse, ApiResponse } from './dto/common.dto'

// 에러 핸들링 관련해서 백엔드 쪽에서 FIX 나면 다시 개선할 예정. 일단 임의로
// 코드는 4xx/5xx라도 본문이 공통 FAIL 포맷이면 ApiError로 변환, 그 외(네트워크 오류 등)는 그대로 전달

const isApiResponse = (body: unknown): body is ApiResponse<unknown> =>
  typeof body === 'object' &&
  body !== null &&
  'resultType' in body &&
  (body.resultType === 'SUCCESS' || body.resultType === 'FAIL')

const isApiFailResponse = (body: unknown): body is ApiFailResponse =>
  isApiResponse(body) && body.resultType === 'FAIL'

async function request<T>(config: AxiosRequestConfig): Promise<T> {
  try {
    const { data: body, status } = await axiosInstance.request<unknown>(config)
    if (!isApiResponse(body)) {
      throw new Error(`공통 응답 포맷이 아닙니다: ${config.method} ${config.url}`)
    }
    if (body.resultType === 'FAIL') throw new ApiError(body, status)
    return body.success.data as T
  } catch (error) {
    if (axios.isAxiosError(error) && error.response && isApiFailResponse(error.response.data)) {
      throw new ApiError(error.response.data, error.response.status)
    }
    throw error
  }
}

export const apiClient = {
  get: <TResponse>(url: string, config: AxiosRequestConfig = {}) =>
    request<TResponse>({ ...config, method: 'GET', url }),
  delete: <TResponse>(url: string, config: AxiosRequestConfig = {}) =>
    request<TResponse>({ ...config, method: 'DELETE', url }),
  post: <TResponse, TBody>(url: string, body: TBody, config: AxiosRequestConfig = {}) =>
    request<TResponse>({ ...config, method: 'POST', url, data: body }),
  put: <TResponse, TBody>(url: string, body: TBody, config: AxiosRequestConfig = {}) =>
    request<TResponse>({ ...config, method: 'PUT', url, data: body }),
  patch: <TResponse, TBody>(url: string, body: TBody, config: AxiosRequestConfig = {}) =>
    request<TResponse>({ ...config, method: 'PATCH', url, data: body }),
}
