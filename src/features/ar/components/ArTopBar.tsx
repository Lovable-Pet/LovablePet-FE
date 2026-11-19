import { Eye, EyeOff, Heart, Ruler, X } from 'lucide-react'
import { cn } from '../../../components/utils/cn'
import { useToggleFavorite } from '../../favorite/useToggleFavorite'
import { AR_TEXT } from '../arText'

const ROUND = 'pointer-events-auto flex size-11 shrink-0 items-center justify-center rounded-full transition active:scale-97'

/**
 * AR 화면 위 줄: 닫기 · 이름·체고 알약(누르면 정보 시트) · 따라보기 · 찜 하트.
 * WebXR 중에는 닫기 자리를 비워 model-viewer 의 닫기 버튼을 쓴다
 */
export function ArTopBar({
  inAr,
  onClose,
  name,
  withersCm,
  onOpenInfo,
  follow,
  petId,
  favorited,
}: {
  inAr: boolean
  onClose: () => void
  name: string
  withersCm: number
  onOpenInfo: () => void
  /** 몸 돌리기가 되는 개만 */
  follow: { on: boolean; onToggle: () => void } | null
  petId: number
  favorited: boolean
}) {
  const { toggle } = useToggleFavorite()
  return (
    <div className="flex w-full items-center gap-2">
      {inAr ? (
        <span className="size-11 shrink-0" aria-hidden />
      ) : (
        <button type="button" onClick={onClose} aria-label={AR_TEXT.close} className={cn(ROUND, 'bg-black/45 text-white')}>
          <X className="size-5.5" strokeWidth={2} aria-hidden />
        </button>
      )}
      <button
        type="button"
        onClick={onOpenInfo}
        aria-haspopup="dialog"
        aria-label={`${name} · ${AR_TEXT.withers} ${withersCm}cm · ${AR_TEXT.info}`}
        className="pointer-events-auto flex h-11 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-full bg-measure px-3.5 text-body font-bold text-ink transition active:scale-97"
      >
        <Ruler className="size-4 shrink-0" strokeWidth={2.2} aria-hidden />
        <span className="min-w-0 truncate">{name}</span>
        <span className="shrink-0 whitespace-nowrap">
          · {AR_TEXT.withers} <span className="font-mono">{withersCm}cm</span>
        </span>
      </button>
      {follow && (
        <button
          type="button"
          aria-pressed={follow.on}
          aria-label={AR_TEXT.follow}
          onClick={follow.onToggle}
          className={cn(
            ROUND,
            follow.on ? 'bg-measure text-ink' : 'bg-black/45 text-white/75 ring-1 ring-white/25 ring-inset',
          )}
        >
          {follow.on ? <Eye className="size-5" strokeWidth={2.2} aria-hidden /> : <EyeOff className="size-5" strokeWidth={2.2} aria-hidden />}
        </button>
      )}
      <button
        type="button"
        aria-pressed={favorited}
        aria-label={favorited ? AR_TEXT.favoriteOff : AR_TEXT.favoriteOn}
        onClick={() => toggle(petId, !favorited)}
        className={cn(ROUND, 'bg-black/45', favorited ? 'text-accent-line' : 'text-white')}
      >
        <Heart className="size-5" strokeWidth={2} fill={favorited ? 'currentColor' : 'none'} aria-hidden />
      </button>
    </div>
  )
}
