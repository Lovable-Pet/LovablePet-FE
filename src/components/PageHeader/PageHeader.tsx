import type { ReactNode } from 'react'
import { ChevronLeft } from 'lucide-react'
import { IconButton } from '../IconButton/IconButton'

interface PageHeaderProps {
  onBack: () => void
  title?: string
  /** 오른쪽에 놓는 버튼 */
  trailing?: ReactNode
}

/** 뒤로 버튼이 있는 화면 머리 */
export function PageHeader({ onBack, title, trailing }: PageHeaderProps) {
  return (
    <header className="pt-[env(safe-area-inset-top)]">
      <div className="flex h-14 items-center gap-1 px-2">
      <IconButton aria-label="뒤로" onClick={onBack}>
        <ChevronLeft className="size-6" strokeWidth={2} aria-hidden />
      </IconButton>
      {title && <h1 className="min-w-0 flex-1 truncate text-emphasis font-extrabold">{title}</h1>}
      {trailing && <div className="ml-auto flex items-center">{trailing}</div>}
      </div>
    </header>
  )
}
