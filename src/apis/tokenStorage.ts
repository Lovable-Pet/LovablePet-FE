import type { TokenResponse } from './dto/auth.dto'

// 액세스 토큰(30분)·리프레시 토큰(14일). 재발급하면 리프레시 토큰도 바뀌므로(RTR) 응답 값으로 통째로 교체한다
const ACCESS_KEY = 'lp.accessToken'
const REFRESH_KEY = 'lp.refreshToken'

const read = (key: string) => {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

export const tokenStorage = {
  getAccessToken: () => read(ACCESS_KEY),
  getRefreshToken: () => read(REFRESH_KEY),
  save: ({ accessToken, refreshToken }: Pick<TokenResponse, 'accessToken' | 'refreshToken'>) => {
    try {
      localStorage.setItem(ACCESS_KEY, accessToken)
      localStorage.setItem(REFRESH_KEY, refreshToken)
    } catch {
      // 저장소를 쓸 수 없는 환경(사파리 개인 정보 보호 모드 등)에서는 이번 세션만 비로그인으로 동작
    }
  },
  clear: () => {
    try {
      localStorage.removeItem(ACCESS_KEY)
      localStorage.removeItem(REFRESH_KEY)
    } catch {
      // 무시
    }
  },
}
