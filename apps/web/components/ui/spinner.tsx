import { Loader2 } from 'lucide-react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const spinnerVariants = cva('animate-spin text-muted-foreground', {
  variants: {
    size: {
      sm: 'h-4 w-4',
      md: 'h-6 w-6',
      lg: 'h-8 w-8',
    },
  },
  defaultVariants: { size: 'md' },
})

type SpinnerProps = VariantProps<typeof spinnerVariants> & {
  className?: string
  label?: string
}

export const Spinner = ({ size, className, label = 'Loading' }: SpinnerProps) => (
  <Loader2
    role="status"
    aria-label={label}
    className={cn(spinnerVariants({ size }), className)}
  />
)

export { spinnerVariants }
