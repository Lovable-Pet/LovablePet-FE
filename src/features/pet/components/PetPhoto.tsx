import { useState, type ReactNode } from 'react'
import { cn } from '../../../components/utils/cn'

export interface PetPhotoProps {
  src: string | null
  /** 사진 설명 (예: "믹스견 공고 사진") */
  alt: string
  /** 크기·비율·모서리. 자리를 미리 잡아서 사진이 불러와져도 높이가 바뀌지 않게 한다 */
  className?: string
  /** 사진 위에 겹치는 배지 등 */
  children?: ReactNode
  /** 사진이 없을 때 가운데 문구를 보일지 (작은 썸네일은 끈다) */
  showPlaceholderLabel?: boolean
  /** 첫 화면에 바로 보이는 사진이면 false (lazy 로딩 안 함) */
  lazy?: boolean
  /** 감싼 카드(group)에 마우스를 올리면 사진을 4% 키운다 (테두리는 넘지 않는다) */
  zoomOnHover?: boolean
}

/**
 * 공고 사진.
 * 불러오는 중: shimmer 자리 → 다 불러오면 fade-in → 없거나 못 불러오면 빗금 자리와 '공고 사진' 문구
 */
export function PetPhoto({
  src,
  alt,
  className,
  children,
  showPlaceholderLabel = true,
  lazy = true,
  zoomOnHover = false,
}: PetPhotoProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null)
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null)
  const showImage = src !== null && failedSrc !== src
  const loaded = showImage && loadedSrc === src

  return (
    <div
      className={cn(
        'relative flex items-center justify-center overflow-hidden',
        showImage ? (loaded ? 'bg-muted' : 'skeleton') : 'photo-placeholder',
        className,
      )}
    >
      {showImage ? (
        <img
          // 캐시에 있던 사진은 그리기 전에 이미 다 불러와 있어서 load 이벤트를 놓칠 수 있다
          ref={(img) => {
            if (img?.complete && img.naturalWidth > 0) setLoadedSrc(src)
          }}
          src={src}
          alt={alt}
          loading={lazy ? 'lazy' : 'eager'}
          decoding="async"
          onLoad={() => setLoadedSrc(src)}
          onError={() => setFailedSrc(src)}
          className={cn(
            'absolute inset-0 size-full object-cover transition duration-base',
            loaded ? 'opacity-100' : 'opacity-0',
            zoomOnHover && 'group-hover:scale-104',
          )}
        />
      ) : (
        showPlaceholderLabel && <span className="text-caption text-ink-caption">공고 사진</span>
      )}
      {children}
    </div>
  )
}
