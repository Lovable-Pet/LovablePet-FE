import { PawPrint } from 'lucide-react'
import { cn } from '../../../components/utils/cn'
import { PAW_LABEL, type PawId } from '../arPaws'
import { AR_TEXT } from '../arText'

/**
 * 위 안내 줄 위의 발도장 (해 본 것은 강조색, 안 해 본 것은 흐리게). 찍히는 순간 작게 튄다.
 * 누르는 것이 아니라 보이기만 한다
 */
export function ArPawPrints({ paws, done }: { paws: readonly PawId[]; done: ReadonlySet<PawId> }) {
  if (!paws.length) return null
  return (
    <ul aria-label={AR_TEXT.pawList} className="flex items-center gap-2.5">
      {paws.map((id) => {
        const stamped = done.has(id)
        return (
          <li key={id} aria-label={`${PAW_LABEL[id]} ${stamped ? AR_TEXT.pawDone : AR_TEXT.pawTodo}`}>
            {/* key 를 바꿔 찍히는 순간에만 애니메이션이 돈다 */}
            <span
              key={stamped ? 'done' : 'todo'}
              className={cn(
                'flex size-7 items-center justify-center rounded-full',
                stamped ? 'animate-stamp bg-measure text-ink' : 'bg-black/35 text-white/40',
              )}
            >
              <PawPrint className="size-4" strokeWidth={2.2} fill={stamped ? 'currentColor' : 'none'} aria-hidden />
            </span>
          </li>
        )
      })}
    </ul>
  )
}
