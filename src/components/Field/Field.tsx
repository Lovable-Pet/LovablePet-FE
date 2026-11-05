import { useId, type ComponentProps, type ReactNode } from 'react'
import { cn } from '../utils/cn'

export interface FieldProps extends ComponentProps<'input'> {
  label?: string
  /** 아래 안내 문구 (오류·성공 문구가 없을 때만 보임) */
  hint?: string
  /** 오류 문구. 있으면 테두리가 빨간색이 되고 role="alert"로 읽힌다 */
  error?: string
  /** 성공 문구 (예: 사용할 수 있는 아이디예요) */
  success?: string
  /** 입력칸 오른쪽에 붙는 요소 (예: 중복 확인 버튼) */
  trailing?: ReactNode
}

export function Field({
  label,
  hint,
  error,
  success,
  trailing,
  id,
  className,
  ...props
}: FieldProps) {
  const generatedId = useId()
  const inputId = id ?? generatedId
  const messageId = `${inputId}-message`
  const message = error ?? success ?? hint

  return (
    <div className="flex w-full flex-col gap-1.5">
      {label && (
        <label htmlFor={inputId} className="text-label font-semibold text-ink-secondary">
          {label}
        </label>
      )}
      <div className="flex gap-2">
        <input
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={message ? messageId : undefined}
          className={cn(
            // 16px: 아이폰에서 입력할 때 화면이 확대되지 않게
            'h-12.5 w-full min-w-0 flex-1 rounded-input border bg-surface px-3.5 text-emphasis text-ink',
            'placeholder:text-ink-caption focus:outline-2 focus:outline-offset-0 focus:outline-accent',
            error ? 'border-danger' : success ? 'border-success-line' : 'border-line-strong',
            className,
          )}
          {...props}
        />
        {trailing}
      </div>
      {message && (
        <p
          id={messageId}
          role={error ? 'alert' : undefined}
          className={cn(
            'text-label',
            error ? 'text-danger' : success ? 'text-success-ink' : 'text-ink-caption',
          )}
        >
          {message}
        </p>
      )}
    </div>
  )
}
