import type { ButtonHTMLAttributes } from 'react'
import { iconButtonStyles, type IconButtonSize, type IconButtonVariant } from './iconButtonStyles'

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** 아이콘만 있어서 화면 읽기 도구용 이름이 꼭 필요하다 */
  'aria-label': string
  variant?: IconButtonVariant
  size?: IconButtonSize
  /** 아이콘 색 클래스 (기본 text-ink). className으로 넘기면 기본색과 겹친다 */
  color?: string
}

export function IconButton({ variant, size, color, type = 'button', className, ...props }: IconButtonProps) {
  return <button type={type} className={iconButtonStyles({ variant, size, color, className })} {...props} />
}
