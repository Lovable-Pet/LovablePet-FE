import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios'
import type { ApiFailResponse, ApiResponse } from './dto/common.dto'
import type { ReissueResponse } from './dto/auth.dto'
import { tokenStorage } from './tokenStorage'

declare module 'axios' {
  interface InternalAxiosRequestConfig {
    /** 재발급 후 한 번 다시 보낸 요청인지 */
    _retried?: boolean
    /** 토큰을 붙이지 않고 보낸다 (재발급 실패 후 공개 GET 재시도) */
    _skipAuth?: boolean
  }
}

const baseURL = import.meta.env.VITE_API_BASE_URL

export const axiosInstance = axios.create({
  baseURL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 10_000,
})

// 토큰이 있으면 붙인다. 공개 API(목록·상세)도 토큰을 넣으면 favorited 가 채워진다
axiosInstance.interceptors.request.use((config) => {
  const accessToken = tokenStorage.getAccessToken()
  if (accessToken && !config._skipAuth) config.headers.set('Authorization', `Bearer ${accessToken}`)
  return config
})

// 만료된 토큰이면 공개 API도 AUTH_401_TOKEN 으로 실패한다 → 재발급 후 한 번 다시 보낸다
const EXPIRED_TOKEN_CODE = 'AUTH_401_TOKEN'

// 동시에 여러 요청이 만료돼도 재발급은 한 번만 한다
let reissuing: Promise<boolean> | null = null

const reissue = async () => {
  const refreshToken = tokenStorage.getRefreshToken()
  if (!refreshToken) return false
  try {
    // 인터셉터를 타지 않도록 기본 axios로 보낸다
    const { data } = await axios.post<ApiResponse<ReissueResponse>>(`${baseURL}/auth/reissue`, { refreshToken })
    if (data.resultType !== 'SUCCESS') return false
    tokenStorage.save(data.success.data)
    return true
  } catch {
    return false
  }
}

const isExpiredToken = (error: AxiosError) => {
  const body = error.response?.data as ApiFailResponse | undefined
  return error.response?.status === 401 && body?.error?.code === EXPIRED_TOKEN_CODE
}

// 로그인 실패(아이디·비밀번호 틀림)는 토큰 문제가 아니다
const CREDENTIALS_CODE = 'AUTH_401_CREDENTIALS'

/** 토큰을 붙여 보냈는데 401(만료 말고)이 오면 그 토큰은 못 쓰는 것 → 로그아웃 상태로 바꾼다 */
const isRejectedToken = (error: AxiosError, config: InternalAxiosRequestConfig) => {
  const body = error.response?.data as ApiFailResponse | undefined
  return (
    error.response?.status === 401 &&
    body?.error?.code !== CREDENTIALS_CODE &&
    !isExpiredToken(error) &&
    config.headers.has('Authorization')
  )
}

axiosInstance.interceptors.response.use(undefined, async (error: AxiosError) => {
  const config = error.config as InternalAxiosRequestConfig | undefined
  if (config && isRejectedToken(error, config)) {
    // 로그인해야 하는 화면은 가드가 로그인으로 보낸다
    tokenStorage.clear()
    throw error
  }
  if (!config || config._retried || !isExpiredToken(error)) throw error

  reissuing ??= reissue().finally(() => {
    reissuing = null
  })
  const reissued = await reissuing

  if (reissued) {
    config._retried = true
    return axiosInstance.request(config)
  }

  // 재발급도 실패하면 로그아웃 상태로 바꾸고, 공개 조회는 토큰 없이 한 번 더 보낸다
  tokenStorage.clear()
  if ((config.method ?? 'get').toLowerCase() === 'get') {
    config._retried = true
    config._skipAuth = true
    config.headers.delete('Authorization')
    return axiosInstance.request(config)
  }
  throw error
})
