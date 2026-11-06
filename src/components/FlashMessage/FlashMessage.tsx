import type { Flash } from '../../hooks/useFlashMessage'

export interface FlashMessageProps {
  flash: Flash | null
}

/**
 * 토스트. 하단 가운데, 하단 바(탭·버튼 바)가 있으면 그 위에 뜬다.
 * 띄울 높이는 --toast-offset (index.css 의 data-bottom-bar 규칙) + 홈 바 높이.
 * 화면 읽기 도구에도 읽힌다
 */
export function FlashMessage({ flash }: FlashMessageProps) {
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-[calc(var(--toast-offset)+env(safe-area-inset-bottom))] z-20 mx-auto flex w-full max-w-[480px] justify-center px-5"
    >
      {flash && (
        <p
          key={flash.id}
          className="animate-toast-in rounded-full bg-ink px-4 py-2.5 text-body font-medium text-white shadow-segment"
        >
          {flash.text}
        </p>
      )}
    </div>
  )
}
