import type { ButtonHTMLAttributes } from 'react'
import { cn } from '../utils/cn'

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** 화면에 글자가 없으므로 꼭 넣는다 */
  'aria-label': string
  /** plain: 바탕 없음, float: 사진 위에 뜨는 흰 원 */
  tone?: 'plain' | 'float'
}

/** 아이콘만 있는 44px 버튼 */
export function IconButton({ tone = 'plain', className, type = 'button', ...rest }: IconButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        'flex size-11 shrink-0 items-center justify-center rounded-full text-ink',
        'transition-[background-color,scale] duration-150 active:scale-[0.96] disabled:opacity-45',
        tone === 'float' ? 'bg-surface/90 shadow-soft backdrop-blur' : 'hover:bg-pink-soft',
        className,
      )}
      {...rest}
    />
  )
}
