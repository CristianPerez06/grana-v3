import Link from 'next/link'
import type { CategorySlice } from '@grana/money-logic'

// Dashboard teaser: the top categories of the month as a hook into the full
// spending-by-category breakdown in Movimientos. Shows proportions (bar + %),
// NOT amounts — so it needs no eye-mask and stays a light gateway.

const FALLBACK = '#9CA3AF'

type Props = {
  title: string
  viewAllLabel: string
  href: string
  /** Top categories (already sliced/sorted), ARS. */
  slices: CategorySlice[]
}

export const CategoryTeaser = ({ title, viewAllLabel, href, slices }: Props) => {
  if (slices.length === 0) return null

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
        <Link href={href} className="text-xs font-medium text-primary hover:underline">
          {viewAllLabel}
        </Link>
      </div>

      <ul className="flex flex-col gap-2">
        {slices.map((s) => (
          <li key={s.categoryId} className="flex items-center gap-2">
            <span className="min-w-0 flex-1 truncate text-sm">
              {s.icon ? `${s.icon} ` : ''}
              {s.label}
            </span>
            <div className="h-1.5 w-20 shrink-0 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full"
                style={{ width: `${s.percentage}%`, backgroundColor: s.color ?? FALLBACK }}
              />
            </div>
            <span className="w-9 shrink-0 text-right text-xs text-muted-foreground tabular-nums">
              {Math.round(s.percentage)}%
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
