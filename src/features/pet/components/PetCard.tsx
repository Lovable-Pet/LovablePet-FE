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
      <Link to={`/pets/${pet.id}`} className="flex flex-col gap-2">
        <PetPhoto src={pet.thumbnailUrl} alt={`${pet.kindName} 공고 사진`} className="aspect-square rounded-card">
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
    <div className="flex animate-pulse flex-col gap-2" aria-hidden>
      <div className="aspect-square rounded-card bg-muted" />
      <div className="h-4 w-2/3 rounded bg-muted" />
      <div className="h-3.5 w-full rounded bg-muted" />
    </div>
  )
}
