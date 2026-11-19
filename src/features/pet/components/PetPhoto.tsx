import { useState } from 'react'
import { PawPrint } from 'lucide-react'
import { cn } from '../../../components/utils/cn'

/** 사진이 없거나 못 불러왔을 때 까는 파스텔 바탕 (공고마다 색이 정해진다) */
const TINTS = [
  'bg-pink text-primary-deep/45',
  'bg-mint text-mint-deep/45',
  'bg-apricot text-apricot-deep/45',
  'bg-pink text-pink-deep/45',
  'bg-sky text-sky-deep/45',
]

interface PetPhotoProps {
  src: string | null
  alt: string
  /** 바탕색을 고르는 번호 (보통 공고 id) */
  seed?: number
  /** 화면 맨 위 사진은 바로 불러온다 */
  eager?: boolean
  className?: string
}

/** 공고 사진. 크기와 모서리는 className 으로 준다 */
export function PetPhoto({ src, alt, seed = 0, eager = false, className }: PetPhotoProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null)
  // 주소가 빈 문자열로 오는 경우도 사진 없음으로 본다
  const showImage = !!src && failedSrc !== src

  return (
    <div className={cn('relative overflow-hidden', TINTS[Math.abs(seed) % TINTS.length], className)}>
      {showImage ? (
        <img
          src={src}
          alt={alt}
          loading={eager ? 'eager' : 'lazy'}
          decoding="async"
          onError={() => setFailedSrc(src)}
          className="size-full object-cover outline-1 -outline-offset-1 outline-black/5"
          style={{ borderRadius: 'inherit' }}
        />
      ) : (
        <span role="img" aria-label={`${alt} (사진 없음)`} className="flex size-full items-center justify-center">
          <PawPrint className="size-2/5 max-h-16 max-w-16" strokeWidth={1.5} aria-hidden />
        </span>
      )}
    </div>
  )
}
