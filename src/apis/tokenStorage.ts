import type { MemberRole, TokenResponse } from './dto/auth.dto'

// 액세스 토큰(30분)·리프레시 토큰(14일). 재발급하면 리프레시 토큰도 바뀌므로(RTR) 응답 값으로 통째로 교체한다
// role은 로그인·가입·카카오·재발급 응답에 같이 오므로 그대로 저장한다 (JWT를 직접 읽지 않는다)
const ACCESS_KEY = 'lp.accessToken'
const REFRESH_KEY = 'lp.refreshToken'
const ROLE_KEY = 'lp.role'

const read = (key: string) => {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

const listeners = new Set<() => void>()
const notify = () => listeners.forEach((listener) => listener())

export const tokenStorage = {
  getAccessToken: () => read(ACCESS_KEY),
  getRefreshToken: () => read(REFRESH_KEY),
  getRole: (): MemberRole | null => {
    const role = read(ROLE_KEY)
    return role === 'ADMIN' || role === 'USER' ? role : null
  },
  save: ({ accessToken, refreshToken, role }: TokenResponse) => {
    try {
      localStorage.setItem(ACCESS_KEY, accessToken)
      localStorage.setItem(REFRESH_KEY, refreshToken)
      localStorage.setItem(ROLE_KEY, role)
    } catch {
      // 저장소를 쓸 수 없는 환경(사파리 개인 정보 보호 모드 등)에서는 이번 세션만 비로그인으로 동작
    }
    notify()
  },
  clear: () => {
    try {
      localStorage.removeItem(ACCESS_KEY)
      localStorage.removeItem(REFRESH_KEY)
      localStorage.removeItem(ROLE_KEY)
    } catch {
      // 무시
    }
    notify()
  },
  /** 로그인 상태가 바뀌면 알림 (다른 탭에서 바뀐 것도 포함) */
  subscribe: (listener: () => void) => {
    listeners.add(listener)
    const onStorage = (event: StorageEvent) => {
      if (event.key === null || [ACCESS_KEY, REFRESH_KEY, ROLE_KEY].includes(event.key)) listener()
    }
    window.addEventListener('storage', onStorage)
    return () => {
      listeners.delete(listener)
      window.removeEventListener('storage', onStorage)
    }
  },
}
