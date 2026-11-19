import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import { cn } from '../utils/cn'

export interface DropdownOption<T extends string> {
  value: T
  label: string
}

interface DropdownProps<T extends string> {
  /** 읽어 줄 이름 (예: 정렬) */
  label: string
  value: T
  options: DropdownOption<T>[]
  onChange: (value: T) => void
  /** 목록이 붙는 쪽 */
  align?: 'left' | 'right'
  className?: string
}

/**
 * 하나를 고르는 펼침 목록 (기기 기본 선택 상자 대신 쓴다).
 * 마우스·터치: 버튼을 누르면 펼쳐지고, 항목을 누르거나 바깥을 누르면 닫힌다.
 * 키보드: Enter·Space·↓ 로 열고, ↑↓·Home·End 로 옮기고, Enter·Space 로 고르고, Esc·Tab 으로 닫는다
 */
export function Dropdown<T extends string>({ label, value, options, onChange, align = 'right', className }: DropdownProps<T>) {
  const id = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const selectedIndex = Math.max(0, options.findIndex((option) => option.value === value))

  const openList = () => {
    setActive(selectedIndex)
    setOpen(true)
  }
  const close = (returnFocus: boolean) => {
    setOpen(false)
    if (returnFocus) buttonRef.current?.focus()
  }
  const pick = (index: number) => {
    const option = options[index]
    if (option && option.value !== value) onChange(option.value)
    close(true)
  }

  // 열리면 목록으로 초점을 옮기고, 바깥을 누르면 닫는다
  useEffect(() => {
    if (!open) return
    listRef.current?.focus()
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  const onListKeyDown = (event: KeyboardEvent) => {
    const last = options.length - 1
    switch (event.key) {
      case 'ArrowDown':
        setActive((index) => Math.min(last, index + 1))
        break
      case 'ArrowUp':
        setActive((index) => Math.max(0, index - 1))
        break
      case 'Home':
        setActive(0)
        break
      case 'End':
        setActive(last)
        break
      case 'Enter':
      case ' ':
        pick(active)
        break
      case 'Escape':
        close(true)
        break
      case 'Tab':
        // 초점이 다음 요소로 넘어가게 두고 목록만 닫는다
        setOpen(false)
        return
      default:
        return
    }
    event.preventDefault()
  }

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`${label}: ${options[selectedIndex]?.label ?? ''}`}
        onClick={() => (open ? close(false) : openList())}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault()
            openList()
          }
        }}
        className={cn(
          'flex h-9 items-center gap-1 rounded-full pr-2 pl-3 text-label font-bold text-ink-soft',
          'transition-[background-color,scale] duration-150 hover:bg-pink-soft active:scale-[0.96]',
          open && 'bg-pink-soft text-ink',
        )}
      >
        {options[selectedIndex]?.label}
        <ChevronDown
          className={cn('size-4 transition-transform duration-200 ease-out', open && 'rotate-180')}
          strokeWidth={2.4}
          aria-hidden
        />
      </button>

      {open && (
        <ul
          ref={listRef}
          role="listbox"
          tabIndex={-1}
          aria-label={label}
          aria-activedescendant={`${id}-${active}`}
          onKeyDown={onListKeyDown}
          className={cn(
            'absolute top-full z-40 mt-1.5 min-w-[10.5rem] animate-pop-over rounded-[1.25rem] bg-surface p-1.5 shadow-float outline-none',
            align === 'right' ? 'right-0 origin-top-right' : 'left-0 origin-top-left',
          )}
        >
          {options.map((option, index) => {
            const selected = index === selectedIndex
            return (
              <li
                key={option.value}
                id={`${id}-${index}`}
                role="option"
                aria-selected={selected}
                onClick={() => pick(index)}
                onPointerMove={() => setActive(index)}
                className={cn(
                  'flex h-11 cursor-pointer items-center gap-2 rounded-[0.875rem] pr-3 pl-2.5 text-label whitespace-nowrap select-none',
                  selected ? 'font-extrabold text-primary-deep' : 'font-bold text-ink',
                  index === active && 'bg-pink-soft',
                )}
              >
                <Check className={cn('size-4 shrink-0', !selected && 'invisible')} strokeWidth={3} aria-hidden />
                {option.label}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
