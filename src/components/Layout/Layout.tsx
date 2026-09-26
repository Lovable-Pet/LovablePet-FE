import type { ReactNode } from 'react'
import { cn } from '../utils/cn'

export interface LayoutProps {
  children: ReactNode
  footer?: ReactNode
  dark?: boolean
}

export function Layout({ children, footer, dark }: LayoutProps) {
  return (
    <div
      className={cn(
        'mx-auto flex min-h-screen w-full max-w-sm flex-col',
        dark ? 'bg-base-950 text-white' : 'bg-white',
      )}
    >
      <div className="flex flex-1 flex-col">{children}</div>
      {footer && (
        <div className={cn('border-t', dark ? 'border-white/10' : 'border-base-200')}>
          {footer}
        </div>
      )}
    </div>
  )
}
