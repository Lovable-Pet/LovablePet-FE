import { cn } from '../utils/cn'

export interface FlashMessageProps {
  message: string | null
  /** 화면 아래에서 띄울 거리 (하단 바 위에 보이게) */
  className?: string
}

/** 화면 아래쪽에 잠깐 뜨는 안내. 화면 읽기 도구에도 읽힌다 */
export function FlashMessage({ message, className }: FlashMessageProps) {
  return (
    <div
      aria-live="polite"
      className={cn('pointer-events-none fixed inset-x-0 z-20 mx-auto flex w-full max-w-[480px] justify-center px-5', className)}
    >
      {message && (
        <p className="rounded-full bg-ink px-4 py-2.5 text-body font-medium text-white shadow-segment">{message}</p>
      )}
    </div>
  )
}
