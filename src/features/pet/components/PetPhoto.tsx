import { useState, type ReactNode } from 'react'
import { cn } from '../../../components/utils/cn'

export interface PetPhotoProps {
  src: string | null
  /** 사진 설명 (예: "믹스견 공고 사진") */
  alt: string
  className?: string
  /** 사진 위에 겹치는 배지 등 */
  children?: ReactNode
  /** 사진이 없을 때 가운데 문구를 보일지 (작은 썸네일은 끈다) */
  showPlaceholderLabel?: boolean
  /** 첫 화면에 바로 보이는 사진이면 false (lazy 로딩 안 함) */
  lazy?: boolean
}

/** 공고 사진. 없거나 못 불러오면 빗금 자리와 '공고 사진' 문구 */
export function PetPhoto({
  src,
  alt,
  className,
  children,
  showPlaceholderLabel = true,
  lazy = true,
}: PetPhotoProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null)
  const showImage = src !== null && failedSrc !== src

  return (
    <div className={cn('relative flex items-center justify-center overflow-hidden photo-placeholder', className)}>
      {showImage ? (
        <img
          src={src}
          alt={alt}
          loading={lazy ? 'lazy' : 'eager'}
          onError={() => setFailedSrc(src)}
          className="absolute inset-0 size-full object-cover"
        />
      ) : (
        showPlaceholderLabel && <span className="text-caption text-ink-caption">공고 사진</span>
      )}
      {children}
    </div>
  )
}
