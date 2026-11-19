import { useId, type InputHTMLAttributes, type ReactNode } from 'react'
import { cn } from '../utils/cn'

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  /** 입력 규칙 안내 (오류가 없을 때 보인다) */
  hint?: string
  error?: string | null
  /** 사용할 수 있어요 같은 확인 문구 */
  success?: string | null
  /** 입력칸 오른쪽에 놓는 것 (비밀번호 보기 버튼 등) */
  trailing?: ReactNode
}

/** 이름표·입력칸·안내 문구 한 묶음 */
export function Field({ label, hint, error, success, trailing, className, id, ...rest }: FieldProps) {
  const autoId = useId()
  const inputId = id ?? autoId
  const messageId = `${inputId}-message`
  const message = error ?? success ?? hint

  return (
    <div className={className}>
      <label htmlFor={inputId} className="mb-1.5 block text-label font-bold text-ink-soft">
        {label}
      </label>
      <div
        className={cn(
          'flex h-13 items-center rounded-input bg-surface pr-1.5 transition-shadow duration-150',
          'focus-within:shadow-[inset_0_0_0_2px_var(--color-primary-deep)]',
          error ? 'shadow-[inset_0_0_0_2px_var(--color-pink-deep)]' : 'shadow-[inset_0_0_0_1.5px_var(--color-line)]',
        )}
      >
        <input
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={message ? messageId : undefined}
          className="h-full min-w-0 flex-1 rounded-input bg-transparent px-4 text-body text-ink outline-none placeholder:text-ink-mute"
          {...rest}
        />
        {trailing}
      </div>
      {message && (
        <p
          id={messageId}
          role={error ? 'alert' : undefined}
          className={cn(
            'mt-1.5 text-caption',
            error ? 'font-bold text-pink-deep' : success ? 'font-bold text-mint-deep' : 'text-ink-mute',
          )}
        >
          {message}
        </p>
      )}
    </div>
  )
}
