'use client'

import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { formatARS, formatUSD } from '@grana/i18n-messages'
import type { CategoryBreakdown, CategorySlice } from '@grana/money-logic'

// Replace `{key}` placeholders in a template. ICU-free on purpose: the page
// resolves the raw template via `t.raw(...)` so next-intl doesn't try to format
// it server-side (where the runtime values aren't known yet), and we do the
// substitution here once the values exist.
const fillTemplate = (template: string, values: Record<string, string | number>): string => {
  let out = template
  for (const [key, value] of Object.entries(values)) {
    out = out.split(`{${key}}`).join(String(value))
  }
  return out
}
import { useShowCents } from '@/lib/preferences-context'

// Hybrid spending-by-category overview: a large static SVG donut (~200px) plus
// an enriched ranking, weighted by net spend, for ONE currency at a time
// (bimoneda: ARS and USD are never merged — the user toggles via the page).
// Donut math: circle of circumference 100 (r = 15.915) so each slice's
// dasharray maps 1:1 to its percentage; dashoffset positions it after the
// previous slice; rotate -90° to start at 12 o'clock.

const DONUT_FALLBACK = '#9CA3AF'
const RANKING_TOP = 5

type Props = {
  monthLabel: string
  /** href to the previous month — drives the `‹` arrow next to the label. */
  prevHref: string
  /** href to the next month — drives the `›` arrow next to the label. */
  nextHref: string
  /** Selected currency + its breakdown. */
  currency: 'ARS' | 'USD'
  breakdown: CategoryBreakdown
  /** Currency toggle: shown only when there is USD spend to switch to. */
  hasUsd: boolean
  arsHref: string
  usdHref: string
  /** Month, for category drill-down hrefs. */
  month: string
  /**
   * i18n-resolved labels for the editorial chrome. Templates carry `{key}`
   * placeholders that the component fills with runtime values — the page is
   * expected to pass them via `t.raw(...)` so next-intl doesn't try to format
   * them server-side. Plain labels are static strings.
   */
  labels: {
    eyebrow: string
    centerLabel: string
    /** Template: `"en {count} categorías"`. */
    categoriesCaptionTemplate: string
    offLedgerNote: string
    seeDetail: string
    /** Template: `"+ {count} categorías más"`. */
    othersLabelTemplate: string
    seeAllCategories: string
    emptyMessage: string
  }
  /**
   * Optional href for the "Ver el detalle →" link. When absent (current
   * default), the link is not rendered — we'd rather omit it than promise
   * navigation that doesn't add value. Reintroduce once a real drill-down
   * destination exists (e.g. an expanded breakdown page).
   */
  detailHref?: string
}

const categoryHref = (month: string, currency: 'ARS' | 'USD', categoryId: string | null) =>
  categoryId ? `/transactions?month=${month}&category=${categoryId}&currency=${currency}` : null

const Donut = ({ slices, size = 200 }: { slices: CategorySlice[]; size?: number }) => (
  <svg
    viewBox="0 0 36 36"
    width={size}
    height={size}
    role="img"
    className="shrink-0"
    aria-hidden
  >
    <circle
      cx="18"
      cy="18"
      r="15.915"
      fill="none"
      stroke="var(--border-soft, #EEF1F4)"
      strokeWidth="4"
    />
    {slices.map((s, i) => (
      <circle
        key={s.categoryId ?? `otros-${i}`}
        cx="18"
        cy="18"
        r="15.915"
        fill="none"
        stroke={s.color ?? DONUT_FALLBACK}
        strokeWidth="4"
        strokeDasharray={`${s.percentage} ${100 - s.percentage}`}
        strokeDashoffset={-s.offset}
        transform="rotate(-90 18 18)"
      />
    ))}
  </svg>
)

export const CategorySpendingOverview = ({
  monthLabel,
  prevHref,
  nextHref,
  currency,
  breakdown,
  hasUsd,
  arsHref,
  usdHref,
  month,
  labels,
  detailHref,
}: Props) => {
  const showCents = useShowCents()
  const fmt = (n: number) => (currency === 'ARS' ? formatARS(n, showCents) : formatUSD(n, showCents))

  // Collapse the tail beyond RANKING_TOP into a single "+ N categorías más"
  // line so the ranking stays scannable at ~5 rows.
  const named = breakdown.slices.slice(0, RANKING_TOP)
  const tail = breakdown.slices.slice(RANKING_TOP)
  const tailValue = tail.reduce((acc, s) => acc + s.value, 0)
  const tailPct = tail.reduce((acc, s) => acc + s.percentage, 0)

  return (
    <section
      aria-labelledby="spending-overview-title"
      className="flex flex-col gap-5 rounded-2xl border border-border bg-card px-7 py-6"
    >
      {/* Header: eyebrow + month nav (with arrows), ARS/USD switcher on the right */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1.5 min-w-0">
          <span
            id="spending-overview-title"
            className="text-[11px] font-semibold uppercase tracking-[0.08em] text-text-soft"
          >
            {labels.eyebrow}
          </span>
          <div className="flex items-center gap-2">
            <Link
              href={prevHref}
              aria-label="Mes anterior"
              className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border bg-card text-text-muted hover:text-text transition-colors"
            >
              <ChevronLeft size={14} />
            </Link>
            <span className="text-lg font-bold tracking-tight text-text capitalize">
              {monthLabel}
            </span>
            <Link
              href={nextHref}
              aria-label="Mes siguiente"
              className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border bg-card text-text-muted hover:text-text transition-colors"
            >
              <ChevronRight size={14} />
            </Link>
          </div>
        </div>
        {hasUsd && (
          <div className="flex items-center gap-1">
            <Link
              href={arsHref}
              className={`rounded-full px-3 py-1 text-[11px] font-semibold transition-colors ${
                currency === 'ARS'
                  ? 'bg-primary text-primary-foreground'
                  : 'border border-border bg-card text-text-muted hover:text-text'
              }`}
            >
              ARS
            </Link>
            <Link
              href={usdHref}
              className={`rounded-full px-3 py-1 text-[11px] font-semibold transition-colors ${
                currency === 'USD'
                  ? 'bg-primary text-primary-foreground'
                  : 'border border-border bg-card text-text-muted hover:text-text'
              }`}
            >
              USD
            </Link>
          </div>
        )}
      </div>

      {breakdown.slices.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">{labels.emptyMessage}</p>
      ) : (
        <div className="flex flex-col items-center gap-7 sm:flex-row sm:items-center">
          {/* Donut with centered amount + categories caption */}
          <div className="relative flex shrink-0 items-center justify-center">
            <Donut slices={breakdown.slices} size={200} />
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-text-soft">
                {labels.centerLabel}
              </span>
              <span className="text-2xl font-bold tabular-nums tracking-[-0.025em] text-text leading-none">
                {fmt(breakdown.total)}
              </span>
              <span className="mt-1 text-[11px] text-text-soft">
                {fillTemplate(labels.categoriesCaptionTemplate, {
                  count: breakdown.slices.length,
                })}
              </span>
            </div>
          </div>

          {/* Compact ranking: one row per slice. Share % sits inline next to
              the amount so we don't grow the card vertically with stacked
              meta lines. */}
          <ul className="flex flex-1 flex-col gap-2.5 min-w-0">
            {named.map((s, i) => {
              const href = categoryHref(month, currency, s.categoryId)
              const share = Math.round(s.percentage)
              const row = (
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: s.color ?? DONUT_FALLBACK }}
                  />
                  <span className="truncate text-sm font-medium text-text flex-1">
                    {s.icon ? `${s.icon} ` : ''}
                    {s.label}
                  </span>
                  <span className="shrink-0 w-10 text-right text-xs text-text-soft tabular-nums">
                    {share}%
                  </span>
                  <span className="shrink-0 text-sm font-semibold tabular-nums tracking-[-0.01em] text-text">
                    {fmt(s.value)}
                  </span>
                </div>
              )
              return (
                <li key={s.categoryId ?? `otros-${i}`}>
                  {href ? (
                    <Link
                      href={href}
                      className="block rounded-md hover:bg-muted/40 transition-colors"
                    >
                      {row}
                    </Link>
                  ) : (
                    row
                  )}
                </li>
              )
            })}

            {tail.length > 0 && (
              <li>
                <div className="flex items-center gap-3 min-w-0">
                  <span className="size-2.5 shrink-0 rounded-full bg-border" />
                  <span className="truncate text-sm font-medium text-text-muted flex-1">
                    {fillTemplate(labels.othersLabelTemplate, { count: tail.length })}
                  </span>
                  <span className="shrink-0 w-10 text-right text-xs text-text-soft tabular-nums">
                    {Math.round(tailPct)}%
                  </span>
                  <span className="shrink-0 text-sm font-semibold tabular-nums text-text-muted">
                    {fmt(tailValue)}
                  </span>
                </div>
              </li>
            )}
          </ul>
        </div>
      )}

      {/* Footer: off-ledger note. The see-detail link is rendered only when
          a real drill-down destination is passed in. */}
      <div
        className={`flex items-center gap-2 border-t border-border-soft pt-4 ${
          detailHref ? 'justify-between' : ''
        }`}
      >
        <span className="text-xs text-muted-foreground">{labels.offLedgerNote}</span>
        {detailHref && (
          <Link
            href={detailHref}
            className="inline-flex items-center gap-1 text-xs font-semibold text-emerald hover:text-emerald-deep transition-colors"
          >
            {labels.seeDetail}
            <ChevronRight size={12} />
          </Link>
        )}
      </div>
    </section>
  )
}
