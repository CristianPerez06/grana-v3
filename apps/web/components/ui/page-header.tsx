import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { PageHeaderProps } from '@grana/ui-contracts'
import { cn } from '@/lib/utils'

export const PageHeader = ({
  title,
  description,
  eyebrow,
  monthLabel,
  monthLabelParts,
  prevMonthHref,
  nextMonthHref,
  descriptionExtras,
  backLink,
  actions,
  className,
}: PageHeaderProps) => {
  const isNarrative = monthLabel != null || monthLabelParts != null

  // ── Narrative variant ────────────────────────────────────────────────────
  if (isNarrative) {
    return (
      <div className={cn('flex flex-col gap-2', className)}>
        {backLink && (
          <Link
            href={backLink.href}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            ← {backLink.label}
          </Link>
        )}

        {eyebrow && (
          <span className="text-xs font-semibold uppercase tracking-[0.08em] text-text-soft">
            {eyebrow}
          </span>
        )}

        <div className="flex items-center gap-4">
          {prevMonthHref && (
            <Link
              href={prevMonthHref}
              aria-label="Mes anterior"
              className="inline-flex h-9 w-9 items-center justify-center rounded-[10px] border border-border bg-card text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronLeft size={18} />
            </Link>
          )}

          <div className="flex flex-col gap-0.5">
            {/* `title` stays in the DOM as an h1 for a11y, but the display
                role is carried by the monthLabel — so we render the heading
                visually hidden and put monthLabel in the editorial slot. */}
            <h1 className="sr-only">{title}</h1>
            {monthLabelParts ? (
              <span className="flex items-baseline gap-2" aria-hidden>
                <span className="text-[28px] font-bold leading-none tracking-[-0.02em] text-text capitalize">
                  {monthLabelParts.month}
                </span>
                <span className="text-sm font-medium leading-none text-muted-foreground tabular-nums">
                  {monthLabelParts.year}
                </span>
              </span>
            ) : (
              <span
                className="text-[28px] font-bold leading-none tracking-[-0.02em] text-text capitalize"
                aria-hidden
              >
                {monthLabel}
              </span>
            )}
            {(description || descriptionExtras) && (
              <p className="text-sm text-muted-foreground">
                {description}
                {descriptionExtras}
              </p>
            )}
          </div>

          {nextMonthHref && (
            <Link
              href={nextMonthHref}
              aria-label="Mes siguiente"
              className="inline-flex h-9 w-9 items-center justify-center rounded-[10px] border border-border bg-card text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronRight size={18} />
            </Link>
          )}
        </div>
      </div>
    )
  }

  // ── Classic variant (existing behavior) ──────────────────────────────────
  const titleAndDescription = (
    <div className="flex flex-col gap-1">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      {(description || descriptionExtras) && (
        <p className="text-sm text-muted-foreground">
          {description}
          {descriptionExtras}
        </p>
      )}
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
