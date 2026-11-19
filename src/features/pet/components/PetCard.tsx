import type { CSSProperties } from 'react'
import { ArrowRight, Box, MapPin } from 'lucide-react'
import { Link } from 'react-router'
import type { PetSummary } from '../../../apis/dto/pet.dto'
import { cn } from '../../../components/utils/cn'
import { formatWeight, waitingDays } from '../../../utils/pet'
import { FavoriteButton } from '../../favorite/components/FavoriteButton'
import { PetPhoto } from './PetPhoto'
import { SexSymbol } from './SexSymbol'

interface PetCardProps {
  pet: PetSummary
  /** 등장 애니메이션 (useEntranceStagger) */
  className?: string
  style?: CSSProperties
}

/** 홈 격자의 카드: 사진, 품종·성별·체중, 한 줄 소개, 지역과 화살표 */
export function PetCard({ pet, className, style }: PetCardProps) {
  const days = waitingDays(pet.noticeStart)
  return (
    <Link
      to={`/pets/${pet.id}`}
      style={style}
      className={cn(
        'group block overflow-hidden rounded-card bg-surface shadow-soft transition-[scale] duration-150 active:scale-[0.98]',
        className,
      )}
    >
      <div className="relative">
        <PetPhoto src={pet.thumbnailUrl} alt={`${pet.kindName} 공고 사진`} seed={pet.id} className="aspect-[5/4] w-full" />
        {pet.hasModel && (
          <span className="absolute top-2 left-2 flex h-6 items-center gap-1 rounded-full bg-surface/90 px-2 text-caption font-extrabold text-primary-deep backdrop-blur">
            <Box className="size-3.5" strokeWidth={2.2} aria-hidden />
            AR
          </span>
        )}
        <FavoriteButton
          petId={pet.id}
          favorited={pet.favorited}
          name={pet.kindName}
          onPhoto
          className="absolute top-1.5 right-1.5 size-10 [&_svg]:drop-shadow-[0_1px_2px_rgb(0_0_0/0.35)]"
        />
      </div>
      <div className="px-3 pt-2.5 pb-3">
        <h3 className="flex items-baseline gap-1 font-display text-emphasis">
          <span className="truncate">{pet.kindName}</span>
          <SexSymbol sex={pet.sex} className="text-body" />
          {pet.weightKg !== null && (
            <span className="shrink-0 font-sans text-label font-bold tabular-nums">{formatWeight(pet.weightKg)}</span>
          )}
        </h3>
        <p className="mt-0.5 truncate text-caption text-ink-soft">
          {days}일째 가족을 기다려요
        </p>
        <div className="mt-2 flex items-center gap-1">
          <MapPin className="size-4 shrink-0 fill-primary text-surface" strokeWidth={2} aria-hidden />
          <span className="min-w-0 flex-1 truncate text-caption text-ink-soft">{pet.orgName}</span>
          <span
            aria-hidden
            className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-white transition-transform duration-150 group-hover:translate-x-0.5"
          >
            <ArrowRight className="size-3.5" strokeWidth={2.8} />
          </span>
        </div>
      </div>
    </Link>
  )
}
