import type { ReactNode } from 'react'
import { Character, type CharacterName } from '../Character/Character'
import { cn } from '../utils/cn'

interface StateViewProps {
  title: string
  description?: string
  /** 다음에 할 일 (버튼·링크) */
  action?: ReactNode
  tone?: 'empty' | 'error'
  /** 상황에 맞는 강아지. 안 주면 빈 화면은 빼꼼, 오류는 당황 */
  character?: CharacterName
  className?: string
}

/** 비었을 때·오류일 때 화면 가운데에 놓는 안내 */
export function StateView({ title, description, action, tone = 'empty', character, className }: StateViewProps) {
  return (
    <div
      role={tone === 'error' ? 'alert' : undefined}
      className={cn('flex flex-col items-center px-6 py-12 text-center', className)}
    >
      <Character name={character ?? (tone === 'error' ? 'oops' : 'peeking')} size={136} />
      <h2 className="mt-3 font-display text-heading">{title}</h2>
      {description && <p className="mt-1.5 max-w-[30ch] text-body text-ink-soft">{description}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  )
}
