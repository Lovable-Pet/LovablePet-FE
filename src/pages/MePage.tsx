import { useState } from 'react'
import { ChevronRight, Heart, UserRound } from 'lucide-react'
import { Link, useNavigate } from 'react-router'
import { authApi } from '../apis/auth'
import { tokenStorage } from '../apis/tokenStorage'
import { Badge } from '../components/Badge/Badge'
import { Button } from '../components/Button/Button'
import { buttonStyles } from '../components/Button/buttonStyles'
import { useAuth } from '../features/auth/useAuth'

/** 마이 (캔버스 15). 로그인 전·일반 회원·관리자 세 모양 */
export function MePage() {
  const { isLoggedIn, isAdmin } = useAuth()

  return (
    <div className="pb-6">
      <header className="flex h-14 items-center px-5">
        <h1 className="text-title font-bold">마이</h1>
      </header>
      <div className="flex flex-col gap-3 px-4 pt-1">{isLoggedIn ? <SignedIn isAdmin={isAdmin} /> : <Guest />}</div>
    </div>
  )
}

function Guest() {
  return (
    <section className="rounded-card-lg bg-surface px-5 py-7 text-center">
      <Heart className="mx-auto mb-3 size-11 text-accent" strokeWidth={1.6} aria-hidden />
      <p className="text-emphasis font-semibold">로그인하면 찜한 아이를 모아 볼 수 있어요</p>
      <p className="mt-1.5 mb-5 text-body text-ink-tertiary">둘러보기와 AR은 로그인 없이도 쓸 수 있어요.</p>
      <Link to="/login?redirect=%2Fme" className={buttonStyles({ variant: 'dark', fullWidth: true })}>
        로그인
      </Link>
      <Link
        to="/signup?redirect=%2Fme"
        className="mt-3.5 inline-block text-body text-ink-secondary underline underline-offset-3 touch-target hover:text-ink"
      >
        아이디로 회원가입
      </Link>
    </section>
  )
}

function SignedIn({ isAdmin }: { isAdmin: boolean }) {
  const navigate = useNavigate()
  const [loggingOut, setLoggingOut] = useState(false)

  // 서버 호출이 실패해도 이 기기의 토큰은 지우고 둘러보기로 간다
  const logout = async () => {
    setLoggingOut(true)
    const refreshToken = tokenStorage.getRefreshToken()
    try {
      if (refreshToken) await authApi.logout({ refreshToken })
    } catch {
      // 무시
    } finally {
      tokenStorage.clear()
      navigate('/', { replace: true })
    }
  }

  return (
    <>
      <section className="flex items-center gap-3.5 rounded-card-lg bg-surface px-5 py-4.5">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
          <UserRound className="size-6" strokeWidth={1.9} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-emphasis font-semibold">로그인되어 있어요</p>
          <p className="mt-0.75 text-label text-ink-tertiary">{isAdmin ? '관리자 계정' : '일반 회원'}</p>
        </div>
      </section>

      <Link
        to="/favorites"
        className="group flex h-15 items-center justify-between rounded-card-lg bg-surface px-5 text-body-lg font-medium transition hover:bg-surface-hover active:scale-99"
      >
        찜한 아이 보기
        <ForwardIcon className="text-ink-caption" />
      </Link>

      {isAdmin && (
        <Link
          to="/admin"
          className="group flex items-center gap-3.5 rounded-card-lg bg-ink px-5 py-4 text-white transition hover:bg-ink-hover active:scale-99"
        >
          <Badge tone="measure" size="sm">
            관리자
          </Badge>
          <span className="min-w-0 flex-1">
            <span className="block text-body-lg font-semibold">관리자 화면</span>
            <span className="mt-0.5 block text-label text-on-dark-secondary">AR 모델 만들기 · 생성 기록</span>
          </span>
          <ForwardIcon className="text-on-dark-secondary" />
        </Link>
      )}

      <Button
        variant="outline-subtle"
        size="md"
        className="mt-2"
        onClick={logout}
        disabled={loggingOut}
      >
        {loggingOut ? '로그아웃하는 중…' : '로그아웃'}
      </Button>
    </>
  )
}

/** 앞으로 화살표. 감싼 링크에 마우스를 올리면 진행 방향(오른쪽)으로 2px */
function ForwardIcon({ className }: { className: string }) {
  return (
    <ChevronRight
      className={`size-4.5 shrink-0 transition group-hover:translate-x-0.5 ${className}`}
      strokeWidth={2}
      aria-hidden
    />
  )
}
