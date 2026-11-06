import { useState, type FormEvent } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router'
import { ApiError } from '../apis/apiError'
import { authApi } from '../apis/auth'
import type { LoginRequest } from '../apis/dto/auth.dto'
import { tokenStorage } from '../apis/tokenStorage'
import { useFlash } from '../app/flash'
import { Button } from '../components/Button/Button'
import { Field } from '../components/Field/Field'
import { Logo } from '../components/Logo/Logo'
import { AUTH_ERROR } from '../constants/auth'
import { AuthHeader } from '../features/auth/AuthHeader'
import { kakaoAuthorizeUrl, mockKakaoCallbackPath } from '../features/auth/kakao'
import { safeRedirect, withRedirect } from '../features/auth/redirect'
import { useAuth } from '../features/auth/useAuth'

export function LoginPage() {
  const [searchParams] = useSearchParams()
  const redirect = safeRedirect(searchParams.get('redirect'))
  const navigate = useNavigate()
  const showFlash = useFlash()
  const { isLoggedIn } = useAuth()

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

  const login = useMutation({
    mutationFn: (body: LoginRequest) => authApi.login(body),
    onSuccess: (tokens) => {
      tokenStorage.save(tokens)
      navigate(redirect, { replace: true })
    },
    onError: (loginError) => {
      const code = loginError instanceof ApiError ? loginError.code : null
      setError(
        code === AUTH_ERROR.CREDENTIALS
          ? '아이디 또는 비밀번호가 맞지 않아요.'
          : code === AUTH_ERROR.INACTIVE
            ? '탈퇴했거나 이용할 수 없는 계정이에요.'
            : '로그인하지 못했어요. 잠시 후 다시 시도해 주세요.',
      )
    },
  })

  // 이미 로그인했으면 돌아갈 곳으로 (로그인 성공 직후의 이동과 겹치지 않게 요청 중엔 두지 않는다)
  if (isLoggedIn && !login.isPending && !login.isSuccess) return <Navigate to={redirect} replace />

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!username.trim() || !password) {
      setError('아이디와 비밀번호를 입력해 주세요.')
      return
    }
    setError(null)
    login.mutate({ username: username.trim(), password })
  }

  const startKakao = () => {
    const url = kakaoAuthorizeUrl(redirect)
    if (url) {
      window.location.assign(url)
      return
    }
    // 카카오 키가 아직 없다: 목업이면 콜백 화면으로 바로, 아니면 안내
    if (import.meta.env.VITE_ENABLE_MOCK === 'true') navigate(mockKakaoCallbackPath(redirect))
    else showFlash('카카오 로그인을 준비하고 있어요.')
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col bg-canvas pt-[env(safe-area-inset-top)]">
      <AuthHeader kind="close" fallback="/" />

      <div className="px-6 pt-3">
        <Logo size={40} />
        <h1 className="mt-4 text-headline font-bold">
          마음에 남는 아이를
          <br />
          찜해 두세요
        </h1>
        <p className="mt-2 text-body-lg text-ink-tertiary">둘러보기와 AR은 로그인 없이도 쓸 수 있어요.</p>
      </div>

      <div className="flex flex-col gap-2.5 px-6 pt-8">
        <Button variant="kakao" fullWidth onClick={startKakao}>
          <KakaoIcon />
          카카오로 시작하기
        </Button>

        <div className="mt-3.5 mb-1 flex items-center gap-3 text-label text-ink-caption">
          <span className="h-px flex-1 bg-line" aria-hidden />
          또는 아이디로
          <span className="h-px flex-1 bg-line" aria-hidden />
        </div>

        <form onSubmit={submit} className="flex flex-col gap-2.5" noValidate>
          <Field
            label="아이디"
            autoComplete="username"
            placeholder="영문·숫자·밑줄 4~20자"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
          />
          <Field
            label="비밀번호"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            error={error ?? undefined}
          />
          <Button type="submit" variant="dark" fullWidth className="mt-1.5" disabled={login.isPending}>
            {login.isPending ? '로그인하는 중…' : '로그인'}
          </Button>
        </form>
      </div>

      <div className="mt-auto flex justify-center gap-1.5 px-6 pt-8 pb-[calc(32px+env(safe-area-inset-bottom))] text-body text-ink-tertiary">
        처음이신가요?
        <Link
          to={withRedirect('/signup', redirect)}
          className="font-semibold text-accent touch-target hover:underline hover:underline-offset-3"
        >
          회원가입
        </Link>
      </div>
    </div>
  )
}

function KakaoIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden>
      <path
        d="M12 3C6.5 3 2 6.6 2 11c0 2.8 1.9 5.3 4.7 6.7l-1 3.6c-.1.3.3.6.6.4l4.2-2.8c.5.1 1 .1 1.5.1 5.5 0 10-3.6 10-8S17.5 3 12 3z"
        className="fill-kakao-ink"
      />
    </svg>
  )
}
