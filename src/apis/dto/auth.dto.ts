/** ADMIN 이면 관리자 기능(AR 만들기 등)을 보여 준다 */
export type MemberRole = 'USER' | 'ADMIN'

export interface TokenResponse {
  /** Authorization: Bearer {accessToken} (기본 30분) */
  accessToken: string
  /** 재발급용 (기본 14일). 재발급하면 새 값으로 바뀐다 */
  refreshToken: string
  role: MemberRole
}

export interface SignUpRequest {
  username: string
  email: string
  password: string
  nickname: string
}

export type SignUpResponse = TokenResponse

export interface LoginRequest {
  username: string
  password: string
}

export type LoginResponse = TokenResponse

export interface KakaoLoginRequest {
  authCode: string
}

export type KakaoLoginResponse = TokenResponse

export interface RefreshTokenRequest {
  refreshToken: string
}

export type ReissueRequest = RefreshTokenRequest

export type ReissueResponse = TokenResponse

export type LogoutRequest = RefreshTokenRequest
