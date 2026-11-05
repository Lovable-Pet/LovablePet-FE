import { useState, type ReactNode, type UIEvent } from 'react'
import { PetPhoto } from '../PetPhoto'

export interface PhotoGalleryProps {
  photoUrls: string[]
  alt: string
  /** 사진 위에 겹치는 버튼 (뒤로, 공유) */
  children?: ReactNode
}

/** 상세 위쪽 공고 사진. 여러 장이면 옆으로 넘긴다 */
export function PhotoGallery({ photoUrls, alt, children }: PhotoGalleryProps) {
  const [index, setIndex] = useState(0)
  const photos = photoUrls.length > 0 ? photoUrls : [null]

  const onScroll = (event: UIEvent<HTMLUListElement>) => {
    const { scrollLeft, clientWidth } = event.currentTarget
    setIndex(Math.round(scrollLeft / clientWidth))
  }

  return (
    <div className="relative h-90">
      <ul
        onScroll={onScroll}
        aria-label="공고 사진"
        className="flex h-full snap-x snap-mandatory overflow-x-auto no-scrollbar"
      >
        {photos.map((src, photoIndex) => (
          <li key={src ?? 'placeholder'} className="h-full w-full shrink-0 snap-start">
            <PetPhoto
              src={src}
              alt={`${alt} ${photoIndex + 1}`}
              lazy={photoIndex > 0}
              className="h-full w-full"
            />
          </li>
        ))}
      </ul>
      {children}
      {photoUrls.length > 1 && (
        <span className="absolute right-3 bottom-7 rounded-full bg-ink/72 px-2 py-0.75 font-mono text-caption text-white">
          {index + 1} / {photoUrls.length}
        </span>
      )}
    </div>
  )
}
