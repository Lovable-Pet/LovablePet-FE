export interface TokenResponse {
  accessToken: string
  refreshToken: string
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
