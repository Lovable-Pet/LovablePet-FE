import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router'
import { useAuth } from '../../features/auth/useAuth'

/**
 * 관리자 화면. 비로그인이면 로그인으로(돌아오게), 일반 회원이면 둘러보기로.
 * 화면 가드는 표시용이고, 서버가 COMMON_403을 주면 각 화면에서 '관리자만 볼 수 있어요'를 보여 준다
 */
export function RequireAdmin({ children }: { children: ReactNode }) {
  const { isLoggedIn, isAdmin } = useAuth()
  const location = useLocation()

  if (!isLoggedIn) {
    const redirect = encodeURIComponent(`${location.pathname}${location.search}`)
    return <Navigate to={`/login?redirect=${redirect}`} replace />
  }
  if (!isAdmin) return <Navigate to="/" replace />
  return children
}
