'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'
import { formatARS, formatUSD } from '@grana/i18n-messages'
import {
  DONUT_FALLBACK,
  generateSubTints,
  INCOME_PALETTE,
  MODE_ACCENT,
  netAfterCredits,
  RANKING_VISIBLE,
  type CategoryBreakdown,
  type CategorySlice,
  type SubcategoryBreakdown,
} from '@grana/money-logic'

const fillTemplate = (template: string, values: Record<string, string | number>): string => {
  let out = template
  for (const [key, value] of Object.entries(values)) {
    out = out.split(`{${key}}`).join(String(value))
  }
  return out
}
import { useShowCents } from '@/lib/preferences-context'
import { donutAmountFontSize } from '@/lib/donut-amount'

// Max subcategory slices pre-created in the SVG pool (keeps DOM stable).
const MAX_SUB_SLICES = 8
// Lock duration (ms) matching the CSS transition so clicks mid-animation are ignored.
const DRILL_LOCK_MS = 380

// ── Types ────────────────────────────────────────────────────────────────────

/**
 * When provided, every navigation interaction routes through these callbacks
 * instead of through `<Link>`s on the URL props. The shell on /transactions
 * uses this to drive its React-state filters; legacy callers that still
 * navigate via URL leave it undefined and the URL props apply.
 */
export type CategorySpendingOverviewController = {
  onPrevMonth: () => void
  onNextMonth: () => void
  onSetCurrency: (currency: 'ARS' | 'USD') => void
  onSetMode: (mode: 'egresos' | 'ingresos') => void
  /**
   * Drill into a ranking row. When the donut is in subcategory mode
   * (`parentCategoryId` is set), `categoryId` is the subcategoryId.
   */
  onSelectCategory: (categoryId: string) => void
  /** Clear the active category filter — back to the all-categories overview. */
  onClearCategory?: () => void
  onSeeDetail?: () => void
}

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
  /** Optional controller; when present, click handlers replace the URL links. */
  controller?: CategorySpendingOverviewController
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
  /**
   * Full, uncapped per-category ranking (sorted desc, with percentages). The
   * donut's `breakdown` is grouped into top-N + "Otros", but the ranking lists
   * every category — the rows beyond RANKING_VISIBLE collapse into an expandable
   * "+ N categorías más" control. Falls back to `breakdown.slices` for legacy
   * callers that don't pass it.
   */
  rankingSlices?: CategorySlice[]
  labels: {
    eyebrow: string
    /** Base eyebrow without the "dentro de X" suffix (clickable back crumb). */
    baseEyebrow: string
    /** Active category name, when a category filter is on (for the breadcrumb). */
    activeCategoryName?: string
    centerLabel: string
    categoriesCaptionTemplate: string
    offLedgerNote: string
    seeDetail: string
    othersLabelTemplate: string
    seeAllCategories: string
    /** "Ver menos" — collapses the expanded category tail. */
    showLess: string
    emptyMessage: string
    /** Mode selector tab labels. */
    modeEgresos: string
    modeIngresos: string
    /** Mode-specific subtitle shown under the selector. */
    subtitle: string
    /** Label for the credits ("te devolvieron") group. */
    creditsLabel: string
    /** Closing line under the credits: what the month cost once they are subtracted. */
    netTotalLabel: string
  }
  detailHref?: string
  /**
   * Categories whose net is a credit (received reimbursements exceed the
   * month's spend) for the active currency. Egresos mode only; shown apart
   * from the donut. `value` is the credit magnitude (positive).
   */
  credits?: Array<{ categoryId: string; label: string; color: string | null; value: number }>
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
  rankingSlices,
  controller,
  credits,
}: Props) => {
  const showCents = useShowCents()
  const fmt = (n: number) => (currency === 'ARS' ? formatARS(n, showCents) : formatUSD(n, showCents))

  // Mode visuals: accent colours the title/centre label/active tab; income
  // segments take a positional green palette, expenses keep their DB colour.
  const accent = MODE_ACCENT[mode]
  // Subcategory mode (egresos, drilled into a parent via `parentCategoryId`):
  // the query stamps every slice with the same parent colour. Recolour them as
  // monochromatic tints of the parent so each subcategory reads distinctly —
  // brightest = largest, since slices arrive sorted by value descending.
  const subTints = useMemo(() => {
    if (mode !== 'egresos' || !parentCategoryId || breakdown.slices.length === 0) return null
    const parent = breakdown.slices[0]?.color ?? DONUT_FALLBACK
    return generateSubTints(parent, breakdown.slices.length)
  }, [mode, parentCategoryId, breakdown.slices])
  const sliceColor = useCallback(
    (slice: CategorySlice, index: number): string =>
      mode === 'ingresos'
        ? INCOME_PALETTE[index % INCOME_PALETTE.length]
        : subTints
          ? subTints[index] ?? DONUT_FALLBACK
          : slice.color ?? DONUT_FALLBACK,
    [mode, subTints],
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
  // The ranking lists EVERY category (full, uncapped `rankingSlices`), not the
  // donut's grouped slices — otherwise the tail beyond RANKING_VISIBLE would be
  // the opaque "Otros" bucket the user can't drill into. Rows past
  // RANKING_VISIBLE fold into an expandable control so the list stays compact.
  const rankingSource = rankingSlices ?? breakdown.slices
  const named = rankingSource.slice(0, RANKING_VISIBLE)
  const tail = rankingSource.slice(RANKING_VISIBLE)
  const tailValue = tail.reduce((acc, s) => acc + s.value, 0)
  const tailPct = tail.reduce((acc, s) => acc + s.percentage, 0)
  const [tailExpanded, setTailExpanded] = useState(false)
  // Bars are scaled against the largest share (slices arrive sorted desc) so the
  // top category fills the track and the rest read as a proportion of it.
  const maxPercentage = rankingSource[0]?.percentage ?? 100

  // A single category ranking row — a header line (icon · label · % · amount)
  // plus a thin bar of the category's share. Shared by the visible rows and the
  // expanded tail so both behave identically (drill, filter, or link).
  const renderCategoryRow = (s: CategorySlice, i: number) => {
    const href = buildRowHref(s.categoryId, { month, currency, mode, parentCategoryId })
    const share = Math.round(s.percentage)
    const barWidth = maxPercentage > 0 ? (s.percentage / maxPercentage) * 100 : 0
    // Match the donut's coloring: income uses the positional green palette,
    // expenses keep each category's own colour.
    const barColor =
      mode === 'ingresos'
        ? INCOME_PALETTE[i % INCOME_PALETTE.length]
        : s.color ?? DONUT_FALLBACK
    const isDrillable =
      subBreakdownsByCategory && s.categoryId
        ? (subBreakdownsByCategory[s.categoryId]?.[currency]?.slices.length ?? 0) > 0
        : false

    const row = (
      <div className="flex flex-col gap-1.5 min-w-0">
        <div className="flex items-center gap-3 min-w-0">
          <span className="truncate text-sm font-medium text-text flex-1">
            {s.icon ? `${s.icon} ` : ''}
            {s.label}
            {isDrillable && <span className="ml-1 text-text-soft text-xs">›</span>}
          </span>
          <span className="shrink-0 w-10 text-right text-xs text-text-soft tabular-nums">
            {share}%
          </span>
          <span className="shrink-0 text-sm font-semibold tabular-nums tracking-[-0.01em] text-text">
            {fmt(s.value)}
          </span>
        </div>
        <div className="h-1.5 rounded-full bg-border-soft overflow-hidden">
          <div
            className="h-full rounded-full"
            style={{ width: `${barWidth}%`, backgroundColor: barColor }}
          />
        </div>
      </div>
    )

    return (
      <li key={s.categoryId ?? `otros-${i}`}>
        {isDrillable && s.categoryId ? (
          <button
            type="button"
            onClick={() => drillIn(s.categoryId!)}
            className="block w-full rounded-md px-1.5 py-1 hover:bg-muted/40 transition-colors text-left"
            aria-label={`Ver subcategorías de ${s.label}`}
            aria-expanded={drilledId === s.categoryId}
          >
            {row}
          </button>
        ) : controller && s.categoryId ? (
          <button
            type="button"
            onClick={() => controller.onSelectCategory(s.categoryId!)}
            className="block w-full rounded-md px-1.5 py-1 hover:bg-muted/40 transition-colors text-left"
          >
            {row}
          </button>
        ) : href ? (
          <Link href={href} className="block rounded-md px-1.5 py-1 hover:bg-muted/40 transition-colors">
            {row}
          </Link>
        ) : (
          <div className="px-1.5 py-1">{row}</div>
        )}
      </li>
    )
  }

  // ── Breadcrumb ─────────────────────────────────────────────────────────────
  // In-category filter view (a category is selected and the ranking shows its
  // subcategories): expose a clickable "‹ base eyebrow › Category" crumb whose
  // first segment clears the filter, so the chart and the movement list return
  // to "all categories" together.
  const inCategory = !drilledId && Boolean(parentCategoryId) && Boolean(controller?.onClearCategory)
  const breadcrumb = drilledId && drilledSlice ? (
    <span className="text-xl font-extrabold tracking-tight">
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
  ) : inCategory ? (
    <span className="text-xl font-extrabold tracking-tight">
      <button
        type="button"
        onClick={controller!.onClearCategory}
        className="text-slate hover:underline cursor-pointer"
      >
        {labels.baseEyebrow}
      </button>
      {labels.activeCategoryName && (
        <>
          <span className="mx-1 text-text-soft">›</span>
          <span className="text-text">{labels.activeCategoryName}</span>
        </>
      )}
    </span>
  ) : (
    <span
      id="spending-overview-title"
      className="text-xl font-extrabold tracking-tight"
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
      <span
        className="font-bold tabular-nums tracking-[-0.025em] text-text leading-none mt-0.5"
        style={{ fontSize: donutAmountFontSize(fmt(drilledSub.total), 200, 24) }}
      >
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
      <span
        className="font-bold tabular-nums tracking-[-0.025em] text-text leading-none"
        style={{ fontSize: donutAmountFontSize(fmt(breakdown.total), 200, 24) }}
      >
        {fmt(breakdown.total)}
      </span>
      <span className="mt-1 text-[11px] text-text-soft">
        {fillTemplate(labels.categoriesCaptionTemplate, { count: rankingSource.length })}
      </span>
      {inCategory && (
        <button
          type="button"
          onClick={controller!.onClearCategory}
          className="mt-1 text-[10px] font-semibold text-slate hover:underline leading-none"
          aria-label="Volver a todas las categorías"
        >
          ‹ Volver
        </button>
      )}
    </>
  )

  return (
    <section
      aria-labelledby="spending-overview-title"
      className="flex flex-col gap-5 rounded-2xl border border-border bg-card px-5 py-6 sm:px-7"
    >
      {/* Header row 1: title + subtitle (left) · month navigator (right). */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-0.5 min-w-0">
          {breadcrumb}
          <p className="text-sm font-medium text-text-soft">{labels.subtitle}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {controller ? (
            <button
              type="button"
              onClick={controller.onPrevMonth}
              aria-label="Mes anterior"
              className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border bg-card text-text-muted hover:text-text transition-colors"
            >
              <ChevronLeft size={14} />
            </button>
          ) : (
            <Link
              href={prevHref}
              aria-label="Mes anterior"
              className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border bg-card text-text-muted hover:text-text transition-colors"
            >
              <ChevronLeft size={14} />
            </Link>
          )}
          <span className="text-base font-bold tracking-tight text-text capitalize">
            {monthLabel}
          </span>
          {controller ? (
            <button
              type="button"
              onClick={controller.onNextMonth}
              aria-label="Mes siguiente"
              className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border bg-card text-text-muted hover:text-text transition-colors"
            >
              <ChevronRight size={14} />
            </button>
          ) : (
            <Link
              href={nextHref}
              aria-label="Mes siguiente"
              className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border bg-card text-text-muted hover:text-text transition-colors"
            >
              <ChevronRight size={14} />
            </Link>
          )}
        </div>
      </div>

      {/* Header row 2: mode selector (Egresos / Ingresos) on the left, currency
          toggle (ARS / USD) on the right — both pill families share this row. */}
      <div className="flex items-center justify-between gap-3">
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
            const className = 'rounded-lg px-4 py-1.5 text-sm font-bold transition-colors'
            const style = active
              ? { backgroundColor: MODE_ACCENT[key], color: '#fff' }
              : { color: '#6B7683' }
            if (controller) {
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => controller.onSetMode(key)}
                  role="tab"
                  aria-selected={active}
                  className={className}
                  style={style}
                >
                  {label}
                </button>
              )
            }
            return (
              <Link
                key={key}
                href={href}
                role="tab"
                aria-selected={active}
                className={className}
                style={style}
              >
                {label}
              </Link>
            )
          })}
        </div>
        {hasUsd && (
          <div className="flex shrink-0 items-center gap-1">
            {(['ARS', 'USD'] as const).map((code) => {
              const active = currency === code
              const className = `rounded-full px-3 py-1 text-[11px] font-semibold transition-colors ${
                active
                  ? 'bg-primary text-primary-foreground'
                  : 'border border-border bg-card text-text-muted hover:text-text'
              }`
              if (controller) {
                return (
                  <button
                    key={code}
                    type="button"
                    onClick={() => controller.onSetCurrency(code)}
                    className={className}
                  >
                    {code}
                  </button>
                )
              }
              return (
                <Link key={code} href={code === 'ARS' ? arsHref : usdHref} className={className}>
                  {code}
                </Link>
              )
            })}
          </div>
        )}
      </div>

      {breakdown.slices.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border px-6 py-10 text-center">
          <p className="text-sm font-medium text-text-muted">{labels.emptyMessage}</p>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-7 sm:flex-row sm:items-center">
          {/* Donut + center label */}
          <div
            className={
              drilledId || inCategory
                ? 'relative flex shrink-0 items-center justify-center cursor-pointer'
                : 'relative flex shrink-0 items-center justify-center'
            }
            onClick={drilledId ? drillOut : inCategory ? controller!.onClearCategory : undefined}
            role={drilledId || inCategory ? 'button' : undefined}
            aria-label={drilledId || inCategory ? 'Volver a todas las categorías' : undefined}
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
              // Category ranking — top-N named rows, then the rest behind an
              // expandable "+ N categorías más" control so every category is
              // reachable (the old aggregate row was a dead end).
              <>
                {named.map((s, i) => renderCategoryRow(s, i))}

                {tail.length > 0 && tailExpanded &&
                  tail.map((s, i) => renderCategoryRow(s, RANKING_VISIBLE + i))}

                {tail.length > 0 && (
                  <li>
                    <button
                      type="button"
                      onClick={() => setTailExpanded((v) => !v)}
                      className="block w-full rounded-md hover:bg-muted/40 transition-colors text-left"
                      aria-expanded={tailExpanded}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="flex items-center gap-1 truncate text-sm font-medium text-slate flex-1">
                          {tailExpanded
                            ? labels.showLess
                            : fillTemplate(labels.othersLabelTemplate, { count: tail.length })}
                          <ChevronDown
                            size={14}
                            className={`shrink-0 transition-transform ${
                              tailExpanded ? 'rotate-180' : ''
                            }`}
                            aria-hidden
                          />
                        </span>
                        {!tailExpanded && (
                          <>
                            <span className="shrink-0 w-10 text-right text-xs text-text-soft tabular-nums">
                              {Math.round(tailPct)}%
                            </span>
                            <span className="shrink-0 text-sm font-semibold tabular-nums text-text-muted">
                              {fmt(tailValue)}
                            </span>
                          </>
                        )}
                      </div>
                    </button>
                  </li>
                )}
              </>
            )}
          </ul>
        </div>
      )}

      {/* Categorías en crédito — "te devolvieron", fuera de la dona (egresos). */}
      {mode === 'egresos' && credits && credits.length > 0 && (
        <div className="border-t border-border-soft pt-4">
          <p className="mb-2.5 text-xs font-extrabold uppercase tracking-wide text-text-soft">
            {labels.creditsLabel}
          </p>
          <ul className="flex flex-col gap-2.5">
            {credits.map((c, i) => (
              <li
                key={c.categoryId ?? `credit-${i}`}
                className="flex items-center gap-3 min-w-0"
              >
                <span
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: c.color ?? DONUT_FALLBACK }}
                />
                <span className="truncate text-sm font-medium text-text flex-1">{c.label}</span>
                <span className="shrink-0 text-sm font-semibold tabular-nums text-income">
                  +{fmt(c.value)}
                </span>
              </li>
            ))}
          </ul>
          {/* Closing line: the centre is the sum of the DRAWN slices, so with a
              category in credit it is neither gross nor net. This states what the
              month cost once the credits come off — the figure the dashboard's
              "Gastaste" tile shows. */}
          <div className="mt-2.5 flex items-center gap-3 border-t border-border-soft pt-2.5">
            <span className="min-w-0 flex-1 truncate text-sm font-semibold text-text">
              {labels.netTotalLabel}
            </span>
            <span className="shrink-0 text-sm font-extrabold tabular-nums text-text">
              {fmt(netAfterCredits(breakdown.total, credits))}
            </span>
          </div>
        </div>
      )}

      {/* Footer. The "includes card spending" note only applies to expenses
          (devengado: card consumos/cuotas count by their date), so it is hidden
          in the Ingresos mode. */}
      {(mode === 'egresos' || detailHref) && (
        <div
          className={`flex items-center gap-2 border-t border-border-soft pt-4 ${
            detailHref ? 'justify-between' : ''
          }`}
        >
          {mode === 'egresos' && (
            <span className="text-xs text-muted-foreground">{labels.offLedgerNote}</span>
          )}
          {controller && controller.onSeeDetail ? (
            <button
              type="button"
              onClick={controller.onSeeDetail}
              className="inline-flex items-center gap-1 text-xs font-semibold text-emerald hover:text-emerald-deep transition-colors"
            >
              {labels.seeDetail}
              <ChevronRight size={12} />
            </button>
          ) : (
            detailHref && (
              <Link
                href={detailHref}
                className="inline-flex items-center gap-1 text-xs font-semibold text-emerald hover:text-emerald-deep transition-colors"
              >
                {labels.seeDetail}
                <ChevronRight size={12} />
              </Link>
            )
          )}
        </div>
      )}
    </section>
  )
}
