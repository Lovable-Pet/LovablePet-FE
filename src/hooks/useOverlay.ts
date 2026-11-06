import { useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router'

interface OverlayHistoryState {
  overlay?: string
}

/**
 * 시트·모달을 연 상태를 방문 기록(history.state)에 남긴다.
 * 그래서 뒤로가기를 누르면 화면을 떠나지 않고 오버레이만 닫힌다.
 *
 * - open: 같은 주소로 기록을 하나 쌓는다 (스크롤은 그대로)
 * - close: 쌓은 기록을 되돌린다 (뒤로가기와 같다)
 * - 오버레이 안에서 주소를 바꾸며 닫을 때(필터 적용)는 replace 로 이동하면
 *   오버레이 기록이 새 주소로 바뀌면서 같이 닫힌다
 */
export function useOverlay(name: string) {
  const location = useLocation()
  const navigate = useNavigate()
  const state = location.state as OverlayHistoryState | null
  const isOpen = state?.overlay === name

  const open = useCallback(() => {
    if (isOpen) return
    navigate(
      { pathname: location.pathname, search: location.search, hash: location.hash },
      { state: { ...state, overlay: name }, preventScrollReset: true },
    )
  }, [isOpen, location.pathname, location.search, location.hash, name, navigate, state])

  const close = useCallback(() => {
    if (!isOpen) return
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0
    if (idx > 0) {
      navigate(-1)
      return
    }
    // 새로고침 등으로 앞 기록이 없으면 오버레이 표시만 지운다
    const { overlay: _closed, ...rest } = state ?? {}
    navigate(
      { pathname: location.pathname, search: location.search, hash: location.hash },
      { replace: true, state: rest, preventScrollReset: true },
    )
  }, [isOpen, location.pathname, location.search, location.hash, navigate, state])

  return { isOpen, open, close }
}
