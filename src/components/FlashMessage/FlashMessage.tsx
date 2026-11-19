import type { Flash } from '../../hooks/useFlashMessage'

/** 화면 아래에 잠깐 뜨는 안내 */
export function FlashMessage({ flash }: { flash: Flash | null }) {
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-[calc(96px+env(safe-area-inset-bottom))] z-[60] flex justify-center px-5"
    >
      {flash && (
        <p
          key={flash.id}
          className="max-w-[420px] animate-toast-in rounded-full bg-ink px-5 py-3 text-center text-label font-bold text-white shadow-float"
        >
          {flash.text}
        </p>
      )}
    </div>
  )
}
