import { cn } from '../utils/cn'

export interface LogoProps {
  /** 아이콘 크기 (px) */
  size?: number
  /** 글자 'LovablePet'도 함께 */
  withText?: boolean
  className?: string
}

/** 줄자 눈금 모양 아이콘 */
export function Logo({ size = 26, withText = false, className }: LogoProps) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <svg width={size} height={size} viewBox="0 0 26 26" aria-hidden>
        <rect x="1" y="1" width="24" height="24" rx="7" className="fill-accent" />
        <path
          d="M6 18h14M8 18v-3M11 18v-5M14 18v-3M17 18v-5"
          stroke="#fff"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
      {withText && <span className="text-section font-bold">LovablePet</span>}
    </span>
  )
}
