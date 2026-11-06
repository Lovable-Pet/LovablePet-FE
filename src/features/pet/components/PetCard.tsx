import { Box } from 'lucide-react'
import { Link } from 'react-router'
import type { PetSummary } from '../../../apis/dto/pet.dto'
import { Badge } from '../../../components/Badge/Badge'
import { SEX_LABEL } from '../../../constants/pet'
import { formatAge, formatWeight } from '../../../utils/pet'
import { FavoriteButton } from '../../favorite/components/FavoriteButton'
import { PetPhoto } from './PetPhoto'

export interface PetCardProps {
  pet: PetSummary
}

/** 둘러보기 2열 카드 */
export function PetCard({ pet }: PetCardProps) {
  const weight = formatWeight(pet.weightKg)

  return (
    <div className="relative">
      <Link to={`/pets/${pet.id}`} className="group flex flex-col gap-2 transition active:scale-99">
        <PetPhoto
          src={pet.thumbnailUrl}
          alt={`${pet.kindName} 공고 사진`}
          zoomOnHover
          className="aspect-square rounded-card"
        >
          {pet.hasModel && (
            <Badge tone="measure" size="sm" className="absolute bottom-2 left-2">
              <Box className="size-3" strokeWidth={2.4} aria-hidden />
              AR로 보기
            </Badge>
          )}
        </PetPhoto>
        <div>
          <p className="text-body-lg font-semibold tracking-[-0.01em]">{pet.kindName}</p>
          <p className="mt-0.5 text-label text-ink-secondary">
            {SEX_LABEL[pet.sex]} · {formatAge(pet.ageText)} ·{' '}
            {weight ? <span className="font-mono">{weight}</span> : '체중 미상'}
          </p>
          <p className="mt-0.5 text-caption text-ink-caption">{pet.orgName}</p>
        </div>
      </Link>
      <FavoriteButton petId={pet.id} favorited={pet.favorited} className="absolute top-1.5 right-1.5" />
    </div>
  )
}

export function PetCardSkeleton() {
  return (
    // 실제 카드와 같은 크기·위치·모서리 (사진 정사각형 + 글 세 줄)
    <div className="flex flex-col gap-2" aria-hidden>
      <div className="aspect-square rounded-card skeleton" />
      <div className="flex flex-col gap-1 py-0.5">
        <div className="h-4.5 w-2/3 rounded skeleton" />
        <div className="h-4 w-full rounded skeleton" />
        <div className="h-3.5 w-1/2 rounded skeleton" />
      </div>
    </div>
  )
}
