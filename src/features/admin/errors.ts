import { ApiError } from '../../apis/apiError'

/** 서버가 COMMON_403을 줬는지 (토큰의 role이 바뀐 경우 등) */
export const isForbidden = (error: unknown) => error instanceof ApiError && error.status === 403

/** 서버 에러 메시지를 그대로 보여 줄 때 (없으면 기본 문구) */
export const errorMessageOf = (error: unknown, fallback: string) =>
  error instanceof ApiError && error.message ? error.message : fallback
