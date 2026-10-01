import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

async function enableMocking() {
  if (import.meta.env.VITE_ENABLE_MOCK !== 'true') return

  const { worker } = await import('./mocks/browser')
  await worker.start({
    // 핸들러를 빼먹은 API 호출만 경고 (페이지 이동·정적 리소스 요청은 무시)
    onUnhandledFrame({ frame, defaults }) {
      const { request } = frame.data as { request: Request }
      if (new URL(request.url).pathname.startsWith('/api')) defaults.warn()
    },
  })
}

enableMocking().then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
})
