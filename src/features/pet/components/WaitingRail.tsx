import { Link } from 'react-router'
import type { PetSummary } from '../../../apis/dto/pet.dto'
import { Badge } from '../../../components/Badge/Badge'
import { formatWeight, waitingDays } from '../../../utils/pet'
import { PetPhoto } from './PetPhoto'

export interface WaitingRailProps {
  pets: PetSummary[]
  isLoading: boolean
}

/** 오래 기다린 아이들 가로 목록 */
export function WaitingRail({ pets, isLoading }: WaitingRailProps) {
  return (
    <section aria-labelledby="waiting-title" className="mt-6">
      <div className="flex items-baseline justify-between px-5">
        <h2 id="waiting-title" className="text-section font-bold">
          오래 기다린 아이들
        </h2>
        <span className="text-label text-ink-caption">공고가 오래된 순</span>
      </div>
      <ul className="flex gap-2.5 overflow-x-auto px-5 pt-3 pb-1 no-scrollbar">
        {isLoading
          ? Array.from({ length: 3 }, (_, index) => (
              <li key={index} className="w-37 shrink-0 animate-pulse" aria-hidden>
                <div className="h-37 rounded-card bg-muted" />
                <div className="mt-2 h-4 w-3/4 rounded bg-muted" />
              </li>
            ))
          : pets.map((pet) => {
              const weight = formatWeight(pet.weightKg)
              return (
                <li key={pet.id} className="w-37 shrink-0">
                  <Link to={`/pets/${pet.id}`} className="flex flex-col gap-2">
                    <PetPhoto
                      src={pet.thumbnailUrl}
                      alt={`${pet.kindName} 공고 사진`}
                      showPlaceholderLabel={false}
                      className="h-37 rounded-card"
                    >
                      <Badge tone="dark" size="sm" className="absolute bottom-2 left-2">
                        기다린 지 {waitingDays(pet.noticeStart)}일
                      </Badge>
                    </PetPhoto>
                    <div>
                      <p className="text-body font-semibold">
                        {pet.kindName}
                        {weight && ` · ${weight}`}
                      </p>
                      <p className="mt-0.5 text-caption text-ink-caption">{pet.orgName}</p>
                    </div>
                  </Link>
                </li>
              )
            })}
      </ul>
    </section>
  )
}
