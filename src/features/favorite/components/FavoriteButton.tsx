import { Heart } from 'lucide-react'
import { IconButton } from '../../../components/IconButton/IconButton'
import type { IconButtonSize, IconButtonVariant } from '../../../components/IconButton/iconButtonStyles'
import { useToggleFavorite } from '../useToggleFavorite'

export interface FavoriteButtonProps {
  petId: number
  favorited: boolean
  variant?: IconButtonVariant
  size?: IconButtonSize
  className?: string
}

/** 찜 하트. 찜했으면 주황으로 채운다 */
export function FavoriteButton({ petId, favorited, variant = 'floating', size = 'sm', className }: FavoriteButtonProps) {
  const { toggle } = useToggleFavorite()

  return (
    <IconButton
      variant={variant}
      size={size}
      aria-label={favorited ? '찜 취소' : '찜하기'}
      aria-pressed={favorited}
      onClick={() => toggle(petId, !favorited)}
      color={favorited ? 'text-accent' : 'text-ink-secondary'}
      className={className}
    >
      <Heart
        className={size === 'lg' ? 'size-5.5' : 'size-5'}
        strokeWidth={2}
        fill={favorited ? 'currentColor' : 'none'}
        aria-hidden
      />
    </IconButton>
  )
}
