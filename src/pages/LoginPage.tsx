import { useState, type FormEvent } from 'react'
import { Eye, EyeOff, MessageCircle } from 'lucide-react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router'
import { ApiError } from '../apis/apiError'
import { authApi } from '../apis/auth'
import { tokenStorage } from '../apis/tokenStorage'
import { Button } from '../components/Button/Button'
import { Field } from '../components/Field/Field'
import { IconButton } from '../components/IconButton/IconButton'
import { AUTH_ERROR } from '../constants/auth'
import { AuthShell } from '../features/auth/AuthShell'
import { kakaoAuthorizeUrl, mockKakaoCallbackPath } from '../features/auth/kakao'
import { safeRedirect, withRedirect } from '../features/auth/redirect'
import { useAuth } from '../features/auth/useAuth'

const messageOf = (error: unknown) => {
  if (error instanceof ApiError) {
    if (error.code === AUTH_ERROR.CREDENTIALS) return '아이디 또는 비밀번호가 맞지 않아요.'
    if (error.code === AUTH_ERROR.INACTIVE) return '사용이 중지된 계정이에요.'
  }
  return '로그인하지 못했어요. 잠시 후 다시 시도해 주세요.'
}

// /login?redirect=… — 로그인하면 redirect(앱 안 경로)로 돌아간다
export function LoginPage() {
  const { isLoggedIn } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const redirect = safeRedirect(searchParams.get('redirect'))

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (isLoggedIn) return <Navigate to={redirect} replace />

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!username.trim() || !password) {
      setError('아이디와 비밀번호를 입력해 주세요.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      tokenStorage.save(await authApi.login({ username: username.trim(), password }))
      navigate(redirect, { replace: true })
    } catch (caught) {
      setError(messageOf(caught))
      setSubmitting(false)
    }
  }

  const startKakao = () => {
    const url = kakaoAuthorizeUrl(redirect)
    if (url) window.location.href = url
    // 카카오 키가 없는 목업 환경
    else navigate(mockKakaoCallbackPath(redirect))
  }

  return (
    <AuthShell title="다시 만나서 반가워요" description="로그인하고 마음이 가는 유기견을 찜해 보세요.">
      <form onSubmit={submit} noValidate className="mt-8 flex flex-col gap-4">
        <Field
          label="아이디"
          name="username"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          value={username}
          onChange={(event) => setUsername(event.target.value)}
        />
        <Field
          label="비밀번호"
          name="password"
          type={showPassword ? 'text' : 'password'}
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          trailing={
            <IconButton
              aria-label={showPassword ? '비밀번호 숨기기' : '비밀번호 보기'}
              aria-pressed={showPassword}
              onClick={() => setShowPassword((prev) => !prev)}
              className="size-10 text-ink-mute"
            >
              {showPassword ? <EyeOff className="size-5" aria-hidden /> : <Eye className="size-5" aria-hidden />}
            </IconButton>
          }
        />
        {error && (
          <p role="alert" className="rounded-tile bg-pink-soft px-4 py-3 text-label font-bold text-pink-deep">
            {error}
          </p>
        )}
        <Button type="submit" size="lg" full disabled={submitting} className="mt-2">
          {submitting ? '로그인하는 중' : '로그인'}
        </Button>
      </form>

      <div className="my-6 flex items-center gap-3 text-caption text-ink-mute">
        <span className="h-px flex-1 bg-line" />
        또는
        <span className="h-px flex-1 bg-line" />
      </div>

      <Button variant="outline" size="lg" full onClick={startKakao} className="bg-apricot-soft shadow-none hover:bg-apricot">
        <MessageCircle className="size-5 fill-ink" strokeWidth={0} aria-hidden />
        카카오로 시작하기
      </Button>

      <p className="mt-8 text-center text-label text-ink-soft">
        처음이신가요?{' '}
        <Link to={withRedirect('/signup', redirect)} replace className="-m-2 p-2 font-extrabold text-primary-deep underline underline-offset-4">
          회원가입
        </Link>
      </p>
    </AuthShell>
  )
}
