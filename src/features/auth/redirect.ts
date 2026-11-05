/**
 * ?redirect= 값을 앱 안 경로로만 받는다 (외부 주소로 보내는 열린 리다이렉트 방지).
 * '/'로 시작하고 '//'(다른 도메인)이나 '/\'로 시작하지 않아야 한다
 */
export const safeRedirect = (value: string | null, fallback = '/') => {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return fallback
  // 로그인 화면으로 다시 보내면 돌고 돌기만 한다
  if (value.startsWith('/login') || value.startsWith('/signup') || value.startsWith('/oauth')) return fallback
  return value
}

/** 로그인·가입 화면 사이를 오갈 때 redirect를 그대로 들고 간다 */
export const withRedirect = (path: string, redirect: string) =>
  redirect === '/' ? path : `${path}?redirect=${encodeURIComponent(redirect)}`
