import type { SpinnerProps } from '@grana/ui-contracts'
import { Spinner } from './spinner'
import { cn } from '@/lib/utils'

type RouteLoadingProps = {
  size?: SpinnerProps['size']
  label?: string
  className?: string
}

export const RouteLoading = ({ size = 'lg', label, className }: RouteLoadingProps) => (
  <div
    className={cn(
      'flex min-h-[50vh] w-full items-center justify-center px-6 py-12',
      className,
    )}
  >
    <Spinner size={size} label={label} />
  </div>
)
