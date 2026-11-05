import axios from 'axios'
import { tokenStorage } from './tokenStorage'

export const axiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 10_000,
})

// 토큰이 있으면 붙인다. 공개 API(목록·상세)도 토큰을 넣으면 favorited 가 채워진다
// 주의: 만료된 토큰을 넣으면 공개 API도 AUTH_401_TOKEN 으로 실패하므로 재발급 흐름이 필요하다
axiosInstance.interceptors.request.use((config) => {
  const accessToken = tokenStorage.getAccessToken()
  if (accessToken) config.headers.set('Authorization', `Bearer ${accessToken}`)
  return config
})
