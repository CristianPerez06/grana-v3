import Link from 'next/link'
import type { RouteNotFoundProps } from '@grana/ui-contracts'
import { Button } from './button'
import { cn } from '@/lib/utils'

export const RouteNotFound = ({
  title,
  description,
  backHref,
  backLabel,
  className,
}: RouteNotFoundProps) => {
  return (
    <div
      className={cn(
        'flex min-h-[50vh] flex-col items-center justify-center gap-4 px-6 py-12 text-center',
        className,
      )}
    >
      <h2 className="text-lg font-semibold text-text">{title}</h2>
      <p className="max-w-md text-sm text-text-soft">{description}</p>
      <Button asChild variant="primary" size="md" className="w-auto px-6">
        <Link href={backHref}>{backLabel}</Link>
      </Button>
    </div>
  )
}
