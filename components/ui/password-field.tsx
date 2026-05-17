'use client'

import { forwardRef, useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { cn } from '@/lib/utils'
import { FormField, type FormFieldProps } from './form-field'

type PasswordFieldProps = Omit<FormFieldProps, 'type'> & {
  toggleLabelShow?: string
  toggleLabelHide?: string
}

const PasswordField = forwardRef<HTMLInputElement, PasswordFieldProps>(
  (
    {
      className,
      toggleLabelShow = 'Show password',
      toggleLabelHide = 'Hide password',
      ...props
    },
    ref,
  ) => {
    const [visible, setVisible] = useState(false)
    const Icon = visible ? EyeOff : Eye

    return (
      <div className="relative">
        <FormField
          ref={ref}
          type={visible ? 'text' : 'password'}
          className={cn('pr-10', className)}
          {...props}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? toggleLabelHide : toggleLabelShow}
          aria-pressed={visible}
          className={cn(
            'absolute right-2 top-[34px] inline-flex h-7 w-7 items-center justify-center rounded-md',
            'text-muted-foreground transition-colors hover:text-foreground',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
          )}
        >
          <Icon className="h-4 w-4" />
        </button>
      </div>
    )
  },
)
PasswordField.displayName = 'PasswordField'

export { PasswordField }
export type { PasswordFieldProps }
