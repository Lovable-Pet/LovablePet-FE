const KAKAO_AUTHORIZE_URL = 'https://kauth.kakao.com/oauth/authorize'

/**
 * 카카오 인가 페이지 주소. 돌아올 화면은 state로 들고 가서 /oauth/kakao 에서 꺼낸다.
 * 키가 없으면 null (목업 모드에서는 콜백 화면으로 바로 보낸다)
 */
export const kakaoAuthorizeUrl = (redirect: string) => {
  const clientId = import.meta.env.VITE_KAKAO_REST_KEY
  const redirectUri = import.meta.env.VITE_KAKAO_REDIRECT_URI
  if (!clientId || !redirectUri) return null
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    state: redirect,
  })
  return `${KAKAO_AUTHORIZE_URL}?${params}`
}

/** 키 없이 목업으로 돌 때 쓰는 콜백 주소 */
export const mockKakaoCallbackPath = (redirect: string) =>
  `/oauth/kakao?${new URLSearchParams({ code: 'mock-kakao-code', state: redirect })}`
