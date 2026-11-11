import { Link } from 'react-router'
import type { PetSummary } from '../../../apis/dto/pet.dto'
import { Badge } from '../../../components/Badge/Badge'
import { cn } from '../../../components/utils/cn'
import { useEntranceStagger } from '../../../hooks/useEntranceStagger'
import { formatWeight, waitingDays } from '../../../utils/pet'
import { PetPhoto } from './PetPhoto'

export interface WaitingRailProps {
  pets: PetSummary[]
  isLoading: boolean
  /** 필터가 바뀌면 등장 애니메이션을 다시 센다 */
  animationKey: string
}

/** 오래 기다린 아이들 가로 목록 */
export function WaitingRail({ pets, isLoading, animationKey }: WaitingRailProps) {
  const entrance = useEntranceStagger(pets.length > 0 ? 1 : 0, animationKey)

  return (
    <section aria-labelledby="waiting-title" className="mt-6">
      <div className="flex items-baseline justify-between px-5">
        <h2 id="waiting-title" className="text-section font-bold">
          오래 기다린 유기견
        </h2>
        <span className="text-label text-ink-caption">공고가 오래된 순</span>
      </div>
      <ul className="flex gap-2.5 overflow-x-auto overscroll-x-contain px-5 pt-3 pb-1 no-scrollbar">
        {isLoading
          ? Array.from({ length: 3 }, (_, index) => (
              <li key={index} className="w-37 shrink-0" aria-hidden>
                <div className="h-37 rounded-card skeleton" />
                <div className="mt-2 h-4 w-3/4 rounded skeleton" />
                <div className="mt-1.5 h-3.5 w-1/2 rounded skeleton" />
              </li>
            ))
          : pets.map((pet, index) => {
              const weight = formatWeight(pet.weightKg)
              const enter = entrance(0, index)
              return (
                <li key={pet.id} className={cn('w-37 shrink-0', enter?.className)} style={enter?.style}>
                  <Link to={`/pets/${pet.id}`} className="group flex flex-col gap-2 transition active:scale-99">
                    <PetPhoto
                      src={pet.thumbnailUrl}
                      alt={`${pet.kindName} 공고 사진`}
                      showPlaceholderLabel={false}
                      zoomOnHover
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
