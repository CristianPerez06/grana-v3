import { Loader2 } from 'lucide-react'
import { cva } from 'class-variance-authority'
import type { SpinnerProps } from '@grana/ui-contracts'
import { cn } from '@/lib/utils'

const spinnerVariants = cva('animate-spin text-muted-foreground', {
  variants: {
    size: {
      sm: 'h-4 w-4',
      md: 'h-6 w-6',
      lg: 'h-10 w-10',
    },
  },
  defaultVariants: { size: 'md' },
})

export const Spinner = ({ size, className, label = 'Loading' }: SpinnerProps) => (
  <Loader2
    role="status"
    aria-label={label}
    className={cn(spinnerVariants({ size }), className)}
  />
)

export { spinnerVariants }
