import { cn } from '../utils/cn'

export type ButtonVariant =
  | 'primary' // 주 버튼 (주황)
  | 'dark' // 진한 버튼 (로그인, 빈 목록 CTA)
  | 'soft' // 회색 면 (보호소 문의)
  | 'outline' // 흰 바탕 + 선 (전화하기, 초기화)
  | 'outline-strong' // 흰 바탕 + 진한 선 (중복 확인)
  | 'outline-subtle' // 투명 바탕 + 선 + 보조 글자색 (초기화, 로그아웃)
  | 'measure' // 노랑 (크기 카드·AR 화면 CTA)
  | 'accent-soft' // 옅은 주황 (찜 목록의 AR 버튼)
  | 'kakao'

/**
 * xl 56 (AR 시작) / lg 52 (주 버튼) / md 48 (보조) / sm 44 (작은 보조)
 * field 50: 입력칸 옆에 붙는 버튼 (중복 확인). 입력칸과 높이·둥글기를 맞춘다
 * xs 36: 관리자 표 안 버튼 (데스크톱 전용)
 */
export type ButtonSize = 'xl' | 'lg' | 'md' | 'sm' | 'field' | 'xs'

const sizeClasses: Record<ButtonSize, string> = {
  xl: 'h-14 px-5 rounded-button text-emphasis',
  lg: 'h-13 px-5 rounded-button text-emphasis',
  md: 'h-12 px-5 rounded-button text-body-lg',
  sm: 'h-11 px-4 rounded-input text-body',
  field: 'h-12.5 px-3.5 rounded-input text-body',
  xs: 'h-9 px-3.5 rounded-button-sm text-label',
}

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-white',
  dark: 'bg-ink text-white',
  soft: 'bg-muted text-ink',
  outline: 'border border-line bg-surface text-ink',
  'outline-strong': 'border border-ink bg-surface text-ink',
  'outline-subtle': 'border border-line bg-transparent text-ink-secondary',
  measure: 'bg-measure text-ink font-bold',
  'accent-soft': 'bg-accent-soft text-accent-ink',
  kakao: 'bg-kakao text-kakao-ink',
}

export interface ButtonStyleOptions {
  variant?: ButtonVariant
  size?: ButtonSize
  fullWidth?: boolean
  className?: string
}

/** <Button>과 버튼 모양 링크(<Link>, <a>)가 같은 모양을 쓰도록 클래스만 만든다 */
export const buttonStyles = ({
  variant = 'primary',
  size = 'lg',
  fullWidth,
  className,
}: ButtonStyleOptions = {}) =>
  cn(
    'inline-flex shrink-0 items-center justify-center gap-2 font-semibold whitespace-nowrap transition-opacity',
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
    'disabled:pointer-events-none disabled:opacity-45 aria-disabled:pointer-events-none aria-disabled:opacity-45',
    sizeClasses[size],
    variantClasses[variant],
    fullWidth && 'w-full',
    className,
  )
