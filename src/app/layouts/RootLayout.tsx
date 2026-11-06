import { Outlet, ScrollRestoration } from 'react-router'
import { useKeyboardInset } from '../../hooks/useKeyboardInset'

/**
 * 모든 화면을 감싼다.
 * - ScrollRestoration: 다른 화면으로 가면 맨 위에서, 뒤로가기로 돌아오면 그 기록의 스크롤 위치로.
 *   위치는 방문 기록 하나하나(location.key)에 따로 저장한다 (주소가 같아도 기록이 다르면 다른 위치).
 *   같은 화면 안에서 주소만 바꿀 때(필터·정렬, 시트 열기)는 preventScrollReset 으로 스크롤을 두고 간다
 * - useKeyboardInset: 가상 키보드 높이를 --keyboard-inset 에 넣는다
 */
export function RootLayout() {
  useKeyboardInset()
  return (
    <>
      <ScrollRestoration />
      <Outlet />
    </>
  )
}
