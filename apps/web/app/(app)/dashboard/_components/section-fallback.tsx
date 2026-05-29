import { cn } from '@/lib/utils'

type Props = {
  message: string
  className?: string
}

export const SectionFallback = ({ message, className }: Props) => (
  <div
    className={cn(
      'flex h-full items-center justify-center rounded-2xl border border-dashed border-border bg-card p-6 text-center text-sm text-text-muted shadow-sm',
      className,
    )}
  >
    {message}
  </div>
)
