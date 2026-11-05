import { http } from 'msw'
import type {
  KakaoLoginRequest,
  LoginRequest,
  MemberRole,
  RefreshTokenRequest,
  SignUpRequest,
  TokenResponse,
} from '../../apis/dto/auth.dto'
import type { CheckUsernameResponse } from '../../apis/dto/user.dto'
import { MOCK_ACCESS_PREFIX, MOCK_REFRESH_PREFIX, fail, success } from '../utils'

// 목업 계정: lovable / password1234 (일반), admin / admin1234 (관리자)
const members: { username: string; password: string; email: string; nickname: string; role: MemberRole }[] = [
  { username: 'lovable', password: 'password1234', email: 'lovable@example.com', nickname: '러버블', role: 'USER' },
  { username: 'admin', password: 'admin1234', email: 'admin@example.com', nickname: '관리자', role: 'ADMIN' },
]

const USERNAME_RULE = /^[A-Za-z0-9_]{4,20}$/

// 재발급하면 이전 리프레시 토큰은 못 쓴다 (RTR)
const refreshTokens = new Map<string, MemberRole>()

const issue = (role: MemberRole): TokenResponse => {
  const stamp = `${Date.now()}${Math.random().toString(36).slice(2, 6)}`
  const refreshToken = `${MOCK_REFRESH_PREFIX}.${role}.${stamp}`
  refreshTokens.set(refreshToken, role)
  return { accessToken: `${MOCK_ACCESS_PREFIX}.${role}.${stamp}`, refreshToken, role }
}

export const authHandlers = [
  http.post('/api/auth/login', async ({ request }) => {
    const body = (await request.json()) as LoginRequest
    const member = members.find((item) => item.username === body.username && item.password === body.password)
    if (!member) return fail(401, 'AUTH_401_CREDENTIALS', '아이디 또는 비밀번호가 맞지 않습니다.', request)
    return success(issue(member.role), request)
  }),

  http.post('/api/auth/signup', async ({ request }) => {
    const body = (await request.json()) as SignUpRequest
    if (members.some((item) => item.username === body.username))
      return fail(409, 'AUTH_409_USERNAME', '이미 사용 중인 아이디입니다.', request)
    if (members.some((item) => item.email === body.email))
      return fail(409, 'AUTH_409_EMAIL', '이미 사용 중인 이메일입니다.', request)
    members.push({ ...body, role: 'USER' })
    return success(issue('USER'), request, 201)
  }),

  // 목업은 어떤 인가 코드든 일반 회원으로 로그인시킨다
  http.post('/api/auth/kakao', async ({ request }) => {
    const body = (await request.json()) as KakaoLoginRequest
    if (!body.authCode) return fail(400, 'COMMON_400', '인가 코드가 없습니다.', request)
    return success(issue('USER'), request)
  }),

  http.get('/api/auth/check-username', ({ request }) => {
    const username = new URL(request.url).searchParams.get('username') ?? ''
    if (!USERNAME_RULE.test(username))
      return fail(400, 'COMMON_400', '아이디는 영문·숫자·밑줄 4~20자입니다.', request)
    return success<CheckUsernameResponse>(
      { available: !members.some((item) => item.username === username) },
      request,
    )
  }),

  http.post('/api/auth/reissue', async ({ request }) => {
    const { refreshToken } = (await request.json()) as RefreshTokenRequest
    // 새로고침하면 목업 메모리가 비므로, 목록에 없어도 토큰 모양이 맞으면 받아 준다
    const [prefix, tokenRole] = refreshToken.split('.')
    const role =
      refreshTokens.get(refreshToken) ??
      (prefix === MOCK_REFRESH_PREFIX && (tokenRole === 'ADMIN' || tokenRole === 'USER') ? tokenRole : null)
    if (!role) return fail(401, 'AUTH_401_TOKEN', '유효하지 않은 토큰입니다.', request)
    refreshTokens.delete(refreshToken)
    return success(issue(role), request)
  }),

  http.post('/api/auth/logout', async ({ request }) => {
    const { refreshToken } = (await request.json()) as RefreshTokenRequest
    refreshTokens.delete(refreshToken)
    return success(null, request)
  }),
]
