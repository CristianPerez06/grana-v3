import { forwardRef, useId, type InputHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'
import { Input } from './input'
import { Label } from './label'

type FormFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string
  description?: string
  error?: string
  containerClassName?: string
}

const FormField = forwardRef<HTMLInputElement, FormFieldProps>(
  (
    { label, description, error, id, containerClassName, className, ...inputProps },
    ref,
  ) => {
    const generatedId = useId()
    const inputId = id ?? generatedId
    const descriptionId = description ? `${inputId}-description` : undefined
    const errorId = error ? `${inputId}-error` : undefined

    return (
      <div className={cn('flex flex-col gap-1.5', containerClassName)}>
        <Label htmlFor={inputId}>{label}</Label>
        <Input
          ref={ref}
          id={inputId}
          invalid={Boolean(error)}
          aria-describedby={
            [descriptionId, errorId].filter(Boolean).join(' ') || undefined
          }
          className={className}
          {...inputProps}
        />
        {description && !error && (
          <p id={descriptionId} className="text-xs text-text-muted">
            {description}
          </p>
        )}
        {error && (
          <p id={errorId} className="text-xs text-error">
            {error}
          </p>
        )}
      </div>
    )
  },
)
FormField.displayName = 'FormField'

export { FormField }
export type { FormFieldProps }
