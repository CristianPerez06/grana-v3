import Link from 'next/link'
import type { PageHeaderProps } from '@grana/ui-contracts'
import { cn } from '@/lib/utils'

export const PageHeader = ({
  title,
  description,
  backLink,
  actions,
  className,
}: PageHeaderProps) => {
  const titleAndDescription = (
    <div className="flex flex-col gap-1">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      {description && <p className="text-sm text-muted-foreground">{description}</p>}
    </div>
  )

  const titleBlock = actions ? (
    <div className="flex flex-wrap items-start justify-between gap-2">
      {titleAndDescription}
      {actions}
    </div>
  ) : (
    titleAndDescription
  )

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {backLink && (
        <div className="flex items-center gap-3">
          <Link
            href={backLink.href}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            ← {backLink.label}
          </Link>
        </div>
      )}
      {titleBlock}
    </div>
  )
}
