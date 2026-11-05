import { Box, Heart } from 'lucide-react'
import { Link } from 'react-router'
import type { PetSummary } from '../../../apis/dto/pet.dto'
import { buttonStyles } from '../../../components/Button/buttonStyles'
import { IconButton } from '../../../components/IconButton/IconButton'
import { cn } from '../../../components/utils/cn'
import { SEX_LABEL } from '../../../constants/pet'
import { formatAge, formatWeight } from '../../../utils/pet'
import { PetPhoto } from '../../pet/components/PetPhoto'
import { useToggleFavorite } from '../useToggleFavorite'

export interface FavoriteCardProps {
  pet: PetSummary
}

/**
 * 찜 목록 카드
 * - adoptable=false → 흐리게 + '입양 불가' 배지. 공고 기간 중인 아이도 false로 오고
 *   목록 응답엔 processState·noticeEnd가 없어서 '입양 완료'·'보호 종료'로 단정하지 않는다
 * - 아래 줄: hasModel이면 AR 버튼(입양 불가여도 크기는 미리 볼 수 있다),
 *   아니면 입양 불가는 '지금은 입양할 수 없어요', 입양 가능은 '아직 AR로 볼 수 없어요'
 */
export function FavoriteCard({ pet }: FavoriteCardProps) {
  const { toggle } = useToggleFavorite()
  const unavailable = !pet.adoptable
  const weight = formatWeight(pet.weightKg)

  return (
    <article className={cn('rounded-card-lg bg-surface p-3', unavailable && 'opacity-72')}>
      <Link to={`/pets/${pet.id}`} className="flex items-center gap-3.5">
        <PetPhoto
          src={pet.thumbnailUrl}
          alt={`${pet.kindName} 공고 사진`}
          showPlaceholderLabel={false}
          className="size-22 shrink-0 rounded-button"
        >
          {unavailable && (
            <span className="relative rounded-badge bg-ink-secondary px-2 py-1 text-caption font-semibold text-white">
              입양 불가
            </span>
          )}
        </PetPhoto>
        <div className="min-w-0 flex-1">
          <p className="text-body-lg font-semibold">{pet.kindName}</p>
          <p className="mt-0.75 text-label text-ink-secondary">
            {SEX_LABEL[pet.sex]} · {formatAge(pet.ageText)} ·{' '}
            {weight ? <span className="font-mono">{weight}</span> : '체중 미상'}
          </p>
          <p className="mt-0.75 text-caption text-ink-caption">{pet.careName}</p>
        </div>
      </Link>

      <div className="mt-3 flex gap-2">
        {pet.hasModel ? (
          <Link
            to={`/pets/${pet.id}/ar`}
            className={buttonStyles({ variant: 'accent-soft', size: 'sm', className: 'flex-1' })}
          >
            <Box className="size-4" strokeWidth={2} aria-hidden />
            우리 집에 놓아 보기
          </Link>
        ) : (
          <StatusNote>{unavailable ? '지금은 입양할 수 없어요' : '아직 AR로 볼 수 없어요'}</StatusNote>
        )}
        <IconButton variant="outline" aria-label="찜 취소" color="text-accent" onClick={() => toggle(pet.id, false)}>
          <Heart className="size-5" strokeWidth={2} fill="currentColor" aria-hidden />
        </IconButton>
      </div>
    </article>
  )
}

function StatusNote({ children }: { children: string }) {
  return (
    <span className="flex h-11 flex-1 items-center justify-center rounded-input bg-muted text-body text-ink-tertiary">
      {children}
    </span>
  )
}

export function FavoriteCardSkeleton() {
  return (
    <div className="animate-pulse rounded-card-lg bg-surface p-3" aria-hidden>
      <div className="flex items-center gap-3.5">
        <div className="size-22 rounded-button bg-muted" />
        <div className="flex flex-1 flex-col gap-2">
          <div className="h-4 w-1/2 rounded bg-muted" />
          <div className="h-3.5 w-3/4 rounded bg-muted" />
        </div>
      </div>
      <div className="mt-3 h-11 rounded-input bg-muted" />
    </div>
  )
}
