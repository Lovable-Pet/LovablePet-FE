import { HttpResponse } from 'msw'
import type { MemberRole } from '../apis/dto/auth.dto'
import type { ApiFailResponse, ApiSuccessResponse } from '../apis/dto/common.dto'

const now = () => new Date().toISOString().slice(0, 19)

// 성공·실패를 한 핸들러에서 섞어 돌려주므로 본문 타입을 하나로 묶는다
type Body = ApiSuccessResponse<unknown> | ApiFailResponse

export const success = <T>(data: T, request: Request, status = 200) =>
  HttpResponse.json<Body>(
    {
      resultType: 'SUCCESS',
      success: { data },
      error: null,
      meta: { timestamp: now(), path: new URL(request.url).pathname },
    } satisfies ApiSuccessResponse<T>,
    { status },
  )

export const fail = (status: number, code: string, message: string, request: Request) =>
  HttpResponse.json<Body>(
    {
      resultType: 'FAIL',
      success: null,
      error: { code, message, details: null },
      meta: { timestamp: now(), path: new URL(request.url).pathname },
    },
    { status },
  )

// 목업 토큰: mock-access.{role}.{발급 시각}
export const MOCK_ACCESS_PREFIX = 'mock-access'
export const MOCK_REFRESH_PREFIX = 'mock-refresh'

/** Authorization 헤더의 목업 토큰에서 role을 읽는다. 없거나 모양이 다르면 null */
export const roleOf = (request: Request): MemberRole | null => {
  const token = request.headers.get('Authorization')?.replace(/^Bearer /, '')
  if (!token?.startsWith(`${MOCK_ACCESS_PREFIX}.`)) return null
  const role = token.split('.')[1]
  return role === 'ADMIN' || role === 'USER' ? role : null
}

export const unauthorized = (request: Request) =>
  fail(401, 'COMMON_401', '로그인이 필요합니다.', request)
