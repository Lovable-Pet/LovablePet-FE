import type { PetSort } from '../../../apis/dto/pet.dto'
import { cn } from '../../../components/utils/cn'
import { SORT_LABEL } from '../../../constants/pet'

export interface SortToggleProps {
  value: PetSort
  onChange: (sort: PetSort) => void
}

const SORTS: PetSort[] = ['NEWEST', 'OLDEST']

/** 최근 공고순 / 오래 기다린 순 */
export function SortToggle({ value, onChange }: SortToggleProps) {
  return (
    <div role="group" aria-label="정렬" className="flex rounded-button-sm bg-segment p-[3px]">
      {SORTS.map((sort) => (
        <button
          key={sort}
          type="button"
          aria-pressed={value === sort}
          onClick={() => onChange(sort)}
          className={cn(
            'h-7.5 rounded-chip px-2.5 text-caption',
            'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent',
            value === sort
              ? 'bg-surface font-semibold text-ink shadow-segment'
              : 'bg-transparent font-medium text-ink-tertiary',
          )}
        >
          {SORT_LABEL[sort]}
        </button>
      ))}
    </div>
  )
}
