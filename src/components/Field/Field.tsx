import { forwardRef, useId } from 'react'
import type { InputHTMLAttributes } from 'react'
import { cn } from '../utils/cn'

export type FieldSize = 'lg' | 'md' | 'sm'

export interface FieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: string
  required?: boolean
  size?: FieldSize
  filled?: boolean
  error?: string
}

const sizeClasses: Record<FieldSize, string> = {
  lg: 'h-[48px] px-[12px] text-[15px]',
  md: 'h-[40px] px-[12px] text-[14px]',
  sm: 'h-[32px] px-[12px] text-[13px]',
}

export const Field = forwardRef<HTMLInputElement, FieldProps>(function Field(
  { label, required, size = 'md', filled, error, className, id, ...props },
  ref,
) {
  const generatedId = useId()
  const inputId = id ?? generatedId

  return (
    <div className="flex w-full flex-col gap-[6px]">
      {label && (
        <label htmlFor={inputId} className="flex items-center gap-1 font-[Sora] text-[13px] font-bold text-base-950">
          {label}
          {required && <span className="text-[11px] font-semibold text-danger-400">* 필수</span>}
        </label>
      )}
      <input
        id={inputId}
        ref={ref}
        className={cn(
          'w-full rounded-lg border font-[Geist] outline-none transition-colors',
          sizeClasses[size],
          error
            ? 'border-[1.5px] border-danger-400'
            : filled
              ? 'border border-base-300 bg-base-100'
              : 'border border-base-300 bg-white focus:border-[1.5px] focus:border-primary-500',
          className,
        )}
        {...props}
      />
      {error && <p className="text-[12px] text-danger-400">{error}</p>}
    </div>
  )
})
