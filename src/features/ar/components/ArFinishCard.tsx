import { Check, Heart, Phone } from 'lucide-react'
import { cn } from '../../../components/utils/cn'
import { toTelHref } from '../../../utils/pet'
import { useToggleFavorite } from '../../favorite/useToggleFavorite'
import { AR_TEXT, FINISH_TEXT } from '../arText'
import { blockXrSelectRef } from '../blockXrSelect'

/**
 * 마무리 카드 (아래에서 올라온다). 발도장을 다 모았을 때('계속 보기'로 닫힘)와,
 * 다 모으지 않고 닫기(X)를 눌렀을 때 한 번('나가기'를 누르면 실제로 나감).
 * model-viewer 의 자식으로 둬야 WebXR 화면(DOM overlay)에도 보이고 눌리며, 누를 때 XR select 가 되지 않게 막는다
 */
export function ArFinishCard({
  mode,
  name,
  careName,
  careTel,
  petId,
  favorited,
  onClose,
}: {
  /** complete: 발도장을 다 모음 · exit: 닫기를 눌러 나가는 중 */
  mode: 'complete' | 'exit'
  /** 품종 이름 (조사를 받침에 맞춰 붙인다) */
  name: string
  careName: string
  careTel: string
  petId: number
  favorited: boolean
  /** complete 면 카드만 닫고, exit 면 화면을 나간다 */
  onClose: () => void
}) {
  const { toggle } = useToggleFavorite()
  return (
    <div ref={blockXrSelectRef} className="pointer-events-auto absolute inset-0 flex flex-col justify-end">
      <div aria-hidden className="absolute inset-0 animate-fade-in bg-black/40" />
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="ar-finish-title"
        className="relative animate-sheet-up rounded-t-sheet bg-surface px-5 pt-6 pb-[calc(20px+env(safe-area-inset-bottom))] text-ink"
      >
        <h2 id="ar-finish-title" className="text-title font-bold">
          {FINISH_TEXT.title(name)}
        </h2>
        <p className="mt-1.5 text-body-lg text-ink-secondary">{FINISH_TEXT.body(name, careName)}</p>
        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={() => toggle(petId, true)}
            disabled={favorited}
            aria-pressed={favorited}
            className={cn(
              'flex h-12 flex-1 items-center justify-center gap-1.5 rounded-button text-emphasis font-semibold transition active:scale-97',
              favorited ? 'bg-accent-soft text-accent-ink' : 'bg-accent text-white',
            )}
          >
            {favorited ? (
              <Check className="size-5" strokeWidth={2.2} aria-hidden />
            ) : (
              <Heart className="size-5" strokeWidth={2} aria-hidden />
            )}
            {favorited ? AR_TEXT.favoriteDone : AR_TEXT.favoriteOn}
          </button>
          {careTel && (
            <a
              href={toTelHref(careTel)}
              className="flex h-12 flex-1 items-center justify-center gap-1.5 rounded-button bg-muted text-emphasis font-semibold text-ink active:bg-muted-hover"
            >
              <Phone className="size-5" strokeWidth={2} aria-hidden />
              {AR_TEXT.callShelter}
            </a>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="mt-2 flex h-11 w-full items-center justify-center text-body font-semibold text-ink-secondary"
        >
          {mode === 'complete' ? AR_TEXT.keepWatching : AR_TEXT.leave}
        </button>
      </section>
    </div>
  )
}
