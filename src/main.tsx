import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

async function enableMocking() {
  // true: 전부 목업, auth: 로그인(과 찜)만 목업이고 유기견 데이터는 실제 백엔드
  const mode = import.meta.env.VITE_ENABLE_MOCK
  if (mode !== 'true' && mode !== 'auth') return

  const { worker } = await import('./mocks/browser')
  if (mode === 'auth') {
    const { authOnlyHandlers } = await import('./mocks/handlers/authOnly')
    worker.resetHandlers(...authOnlyHandlers)
  }
  await worker.start({
    // 핸들러를 빼먹은 API 호출만 경고 (페이지 이동·정적 리소스 요청은 무시)
    onUnhandledFrame({ frame, defaults }) {
      const { request } = frame.data as { request: Request }
      if (new URL(request.url).pathname.startsWith('/api')) defaults.warn()
    },
  })

  // 서비스 워커는 '목업을 켠 탭' 목록을 메모리에만 둔다. 탭을 한동안 안 보면 브라우저가 워커를 쉬게 했다가
  // 다시 깨우는데, 그때 목록이 비어 요청이 실제 백엔드로 새어 나간다 (목업 로그인이 갑자기 풀린다).
  // 그래서 탭으로 돌아올 때와 10초마다 다시 등록한다
  const reactivate = () => navigator.serviceWorker.controller?.postMessage('MOCK_ACTIVATE')
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') reactivate()
  })
  window.addEventListener('focus', reactivate)
  window.addEventListener('pageshow', reactivate)
  setInterval(reactivate, 10_000)
}

enableMocking().then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
})
