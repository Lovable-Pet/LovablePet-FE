import { useSyncExternalStore } from 'react'
import type { MemberRole } from '../../apis/dto/auth.dto'
import { tokenStorage } from '../../apis/tokenStorage'

// 토큰이 있으면 로그인 상태. role이 저장돼 있지 않은 예전 토큰은 일반 회원으로 본다
const getRole = (): MemberRole | null =>
  tokenStorage.getAccessToken() ? (tokenStorage.getRole() ?? 'USER') : null

export function useAuth() {
  const role = useSyncExternalStore(tokenStorage.subscribe, getRole, () => null)
  return {
    isLoggedIn: role !== null,
    role,
    isAdmin: role === 'ADMIN',
  }
}
