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
 * 화면 아래에서 올라오는 시트. 열려 있을 때만 그린다 ({open && <BottomSheet />}).
 * <dialog>의 모달 기능으로 포커스 가두기·Esc 닫기·뒤 배경 막기를 처리한다.
 */
export function BottomSheet({ title, onClose, children, footer }: BottomSheetProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const titleId = useId()

  useEffect(() => {
    const dialog = dialogRef.current
    dialog?.showModal()
    // 시트 뒤 화면이 같이 스크롤되지 않게
    const { overflow } = document.body.style
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = overflow
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
      className="mx-auto mt-16 mb-0 h-[calc(100dvh-4rem)] max-h-none w-full max-w-[480px] flex-col rounded-t-sheet bg-surface p-0 text-ink backdrop:bg-ink/50 open:flex"
    >
      <div className="flex justify-center pt-2" aria-hidden>
        <span className="h-1 w-10 rounded-full bg-line-strong" />
      </div>
      <div className="flex items-center justify-between py-2 pr-3 pl-5">
        <h1 id={titleId} className="text-title font-bold">
          {title}
        </h1>
        <IconButton aria-label="닫기" onClick={onClose}>
          <X className="size-5.5" strokeWidth={2} aria-hidden />
        </IconButton>
      </div>
      <div className="flex-1 overflow-y-auto">{children}</div>
      {footer && <div className="border-t border-line-subtle">{footer}</div>}
    </dialog>
  )
}
