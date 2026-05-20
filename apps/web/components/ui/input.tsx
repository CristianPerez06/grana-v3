import { forwardRef, type InputHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  invalid?: boolean
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, invalid, type = 'text', ...props }, ref) => (
    <input
      ref={ref}
      type={type}
      aria-invalid={invalid || undefined}
      className={cn(
        'flex h-11 w-full rounded-[var(--radius-md)] border bg-card px-3 py-2 text-sm text-text transition-colors duration-[var(--duration-fast)]',
        'placeholder:text-text-soft',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        'disabled:cursor-not-allowed disabled:opacity-50',
        invalid
          ? 'border-error focus-visible:ring-error'
          : 'border-border',
        className,
      )}
      {...props}
    />
  ),
)
Input.displayName = 'Input'

export { Input }
export type { InputProps }
