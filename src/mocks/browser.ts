import { delay, http, HttpResponse } from 'msw'
import { setupWorker } from 'msw/browser'
import { handlers } from '.'

export const worker = setupWorker(...handlers)

declare global {
  interface Window {
    /** 개발 모드 목업에서만: 브라우저 콘솔·E2E 확인에서 응답을 늦추거나 실패시킬 때 쓴다 (worker.use) */
    __msw?: { worker: typeof worker; http: typeof http; HttpResponse: typeof HttpResponse; delay: typeof delay }
  }
}

if (import.meta.env.DEV) window.__msw = { worker, http, HttpResponse, delay }
