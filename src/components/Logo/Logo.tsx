import { PawPrint } from 'lucide-react'
import wordmark from '../../assets/logo-wordmark.png'
import { cn } from '../utils/cn'

/** 머리 영역 로고: 발바닥 + Lovable Pet 글자 그림 */
export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5', className)}>
      <PawPrint aria-hidden className="size-6 fill-apricot text-apricot" strokeWidth={1.5} />
      <img src={wordmark} alt="Lovable Pet" className="h-6 w-auto" />
    </span>
  )
}

/** 시작 화면의 큰 로고 (두 줄) */
export function LogoStacked({ className }: { className?: string }) {
  return (
    <span role="img" aria-label="Lovable Pet" className={cn('block text-center font-display leading-[0.95]', className)}>
      <span aria-hidden className="block text-[4.25rem] text-ink">
        Lovable
      </span>
      <span aria-hidden className="block text-[4.25rem] text-primary">
        Pet
      </span>
    </span>
  )
}
