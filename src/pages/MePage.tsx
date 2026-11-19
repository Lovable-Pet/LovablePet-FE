import { useState } from 'react'
import { ChevronRight, Heart, LogOut, Wand2 } from 'lucide-react'
import { Link } from 'react-router'
import { authApi } from '../apis/auth'
import { tokenStorage } from '../apis/tokenStorage'
import { useFlash } from '../app/flash'
import { Character } from '../components/Character/Character'
import { Badge } from '../components/Badge/Badge'
import { buttonClass } from '../components/Button/buttonClass'
import { useAuth } from '../features/auth/useAuth'

// /me — 내 정보. 로그인하지 않았으면 로그인·가입으로 안내한다
export function MePage() {
  const { isLoggedIn, isAdmin } = useAuth()
  const showFlash = useFlash()
  const [loggingOut, setLoggingOut] = useState(false)

  const logout = async () => {
    setLoggingOut(true)
    const refreshToken = tokenStorage.getRefreshToken()
    try {
      // 서버에서 리프레시 토큰을 지운다. 실패해도 이 기기에서는 로그아웃한다
      if (refreshToken) await authApi.logout({ refreshToken })
    } catch {
      // 무시
    }
    tokenStorage.clear()
    setLoggingOut(false)
    showFlash('로그아웃했어요')
  }

  return (
    <main className="px-5 pt-[calc(20px+env(safe-area-inset-top))]">
      <h1 className="font-display text-title">마이페이지</h1>

      {isLoggedIn ? (
        <>
          <div className="mt-5 flex items-center gap-4 rounded-card bg-pink-soft p-5">
            <Character name="sitting" size={72} />
            <div>
              <p className="text-emphasis font-extrabold">로그인했어요</p>
              <Badge tone={isAdmin ? 'info' : 'neutral'} className="mt-1 bg-surface">
                {isAdmin ? '관리자' : '일반 회원'}
              </Badge>
            </div>
          </div>

          <ul className="mt-4 overflow-hidden rounded-card bg-surface shadow-soft">
            <MenuLink to="/favorites" icon={<Heart className="size-5" strokeWidth={2} aria-hidden />} label="찜한 유기견" />
            {isAdmin && (
              <MenuLink to="/admin" icon={<Wand2 className="size-5" strokeWidth={2} aria-hidden />} label="관리자 화면 (AR 모델 만들기)" />
            )}
            <li>
              <button
                type="button"
                onClick={logout}
                disabled={loggingOut}
                className="flex h-14 w-full items-center gap-3 px-4 text-left text-body font-bold text-pink-deep -outline-offset-4 transition-colors duration-150 hover:bg-pink-soft disabled:opacity-50"
              >
                <LogOut className="size-5" strokeWidth={2} aria-hidden />
                {loggingOut ? '로그아웃하는 중' : '로그아웃'}
              </button>
            </li>
          </ul>
        </>
      ) : (
        <div className="relative mt-5 rounded-card bg-pink-soft p-6">
          <div aria-hidden className="pointer-events-none absolute -top-7 right-3">
            <Character name="love" size={104} />
          </div>
          <h2 className="max-w-[60%] font-display text-heading">로그인하면 찜할 수 있어요</h2>
          <p className="mt-1.5 text-body text-ink-soft">마음이 가는 유기견을 모아 두고 다시 볼 수 있어요.</p>
          <div className="mt-5 flex flex-col gap-2">
            <Link to="/login?redirect=%2Fme" className={buttonClass({ size: 'lg', full: true })}>
              로그인
            </Link>
            <Link to="/signup?redirect=%2Fme" className={buttonClass({ variant: 'outline', size: 'lg', full: true })}>
              회원가입
            </Link>
          </div>
        </div>
      )}
    </main>
  )
}

function MenuLink({ to, icon, label }: { to: string; icon: React.ReactNode; label: string }) {
  return (
    <li className="border-b border-line">
      <Link to={to} className="flex h-14 items-center gap-3 px-4 text-body font-bold -outline-offset-4 transition-colors duration-150 hover:bg-pink-soft">
        <span className="text-primary-deep">{icon}</span>
        <span className="flex-1">{label}</span>
        <ChevronRight className="size-5 text-ink-mute" strokeWidth={2} aria-hidden />
      </Link>
    </li>
  )
}
