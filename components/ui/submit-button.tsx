import { forwardRef, type ComponentPropsWithoutRef } from 'react'
import { Button } from './button'

type SubmitButtonProps = ComponentPropsWithoutRef<typeof Button> & {
  pending?: boolean
}

const SubmitButton = forwardRef<HTMLButtonElement, SubmitButtonProps>(
  ({ pending = false, type = 'submit', ...props }, ref) => (
    <Button
      ref={ref}
      type={type}
      loading={pending}
      aria-busy={pending || undefined}
      {...props}
    />
  ),
)
SubmitButton.displayName = 'SubmitButton'

export { SubmitButton }
export type { SubmitButtonProps }
