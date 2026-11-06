import { ChevronLeft, X } from 'lucide-react'
import { useNavigate } from 'react-router'
import { IconButton } from '../../components/IconButton/IconButton'

export interface AuthHeaderProps {
  /** close: 닫기(X, 로그인) / back: 뒤로(<, 회원가입) */
  kind: 'close' | 'back'
  title?: string
  /** 앱 안 기록이 없을 때 갈 곳 */
  fallback: string
}

export function AuthHeader({ kind, title, fallback }: AuthHeaderProps) {
  const navigate = useNavigate()
  const leave = () => {
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0
    if (idx > 0) navigate(-1)
    else navigate(fallback, { replace: true })
  }

  return (
    <header className="flex h-14 items-center px-2">
      <IconButton aria-label={kind === 'close' ? '닫기' : '뒤로'} onClick={leave}>
        {kind === 'close' ? (
          <X className="size-5.5" strokeWidth={2} aria-hidden />
        ) : (
          // 마우스를 올리면 뒤쪽(왼쪽)으로 2px
          <ChevronLeft className="size-5.5 transition group-hover:-translate-x-0.5" strokeWidth={2} aria-hidden />
        )}
      </IconButton>
      {title && <h1 className="text-subtitle font-bold">{title}</h1>}
    </header>
  )
}
