import { useEffect, useId, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { IconButton } from '../IconButton/IconButton'

export interface BottomSheetProps {
  title: string
  onClose: () => void
  children: ReactNode
  /** 아래에 붙는 버튼 영역 */
  footer?: ReactNode
}

/**
 * 오버레이. 모바일은 아래에서 올라오는 시트(위쪽만 둥글게, 손잡이), 태블릿부터는 가운데 모달.
 * 열려 있을 때만 그린다 ({open && <BottomSheet />}). 뒤로가기로 닫으려면 useOverlay 와 같이 쓴다.
 *
 * - <dialog>의 모달 기능으로 포커스 가두기·Esc 닫기·뒤 배경 막기
 * - 열려 있는 동안 뒤 화면 스크롤 잠금, 시트 안을 끝까지 스크롤해도 뒤로 넘어가지 않게(overscroll-contain)
 * - 키보드가 뜨면 --keyboard-inset 만큼 줄여서 아래 버튼 영역이 키보드 위에 붙는다
 */
export function BottomSheet({ title, onClose, children, footer }: BottomSheetProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const titleId = useId()

  useEffect(() => {
    const dialog = dialogRef.current
    dialog?.showModal()
    // 시트 뒤 화면이 같이 스크롤되지 않게 (아이폰 사파리는 html 도 막아야 한다)
    const { documentElement: html, body } = document
    const previous = { html: html.style.overflow, body: body.style.overflow }
    html.style.overflow = 'hidden'
    body.style.overflow = 'hidden'
    return () => {
      html.style.overflow = previous.html
      body.style.overflow = previous.body
      dialog?.close()
    }
  }, [])

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
      // 시트 밖(배경)을 누르면 닫는다
      onClick={(event) => {
        if (event.target === dialogRef.current) onClose()
      }}
      className={[
        // 모바일: 아래에 붙는 시트
        'mx-auto mt-16 mb-(--keyboard-inset) h-[calc(100dvh-4rem-var(--keyboard-inset))] max-h-none w-full max-w-[480px]',
        'flex-col overscroll-contain rounded-t-sheet bg-surface p-0 text-ink open:flex',
        'animate-sheet-up backdrop:animate-fade-in backdrop:bg-ink/50',
        // 태블릿부터: 가운데 모달
        'tablet:m-auto tablet:h-auto tablet:max-h-[min(760px,calc(100dvh-80px-var(--keyboard-inset)))]',
        'tablet:rounded-sheet tablet:animate-modal-in',
      ].join(' ')}
    >
      <div className="flex justify-center pt-2 tablet:hidden" aria-hidden>
        <span className="h-1 w-10 rounded-full bg-line-strong" />
      </div>
      <div className="flex items-center justify-between py-2 pr-3 pl-5 tablet:pt-4">
        <h1 id={titleId} className="text-title font-bold">
          {title}
        </h1>
        <IconButton aria-label="닫기" onClick={onClose}>
          <X className="size-5.5" strokeWidth={2} aria-hidden />
        </IconButton>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</div>
      {footer && (
        // 홈 바에 버튼이 가리지 않게 (키보드가 떠 있으면 키보드 위라서 필요 없다)
        <div className="border-t border-line-subtle pb-[max(0px,calc(env(safe-area-inset-bottom)-var(--keyboard-inset)))] tablet:pb-0">
          {footer}
        </div>
      )}
    </dialog>
  )
}
