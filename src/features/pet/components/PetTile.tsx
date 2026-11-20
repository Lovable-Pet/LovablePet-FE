import type { CSSProperties } from 'react'
import { Link } from 'react-router'
import type { PetSummary } from '../../../apis/dto/pet.dto'
import { cn } from '../../../components/utils/cn'
import { formatWeight } from '../../../utils/pet'
import { PetPhoto } from './PetPhoto'

interface PetTileProps {
  pet: PetSummary
  /** 등장 애니메이션 (useEntranceStagger) */
  className?: string
  style?: CSSProperties
}

/** 홈 격자의 사진 타일: 정사각형 사진만 보이고, 누르면 상세 화면으로 간다 */
export function PetTile({ pet, className, style }: PetTileProps) {
  const name = [pet.kindName, formatWeight(pet.weightKg)].filter(Boolean).join(' ')
  return (
    <Link
      to={`/pets/${pet.id}`}
      aria-label={`${name}, ${pet.orgName}`}
      style={style}
      className={cn('block rounded-2xl shadow-soft transition-[scale] duration-150 active:scale-[0.96]', className)}
    >
      <PetPhoto src={pet.thumbnailUrl} alt="" seed={pet.id} className="aspect-square w-full rounded-2xl" />
    </Link>
  )
}
