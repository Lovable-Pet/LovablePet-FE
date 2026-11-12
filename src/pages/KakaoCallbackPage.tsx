import { useEffect, useRef } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { ApiError } from '../apis/apiError'
import { authApi } from '../apis/auth'
import { tokenStorage } from '../apis/tokenStorage'
import { buttonStyles } from '../components/Button/buttonStyles'
import { StateView } from '../components/StateView/StateView'
import { AUTH_ERROR } from '../constants/auth'
import { safeRedirect, withRedirect } from '../features/auth/redirect'
import { LoadingScreen } from '../components/LoadingScreen/LoadingScreen'

/** 카카오 인가 후 돌아오는 화면 (/oauth/kakao?code=…&state=돌아갈 경로) */
export function KakaoCallbackPage() {
  const [searchParams] = useSearchParams()
  const code = searchParams.get('code')
  const redirect = safeRedirect(searchParams.get('state'))
  // 사용자가 카카오 동의 화면에서 취소하면 error=access_denied 로 돌아온다
  const denied = searchParams.get('error') !== null
  const navigate = useNavigate()

  const kakaoLogin = useMutation({
    mutationFn: (authCode: string) => authApi.kakaoLogin({ authCode }),
    onSuccess: (tokens) => {
      tokenStorage.save(tokens)
      navigate(redirect, { replace: true })
    },
  })

  // 인가 코드는 한 번만 쓸 수 있어서 개발 모드(StrictMode)에서 두 번 보내지 않게 막는다
  const sentRef = useRef(false)
  const { mutate } = kakaoLogin
  useEffect(() => {
    if (!code || denied || sentRef.current) return
    sentRef.current = true
    mutate(code)
  }, [code, denied, mutate])

  const failed = !code || denied || kakaoLogin.isError
  const errorCode = kakaoLogin.error instanceof ApiError ? kakaoLogin.error.code : null
  const failDescription =
    errorCode === AUTH_ERROR.INACTIVE
      ? '탈퇴했거나 이용할 수 없는 계정이에요.'
      : errorCode === AUTH_ERROR.KAKAO_CODE
        ? '로그인 시간이 지났어요. 카카오로 다시 시작해 주세요.'
        : '잠시 후 다시 시도해 주세요.'

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col justify-center bg-canvas px-4 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      {failed ? (
        <StateView
          tone={denied ? 'empty' : 'error'}
          title={denied ? '카카오 로그인을 취소했어요' : '카카오로 로그인하지 못했어요'}
          description={denied ? '둘러보기와 AR은 로그인 없이도 쓸 수 있어요.' : failDescription}
          action={
            <Link to={withRedirect('/login', redirect)} replace className={buttonStyles({ variant: 'dark', size: 'md' })}>
              로그인 화면으로
            </Link>
          }
        />
      ) : (
        <LoadingScreen title="카카오로 로그인하는 중이에요" className="min-h-0" />
      )}
    </div>
  )
}
