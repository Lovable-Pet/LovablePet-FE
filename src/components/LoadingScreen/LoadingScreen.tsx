import { RunningDog } from '../Character/Character'
import { cn } from '../utils/cn'

const DOT_COLORS = ['bg-primary', 'bg-pink', 'bg-apricot']

/** 차례로 통통 뛰는 점 세 개 (목록 끝·버튼 안처럼 좁은 곳) */
export function PawDots({ label, className }: { label: string; className?: string }) {
  return (
    <span role="status" aria-label={label} className={cn('inline-flex items-center gap-2', className)}>
      {DOT_COLORS.map((color, index) => (
        <span
          key={color}
          aria-hidden
          className={cn('size-2.5 animate-trot rounded-full', color)}
          style={{ animationDelay: `${index * 0.14}s` }}
        />
      ))}
    </span>
  )
}

/** 달리는 강아지와 안내 문구 (화면 일부를 채울 때) */
export function LoadingDog({ description, className }: { description: string; className?: string }) {
  return (
    <div role="status" className={cn('flex flex-col items-center gap-2 py-12', className)}>
      <RunningDog size={104} />
      <p className="text-body text-ink-soft">{description}</p>
    </div>
  )
}

/** 화면 전체를 차지하는 불러오는 중 */
export function LoadingScreen({ description = '불러오고 있어요' }: { description?: string }) {
  return (
    <div className="app-column flex items-center justify-center">
      <LoadingDog description={description} />
    </div>
  )
}
