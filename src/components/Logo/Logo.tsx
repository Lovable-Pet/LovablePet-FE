import logoMark from '../../assets/logo-mark.png'
import logoWordmark from '../../assets/logo-wordmark.png'
import { cn } from '../utils/cn'

export interface LogoProps {
  /** 강아지 얼굴 크기 (px) */
  size?: number
  /** 글자 로고 'LovablePet'도 함께 (밝은 바탕용. 글자가 갈색이라 어두운 바탕에서는 글자를 따로 쓴다) */
  withText?: boolean
  className?: string
}

/** 브랜드 로고. 강아지 얼굴 + 글자 로고 (원본: 2026-11-11 받은 로고 이미지에서 잘라 배경을 투명하게) */
export function Logo({ size = 26, withText = false, className }: LogoProps) {
  return (
    <span className={cn('inline-flex items-center gap-1.5', className)}>
      <img src={logoMark} width={size} height={size} alt="" aria-hidden className="shrink-0" draggable={false} />
      {withText && (
        // 원본 글자 로고 비율 330:63
        <img
          src={logoWordmark}
          height={Math.round(size * 0.82)}
          style={{ height: Math.round(size * 0.82), width: 'auto' }}
          alt="LovablePet"
          draggable={false}
        />
      )}
    </span>
  )
}
