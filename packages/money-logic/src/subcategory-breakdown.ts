import { Money } from '@grana/validation'

// Pure helper to turn per-subcategory net values into donut slices + ranking
// for the "En qué se fue dentro de <category>" view.
//
// Why the API differs from buildCategorySlices: there, `categoryId: null` is
// safe to overload as the "Otros" tail marker because real categories always
// have an id. Here, `subcategoryId: null` represents a meaningful real bucket
// (transactions in the parent category with no subcategory assigned), so we
// can't also use null for an "Otros" tail without collisions. To keep the
// rule simple, this function does NOT produce an Otros bucket — it returns
// every positive slice sorted by value. The host component collapses the
// visual tail at render time, the same way the ranking already does for
// categories.

export type SubcategorySliceInput = {
  /** null = transactions of the parent category with no subcategory set. */
  subcategoryId: string | null
  label: string
  color: string | null
  icon: string | null
  /** Pre-aggregated value for this subcategory (e.g. net spend in the period). */
  value: number
}

export type SubcategorySlice = {
  /** null = "Sin subcategoría" bucket (real, drill-down target). */
  subcategoryId: string | null
  label: string
  color: string | null
  icon: string | null
  value: number
  /** Exact share of the total, 0–100. */
  percentage: number
  /** Cumulative percentage before this slice (arc start for the donut). */
  offset: number
}

export type SubcategoryBreakdown = {
  total: number
  slices: SubcategorySlice[]
}

/**
 * Build the breakdown: only positive values participate. Sorted by value
 * descending; percentages are exact (0–100); `offset` accumulates so the UI
 * can draw contiguous donut arcs.
 */
export function buildSubcategorySlices(
  inputs: SubcategorySliceInput[],
): SubcategoryBreakdown {
  const positive = inputs.filter((i) => i.value > 0)
  const total = Money.toNumber(
    positive.reduce((acc, i) => Money.add(acc, Money.from(i.value)), Money.from(0)),
  )

  if (total <= 0) return { total: 0, slices: [] }

  const sorted = [...positive].sort((a, b) => b.value - a.value)

  let offset = 0
  const slices: SubcategorySlice[] = sorted.map((i) => {
    const percentage = (i.value / total) * 100
    const slice: SubcategorySlice = {
      subcategoryId: i.subcategoryId,
      label: i.label,
      color: i.color,
      icon: i.icon,
      value: i.value,
      percentage,
      offset,
    }
    offset += percentage
    return slice
  })

  return { total, slices }
}
