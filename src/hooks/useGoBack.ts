import { useNavigate } from 'react-router'

/**
 * 앱 안에서 들어왔으면 뒤로, 주소로 바로 들어왔으면 `fallback` 으로 (기록을 바꿔치기).
 * 나가는 버튼을 <Link replace> 로 만들면 [상세, 상세] 처럼 기록이 겹쳐 하드웨어 뒤로가기가 같은 화면을 한 번 더 보인다
 */
export function useGoBack(fallback = '/') {
  const navigate = useNavigate()
  return () => {
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0
    if (idx > 0) navigate(-1)
    else navigate(fallback, { replace: true })
  }
}
