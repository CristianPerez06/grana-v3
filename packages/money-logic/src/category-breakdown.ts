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
