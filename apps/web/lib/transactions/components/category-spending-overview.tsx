'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { formatARS, formatUSD } from '@grana/i18n-messages'
import type { CategoryBreakdown, CategorySlice, SubcategoryBreakdown } from '@grana/money-logic'

const fillTemplate = (template: string, values: Record<string, string | number>): string => {
  let out = template
  for (const [key, value] of Object.entries(values)) {
    out = out.split(`{${key}}`).join(String(value))
  }
  return out
}
import { useShowCents } from '@/lib/preferences-context'

const DONUT_FALLBACK = '#9CA3AF'
const RANKING_TOP = 5

// ── Mode palette / accent (design handoff: selector Egresos / Ingresos) ────────
// Egresos keeps each category's own DB colour (multicolour by design); Ingresos
// uses a fixed green palette assigned by ranking position so income categories
// read as a single tonal family even when they have no colour set.
const INCOME_PALETTE = ['#0E9E6E', '#16B981', '#4FC79A', '#86D9B8']
// Accent drives the eyebrow title, the donut centre label and the active tab.
const MODE_ACCENT: Record<'egresos' | 'ingresos', string> = {
  egresos: '#0B1A2B',
  ingresos: '#0E9E6E',
}
// Max subcategory slices pre-created in the SVG pool (keeps DOM stable).
const MAX_SUB_SLICES = 8
// Lock duration (ms) matching the CSS transition so clicks mid-animation are ignored.
const DRILL_LOCK_MS = 380

// ── Color tinting ─────────────────────────────────────────────────────────────

function hexToHSL(hex: string): { h: number; s: number; l: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (!result) return { h: 0, s: 0, l: 50 }
  const r = parseInt(result[1], 16) / 255
  const g = parseInt(result[2], 16) / 255
  const b = parseInt(result[3], 16) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  if (max === min) return { h: 0, s: 0, l: l * 100 }
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h = 0
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6
  else if (max === g) h = ((b - r) / d + 2) / 6
  else h = ((r - g) / d + 4) / 6
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) }
}

// Generates N monochromatic tints of the parent color, varying lightness from
// 70% (lightest, largest slice) to 34% (darkest, smallest slice), clamping
// saturation at 62% so colours don't blow out on bright hues.
function generateSubTints(parentColor: string, n: number): string[] {
  if (n === 0) return []
  const { h, s } = hexToHSL(parentColor)
  const sc = Math.min(s, 62)
  if (n === 1) return [`hsl(${h} ${sc}% 52%)`]
  return Array.from({ length: n }, (_, j) => {
    const l = 70 - (70 - 34) * (j / (n - 1))
    return `hsl(${h} ${sc}% ${Math.round(l)}%)`
  })
}

// ── Types ────────────────────────────────────────────────────────────────────

type Props = {
  monthLabel: string
  prevHref: string
  nextHref: string
  currency: 'ARS' | 'USD'
  /** Overview mode: expenses ("En qué se fue") or income ("De dónde vino"). */
  mode: 'egresos' | 'ingresos'
  /** URL-driven mode selector hrefs (preserve current month + currency). */
  egresosHref: string
  ingresosHref: string
  breakdown: CategoryBreakdown
  hasUsd: boolean
  arsHref: string
  usdHref: string
  month: string
  /**
   * Parent category id when the donut is in the in-category subcategory mode
   * (expenses only). Used to build each row's href so it drills into the parent
   * category + the clicked subcategory. Serializable — passed instead of a
   * function so it crosses the Server→Client boundary cleanly.
   */
  parentCategoryId?: string
  /**
   * Pre-fetched subcategory breakdowns by category id, for both currencies.
   * When present, clicking a category with sub-data triggers an animated in-situ
   * drill-down instead of navigating to a new URL.
   */
  subBreakdownsByCategory?: Record<string, { ARS: SubcategoryBreakdown; USD: SubcategoryBreakdown }>
  labels: {
    eyebrow: string
    centerLabel: string
    categoriesCaptionTemplate: string
    offLedgerNote: string
    seeDetail: string
    othersLabelTemplate: string
    seeAllCategories: string
    emptyMessage: string
    /** Mode selector tab labels. */
    modeEgresos: string
    modeIngresos: string
    /** Mode-specific subtitle shown under the selector. */
    subtitle: string
  }
  detailHref?: string
}

// Builds a ranking row's href. Three cases:
//   • ingresos → that income category's movements for the month
//   • egresos in-category (parentCategoryId set) → parent category + subcategory
//   • egresos default → that category's movements
const buildRowHref = (
  categoryId: string | null,
  ctx: {
    month: string
    currency: 'ARS' | 'USD'
    mode: 'egresos' | 'ingresos'
    parentCategoryId?: string
  },
): string | null => {
  if (!categoryId) return null
  const { month, currency, mode, parentCategoryId } = ctx
  if (mode === 'ingresos') {
    return `/transactions?month=${month}&category=${categoryId}&type=income&currency=${currency}&overview=ingresos`
  }
  if (parentCategoryId) {
    return `/transactions?month=${month}&category=${parentCategoryId}&subcategory=${categoryId}&currency=${currency}`
  }
  return `/transactions?month=${month}&category=${categoryId}&currency=${currency}`
}

// ── Animated donut SVG ────────────────────────────────────────────────────────

type DonutProps = {
  parentSlices: CategorySlice[]
  childSlices: Array<{ percentage: number; offset: number; color: string }>
  childrenVisible: boolean
  size?: number
}

const AnimatedDonut = ({ parentSlices, childSlices, childrenVisible, size = 200 }: DonutProps) => {
  const arcStyle: React.CSSProperties = {
    transition:
      'stroke-dasharray .34s cubic-bezier(.65,0,.35,1), stroke-dashoffset .34s cubic-bezier(.65,0,.35,1), opacity .26s ease',
  }

  return (
    <svg viewBox="0 0 36 36" width={size} height={size} role="img" className="shrink-0" aria-hidden>
      {/* Track ring */}
      <circle
        cx="18"
        cy="18"
        r="15.915"
        fill="none"
        stroke="var(--border-soft, #EEF1F4)"
        strokeWidth="4"
      />

      {/* Parent slices — fade out on drill-in */}
      {parentSlices.map((s, i) => (
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
          style={{ ...arcStyle, opacity: childrenVisible ? 0 : 1 }}
        />
      ))}

      {/* Child slices pool — pre-created, animate from/to sweep 0 */}
      {Array.from({ length: MAX_SUB_SLICES }, (_, i) => {
        const s = childSlices[i]
        const pct = s && childrenVisible ? s.percentage : 0
        const off = s && childrenVisible ? s.offset : 0
        const color = s ? s.color : 'transparent'
        return (
          <circle
            key={`sub-${i}`}
            cx="18"
            cy="18"
            r="15.915"
            fill="none"
            stroke={color}
            strokeWidth="4"
            strokeDasharray={`${pct} ${100 - pct}`}
            strokeDashoffset={-off}
            transform="rotate(-90 18 18)"
            style={{ ...arcStyle, opacity: childrenVisible && s ? 1 : 0 }}
          />
        )
      })}
    </svg>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export const CategorySpendingOverview = ({
  monthLabel,
  prevHref,
  nextHref,
  currency,
  mode,
  egresosHref,
  ingresosHref,
  breakdown,
  hasUsd,
  arsHref,
  usdHref,
  month,
  labels,
  detailHref,
  parentCategoryId,
  subBreakdownsByCategory,
}: Props) => {
  const showCents = useShowCents()
  const fmt = (n: number) => (currency === 'ARS' ? formatARS(n, showCents) : formatUSD(n, showCents))

  // Mode visuals: accent colours the title/centre label/active tab; income
  // segments take a positional green palette, expenses keep their DB colour.
  const accent = MODE_ACCENT[mode]
  const sliceColor = useCallback(
    (slice: CategorySlice, index: number): string =>
      mode === 'ingresos'
        ? INCOME_PALETTE[index % INCOME_PALETTE.length]
        : slice.color ?? DONUT_FALLBACK,
    [mode],
  )
  // Slices recoloured for the donut (the SVG reads `color` off each slice).
  const donutSlices = useMemo(
    () => breakdown.slices.map((s, i) => ({ ...s, color: sliceColor(s, i) })),
    [breakdown.slices, sliceColor],
  )

  // ── Drill-down state ───────────────────────────────────────────────────────
  const [drilledId, setDrilledId] = useState<string | null>(null)
  const [rankingVisible, setRankingVisible] = useState(true)
  const busyRef = useRef(false)

  // Resolve the drilled category slice and its sub-breakdown.
  const drilledSlice = drilledId ? breakdown.slices.find((s) => s.categoryId === drilledId) ?? null : null
  const drilledSub = drilledId && subBreakdownsByCategory
    ? (subBreakdownsByCategory[drilledId]?.[currency] ?? null)
    : null

  // Child slices with tinted colors derived from the parent color.
  const childSlices = useMemo(() => {
    if (!drilledSlice || !drilledSub || drilledSub.slices.length === 0) return []
    const tints = generateSubTints(drilledSlice.color ?? DONUT_FALLBACK, drilledSub.slices.length)
    return drilledSub.slices.map((s, i) => ({
      percentage: s.percentage,
      offset: s.offset,
      color: tints[i] ?? DONUT_FALLBACK,
      label: s.label,
      value: s.value,
    }))
  }, [drilledSlice, drilledSub])

  const drillIn = useCallback(
    (categoryId: string) => {
      if (busyRef.current) return
      if (!subBreakdownsByCategory) return
      const sub = subBreakdownsByCategory[categoryId]?.[currency]
      if (!sub || sub.slices.length === 0) return // not drillable

      busyRef.current = true
      setRankingVisible(false)
      setTimeout(() => {
        setDrilledId(categoryId)
        setRankingVisible(true)
        setTimeout(() => { busyRef.current = false }, DRILL_LOCK_MS)
      }, 170) // crossfade: fade out → swap → fade in
    },
    [subBreakdownsByCategory, currency],
  )

  const drillOut = useCallback(() => {
    if (busyRef.current) return
    busyRef.current = true
    setRankingVisible(false)
    setTimeout(() => {
      setDrilledId(null)
      setRankingVisible(true)
      setTimeout(() => { busyRef.current = false }, DRILL_LOCK_MS)
    }, 170)
  }, [])

  // Reset drill when currency changes (sub-data reloads for the new currency,
  // so the previously drilled view no longer maps cleanly). Mirrors the
  // URL-sync pattern used elsewhere in the module.
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    setDrilledId(null)
    setRankingVisible(true)
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [currency])

  // ── Ranking rows ───────────────────────────────────────────────────────────
  const named = breakdown.slices.slice(0, RANKING_TOP)
  const tail = breakdown.slices.slice(RANKING_TOP)
  const tailValue = tail.reduce((acc, s) => acc + s.value, 0)
  const tailPct = tail.reduce((acc, s) => acc + s.percentage, 0)

  // ── Breadcrumb ─────────────────────────────────────────────────────────────
  const breadcrumb = drilledId && drilledSlice ? (
    <span className="text-[11px] font-semibold uppercase tracking-[0.08em]">
      <button
        type="button"
        onClick={drillOut}
        className="text-slate hover:underline cursor-pointer"
      >
        {labels.eyebrow}
      </button>
      <span className="mx-1 text-text-soft">›</span>
      <span className="text-text">{drilledSlice.label}</span>
    </span>
  ) : (
    <span
      id="spending-overview-title"
      className="text-[11px] font-bold uppercase tracking-[0.08em]"
      style={{ color: accent }}
    >
      {labels.eyebrow}
    </span>
  )

  // ── Center label ───────────────────────────────────────────────────────────
  const centerLabel = drilledSlice && drilledSub ? (
    <>
      <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-text-soft leading-none">
        {drilledSlice.label}
      </span>
      <span className="text-2xl font-bold tabular-nums tracking-[-0.025em] text-text leading-none mt-0.5">
        {fmt(drilledSub.total)}
      </span>
      <span className="mt-1 text-[10px] text-text-soft leading-none">
        {drilledSub.slices.length} subcategorías
      </span>
      <button
        type="button"
        onClick={drillOut}
        className="mt-1 text-[10px] font-semibold text-slate hover:underline leading-none"
        aria-label="Volver a categorías"
      >
        ‹ Volver
      </button>
    </>
  ) : (
    <>
      <span
        className="text-[11px] font-bold uppercase tracking-[0.14em]"
        style={{ color: accent }}
      >
        {labels.centerLabel}
      </span>
      <span className="text-2xl font-bold tabular-nums tracking-[-0.025em] text-text leading-none">
        {fmt(breakdown.total)}
      </span>
      <span className="mt-1 text-[11px] text-text-soft">
        {fillTemplate(labels.categoriesCaptionTemplate, { count: breakdown.slices.length })}
      </span>
    </>
  )

  return (
    <section
      aria-labelledby="spending-overview-title"
      className="flex flex-col gap-5 rounded-2xl border border-border bg-card px-7 py-6"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1.5 min-w-0">
          {breadcrumb}
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

      {/* Mode selector (Egresos / Ingresos) — same "pill" family as the currency
          toggle; the active tab adopts the mode's accent (navy / emerald). */}
      <div className="flex flex-col gap-2">
        <div
          className="inline-flex w-fit gap-1 rounded-xl p-1"
          style={{ backgroundColor: '#EEF1F5' }}
          role="tablist"
          aria-label={labels.eyebrow}
        >
          {([
            { key: 'egresos', href: egresosHref, label: labels.modeEgresos },
            { key: 'ingresos', href: ingresosHref, label: labels.modeIngresos },
          ] as const).map(({ key, href, label }) => {
            const active = mode === key
            return (
              <Link
                key={key}
                href={href}
                role="tab"
                aria-selected={active}
                className="rounded-lg px-4 py-1.5 text-sm font-bold transition-colors"
                style={
                  active
                    ? { backgroundColor: MODE_ACCENT[key], color: '#fff' }
                    : { color: '#6B7683' }
                }
              >
                {label}
              </Link>
            )
          })}
        </div>
        <p className="text-sm font-medium text-text-soft">{labels.subtitle}</p>
      </div>

      {breakdown.slices.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border px-6 py-10 text-center">
          <p className="text-sm font-medium text-text-muted">{labels.emptyMessage}</p>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-7 sm:flex-row sm:items-center">
          {/* Donut + center label */}
          <div
            className="relative flex shrink-0 items-center justify-center cursor-pointer"
            onClick={drilledId ? drillOut : undefined}
            role={drilledId ? 'button' : undefined}
            aria-label={drilledId ? 'Volver a categorías' : undefined}
          >
            <AnimatedDonut
              parentSlices={donutSlices}
              childSlices={childSlices}
              childrenVisible={drilledId !== null}
              size={200}
            />
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none gap-0.5">
              {centerLabel}
            </div>
          </div>

          {/* Ranking */}
          <ul
            className="flex flex-1 flex-col gap-2.5 min-w-0"
            style={{
              opacity: rankingVisible ? 1 : 0,
              transition: 'opacity .18s ease',
            }}
          >
            {drilledId && drilledSub ? (
              // Subcategory ranking
              childSlices.map((s, i) => (
                <li key={`sub-rank-${i}`}>
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className="size-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: s.color }}
                    />
                    <span className="truncate text-sm font-medium text-text flex-1">
                      {s.label}
                    </span>
                    <span className="shrink-0 w-10 text-right text-xs text-text-soft tabular-nums">
                      {Math.round(s.percentage)}%
                    </span>
                    <span className="shrink-0 text-sm font-semibold tabular-nums tracking-[-0.01em] text-text">
                      {fmt(s.value)}
                    </span>
                  </div>
                </li>
              ))
            ) : (
              // Category ranking
              <>
                {named.map((s, i) => {
                  const href = buildRowHref(s.categoryId, { month, currency, mode, parentCategoryId })
                  const share = Math.round(s.percentage)
                  const isDrillable =
                    subBreakdownsByCategory && s.categoryId
                      ? (subBreakdownsByCategory[s.categoryId]?.[currency]?.slices.length ?? 0) > 0
                      : false

                  const row = (
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="truncate text-sm font-medium text-text flex-1">
                        {s.icon ? `${s.icon} ` : ''}
                        {s.label}
                        {isDrillable && (
                          <span className="ml-1 text-text-soft text-xs">›</span>
                        )}
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
                      {isDrillable && s.categoryId ? (
                        <button
                          type="button"
                          onClick={() => drillIn(s.categoryId!)}
                          className="block w-full rounded-md hover:bg-muted/40 transition-colors text-left"
                          aria-label={`Ver subcategorías de ${s.label}`}
                          aria-expanded={drilledId === s.categoryId}
                        >
                          {row}
                        </button>
                      ) : href ? (
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
              </>
            )}
          </ul>
        </div>
      )}

      {/* Footer. The off-ledger disclaimer only applies to expenses (income is
          never on a card statement), so it is hidden in the Ingresos mode. */}
      {(mode === 'egresos' || detailHref) && (
        <div
          className={`flex items-center gap-2 border-t border-border-soft pt-4 ${
            detailHref ? 'justify-between' : ''
          }`}
        >
          {mode === 'egresos' && (
            <span className="text-xs text-muted-foreground">{labels.offLedgerNote}</span>
          )}
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
      )}
    </section>
  )
}
