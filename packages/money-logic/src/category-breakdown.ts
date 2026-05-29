import { Money } from '@grana/validation'

// Pure helper to turn per-category net values into donut slices + ranking.
// Sorting, percentages and the "Otros" tail are computed here so web and mobile
// render the same breakdown. Percentages are exact (0–100); the UI rounds for
// display and uses `offset` (cumulative %) for the donut arcs.

export type CategorySliceInput = {
  categoryId: string
  label: string
  color: string | null
  icon: string | null
  /** The category's value for the relevant currency (e.g. its net spend). */
  value: number
}

export type CategorySlice = {
  /** null for the aggregated "Otros" slice. */
  categoryId: string | null
  label: string
  color: string | null
  icon: string | null
  value: number
  /** Exact share of the total, 0–100. */
  percentage: number
  /** Cumulative percentage before this slice (arc start for the donut). */
  offset: number
}

export type CategoryBreakdown = {
  total: number
  slices: CategorySlice[]
}

const OTHERS_COLOR = '#9CA3AF'

/**
 * Build the breakdown: only positive values participate (a fully-reimbursed or
 * empty category is not a slice). Sorted desc; the tail beyond `topN` named
 * slices is grouped into one "Otros" slice. `offset` accumulates so the UI can
 * draw contiguous donut arcs.
 */
export function buildCategorySlices(
  inputs: CategorySliceInput[],
  options: { topN?: number; othersLabel?: string } = {},
): CategoryBreakdown {
  const topN = options.topN ?? 6
  const othersLabel = options.othersLabel ?? 'Otros'

  const positive = inputs.filter((i) => i.value > 0)
  const total = Money.toNumber(
    positive.reduce((acc, i) => Money.add(acc, Money.from(i.value)), Money.from(0)),
  )

  if (total <= 0) return { total: 0, slices: [] }

  const sorted = [...positive].sort((a, b) => b.value - a.value)

  const named = sorted.slice(0, topN)
  const rest = sorted.slice(topN)

  const entries: Array<{ categoryId: string | null; label: string; color: string | null; icon: string | null; value: number }> =
    named.map((i) => ({ categoryId: i.categoryId, label: i.label, color: i.color, icon: i.icon, value: i.value }))

  if (rest.length > 0) {
    const othersValue = Money.toNumber(
      rest.reduce((acc, i) => Money.add(acc, Money.from(i.value)), Money.from(0)),
    )
    entries.push({ categoryId: null, label: othersLabel, color: OTHERS_COLOR, icon: null, value: othersValue })
  }

  let offset = 0
  const slices: CategorySlice[] = entries.map((e) => {
    const percentage = (e.value / total) * 100
    const slice: CategorySlice = { ...e, percentage, offset }
    offset += percentage
    return slice
  })

  return { total, slices }
}

// ── buildSliceMetaLine ────────────────────────────────────────────────────────

export type SliceMetaContext = {
  /** Movements in this category for the period. */
  movementCount: number
  /** Description of a dominant installment purchase, if any. Empty string is
   *  treated as absent so the caller can pass DB nulls converted to ''. */
  dominantInstallmentDescription?: string | null
  /** Movements in this category that came from a recurring rule. */
  recurringCount?: number
}

export type SliceMetaTemplates = {
  installments: (description: string, share: number) => string
  recurring: (count: number, share: number) => string
  movements: (count: number, share: number) => string
}

/**
 * Pick the enriched meta line for a slice. Priority:
 *   1. A dominant installment purchase (e.g. "25% · cuotas Sofá Sofías")
 *   2. Recurring movements present (e.g. "11% · 3 recurrentes")
 *   3. Plain movement count fallback (e.g. "40% · 8 movimientos")
 *
 * The templates are passed in so the helper stays i18n-agnostic — the caller
 * resolves the locale once and feeds the strings here.
 */
export function buildSliceMetaLine(
  slice: Pick<CategorySlice, 'percentage'>,
  ctx: SliceMetaContext,
  templates: SliceMetaTemplates,
): string {
  const share = Math.round(slice.percentage)
  if (ctx.dominantInstallmentDescription && ctx.dominantInstallmentDescription.trim().length > 0) {
    return templates.installments(ctx.dominantInstallmentDescription.trim(), share)
  }
  if (ctx.recurringCount && ctx.recurringCount > 0) {
    return templates.recurring(ctx.recurringCount, share)
  }
  return templates.movements(ctx.movementCount, share)
}
