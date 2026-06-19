import type { CategorySliceInput } from '@grana/money-logic'

// Cálculo puro del "Peso en el mes" sobre el breakdown mensual que ya usa el
// dashboard. Sin fetch nuevo de lógica: solo deriva porcentaje y ranking.

export type MonthWeight = {
  /** Category share of the month's total spending (0–100). */
  pct: number
  /** 1-based rank of the category by value within the month. */
  rank: number
  /** Number of categories with spend in the month. */
  count: number
  /** This movement's amount as a share of its category's month value (0–100). */
  shareOfCategoryPct: number
}

const UNCATEGORIZED = 'uncategorized'

/** Expense: the movement's category weight within the month. */
export const resolveCategoryWeight = (
  slices: CategorySliceInput[],
  categoryId: string | null,
  movementAmount: number,
): MonthWeight | null => {
  if (!slices.length) return null
  const monthTotal = slices.reduce((sum, s) => sum + s.value, 0)
  if (monthTotal <= 0) return null

  const key = categoryId ?? UNCATEGORIZED
  const sorted = [...slices].sort((a, b) => b.value - a.value)
  const idx = sorted.findIndex((s) => s.categoryId === key)
  if (idx === -1) return null

  const categoryValue = sorted[idx]!.value
  return {
    pct: (categoryValue / monthTotal) * 100,
    rank: idx + 1,
    count: sorted.length,
    shareOfCategoryPct:
      categoryValue > 0 ? Math.min(100, (movementAmount / categoryValue) * 100) : 0,
  }
}

/** Income: the movement's share of all the income that entered in the month. */
export const resolveIncomeWeight = (
  slices: CategorySliceInput[],
  movementAmount: number,
): number | null => {
  const total = slices.reduce((sum, s) => sum + s.value, 0)
  if (total <= 0) return null
  return Math.min(100, (movementAmount / total) * 100)
}
