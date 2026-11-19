import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { ApiError } from '../apis/apiError'
import { authApi } from '../apis/auth'
import { tokenStorage } from '../apis/tokenStorage'
import { buttonClass } from '../components/Button/buttonClass'
import { LoadingScreen } from '../components/LoadingScreen/LoadingScreen'
import { StateView } from '../components/StateView/StateView'
import { AUTH_ERROR } from '../constants/auth'
import { safeRedirect, withRedirect } from '../features/auth/redirect'

// /oauth/kakao?code=…&state=… — 카카오에서 돌아온 화면. 인가 코드로 로그인하고 state(돌아갈 경로)로 보낸다
export function KakaoCallbackPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const code = searchParams.get('code')
  const redirect = safeRedirect(searchParams.get('state'))
  const [failure, setFailure] = useState<string | null>(code ? null : '카카오 로그인을 취소했거나 끝내지 못했어요.')
  // 인가 코드는 한 번만 쓸 수 있다 (개발 모드에서 effect 가 두 번 돌아도 한 번만 보낸다)
  const requested = useRef(false)

  useEffect(() => {
    if (!code || requested.current) return
    requested.current = true
    authApi
      .kakaoLogin({ authCode: code })
      .then((tokens) => {
        tokenStorage.save(tokens)
        navigate(redirect, { replace: true })
      })
      .catch((error: unknown) => {
        if (error instanceof ApiError && error.code === AUTH_ERROR.INACTIVE) setFailure('사용이 중지된 계정이에요.')
        else setFailure('카카오 로그인을 끝내지 못했어요. 다시 시도해 주세요.')
      })
  }, [code, navigate, redirect])

  if (!failure) return <LoadingScreen description="카카오로 로그인하고 있어요" />
  return (
    <div className="app-column flex items-center justify-center">
      <StateView
        tone="error"
        title="로그인하지 못했어요"
        description={failure}
        action={
          <Link to={withRedirect('/login', redirect)} replace className={buttonClass()}>
            로그인 화면으로 가기
          </Link>
        }
      />
    </div>
  )
}
