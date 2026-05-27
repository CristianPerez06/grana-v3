'use client'

import Link from 'next/link'
import { formatARS, formatUSD } from '@grana/i18n-messages'
import type { CategoryBreakdown, CategorySlice } from '@grana/money-logic'
import { useShowCents } from '@/lib/preferences-context'

// Spending-by-category overview: a lightweight SVG donut (no chart library) +
// a ranked list, weighted by net spend, for ONE currency at a time (bimoneda:
// ARS and USD are never merged — the user toggles). The page resolves
// labels/month/currency/hrefs; this only reads the cents preference.

const DONUT_FALLBACK = '#9CA3AF'

type Props = {
  title: string
  monthLabel: string
  prevHref: string
  nextHref: string
  emptyLabel: string
  /** Selected currency + its breakdown. */
  currency: 'ARS' | 'USD'
  breakdown: CategoryBreakdown
  /** Currency toggle: shown only when there is USD spend to switch to. */
  hasUsd: boolean
  arsHref: string
  usdHref: string
  /** Month, for category drill-down hrefs. */
  month: string
}

const categoryHref = (month: string, currency: 'ARS' | 'USD', categoryId: string | null) =>
  categoryId ? `/transactions?month=${month}&category=${categoryId}&currency=${currency}` : null

// Classic CSS donut: a circle of circumference 100 (r = 15.915) so each slice's
// dasharray maps 1:1 to its percentage; dashoffset positions it after the
// previous slice; rotate -90° to start at 12 o'clock.
const Donut = ({ slices, size = 150 }: { slices: CategorySlice[]; size?: number }) => (
  <svg viewBox="0 0 36 36" width={size} height={size} role="img" className="shrink-0">
    <circle cx="18" cy="18" r="15.915" fill="none" stroke="var(--border, #e5e7eb)" strokeWidth="3.5" />
    {slices.map((s, i) => (
      <circle
        key={s.categoryId ?? `otros-${i}`}
        cx="18"
        cy="18"
        r="15.915"
        fill="none"
        stroke={s.color ?? DONUT_FALLBACK}
        strokeWidth="3.5"
        strokeDasharray={`${s.percentage} ${100 - s.percentage}`}
        strokeDashoffset={-s.offset}
        transform="rotate(-90 18 18)"
      />
    ))}
  </svg>
)

export const CategorySpendingOverview = ({
  title,
  monthLabel,
  prevHref,
  nextHref,
  emptyLabel,
  currency,
  breakdown,
  hasUsd,
  arsHref,
  usdHref,
  month,
}: Props) => {
  const showCents = useShowCents()
  const fmt = (n: number) => (currency === 'ARS' ? formatARS(n, showCents) : formatUSD(n, showCents))

  return (
    <section className="flex flex-col gap-4 rounded-lg border border-border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
        <div className="flex items-center gap-2">
          {hasUsd && (
            <div className="flex items-center rounded-md border border-border text-xs">
              <Link
                href={arsHref}
                className={`rounded-l px-2 py-1 ${currency === 'ARS' ? 'bg-primary/10 font-medium text-primary' : 'text-muted-foreground hover:text-foreground'}`}
              >
                ARS
              </Link>
              <Link
                href={usdHref}
                className={`rounded-r px-2 py-1 ${currency === 'USD' ? 'bg-primary/10 font-medium text-primary' : 'text-muted-foreground hover:text-foreground'}`}
              >
                USD
              </Link>
            </div>
          )}
          <div className="flex items-center gap-1 text-sm">
            <Link
              href={prevHref}
              aria-label="←"
              className="rounded px-2 py-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              ‹
            </Link>
            <span className="min-w-28 text-center font-medium capitalize">{monthLabel}</span>
            <Link
              href={nextHref}
              aria-label="→"
              className="rounded px-2 py-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              ›
            </Link>
          </div>
        </div>
      </div>

      {breakdown.slices.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted-foreground">{emptyLabel}</p>
      ) : (
        <div className="flex flex-col items-center gap-5 sm:flex-row">
          <div className="relative flex items-center justify-center">
            <Donut slices={breakdown.slices} />
            <span className="absolute text-base font-bold tabular-nums">{fmt(breakdown.total)}</span>
          </div>
          <ul className="flex flex-1 flex-col gap-2">
            {breakdown.slices.map((s, i) => {
              const href = categoryHref(month, currency, s.categoryId)
              const row = (
                <div className="flex items-center gap-2">
                  <span
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: s.color ?? DONUT_FALLBACK }}
                  />
                  <span className="min-w-0 flex-1 truncate text-sm">
                    {s.icon ? `${s.icon} ` : ''}
                    {s.label}
                  </span>
                  <span className="shrink-0 text-sm font-medium tabular-nums">{fmt(s.value)}</span>
                  <span className="w-10 shrink-0 text-right text-xs text-muted-foreground tabular-nums">
                    {Math.round(s.percentage)}%
                  </span>
                </div>
              )
              return (
                <li key={s.categoryId ?? `otros-${i}`}>
                  {href ? (
                    <Link href={href} className="block rounded-md px-1 py-0.5 hover:bg-muted/50">
                      {row}
                    </Link>
                  ) : (
                    <div className="px-1 py-0.5">{row}</div>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </section>
  )
}
