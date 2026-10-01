import { apiClient } from './client'
import type {
  KakaoLoginRequest,
  KakaoLoginResponse,
  LoginRequest,
  LoginResponse,
  LogoutRequest,
  ReissueRequest,
  ReissueResponse,
  SignUpRequest,
  SignUpResponse,
} from './dto/auth.dto'

export const authApi = {
  signUp: (body: SignUpRequest) => apiClient.post<SignUpResponse, SignUpRequest>('/auth/signup', body),
  login: (body: LoginRequest) => apiClient.post<LoginResponse, LoginRequest>('/auth/login', body),
  kakaoLogin: (body: KakaoLoginRequest) =>
    apiClient.post<KakaoLoginResponse, KakaoLoginRequest>('/auth/kakao', body),
  reissue: (body: ReissueRequest) => apiClient.post<ReissueResponse, ReissueRequest>('/auth/reissue', body),
  logout: (body: LogoutRequest) => apiClient.post<void, LogoutRequest>('/auth/logout', body),
}
