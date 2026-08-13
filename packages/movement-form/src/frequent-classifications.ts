import type { FrequentClassification } from './types'

// Re-exported so the query layer (web server action, mobile) can import the
// ranker and its shapes from this React-free entry point in one import.
export type { FrequentClassification } from './types'

// How many frequent-classification chips to surface at most (#31 item 1). Kept
// small so they fit one row on mobile and never become a wall of chips. Also the
// per-type ranking limit. Lives here (React-free) so the query layer can import
// it without pulling in the hook module.
export const FREQUENT_CHIPS_MAX = 4

// Classifications that are system-generated rather than manually loaded, so they
// must never be offered as quick-add chips even if they rank high by frequency.
// `impuesto-de-sellos` is added automatically by the card statement-payment flow
// (a busy payment week inflates it), yet users almost never load it by hand.
// Referenced by immutable canonical_name and excluded BEFORE ranking, so the
// top-N fills with genuinely manual classifications. Extend as more auto-
// generated leaves surface.
export const EXCLUDED_CHIP_CATEGORY_CANONICALS: readonly string[] = []
export const EXCLUDED_CHIP_SUBCATEGORY_CANONICALS: readonly string[] = ['impuesto-de-sellos']

/**
 * A movement row projected for frequent-classification ranking. Both platforms
 * fetch their transactions and map to this flat shape; the ranking (grouping,
 * exclusions, top-N) lives here so web and mobile stay identical and testable.
 */
export type FrequentLeafRow = {
  type: 'income' | 'expense'
  categoryId: string | null
  subcategoryId: string | null
  /** Immutable canonical_name of the category / subcategory (for exclusions). */
  categoryCanonical: string | null
  subcategoryCanonical: string | null
  /** `is_active` of the category; `false` ⇒ archived, dropped. */
  categoryActive: boolean
  /** `is_active` of the subcategory, or null when the leaf has no subcategory. */
  subcategoryActive: boolean | null
  /** Movement date (ISO) — breaks frequency ties by recency. */
  date: string
}

/**
 * Rank the user's most-frequent leaf classifications `(category, subcategory)`
 * from movement rows: group by leaf, count uses, most used first (recency breaks
 * ties), returning the top `perTypeLimit` for `expense` and for `income`.
 * Excludes archived leaves and the system-generated blocklist BEFORE ranking, so
 * the top-N reflects genuinely manual classifications. Pure and I/O-free.
 */
export function rankFrequentClassifications(
  rows: FrequentLeafRow[],
  perTypeLimit: number = FREQUENT_CHIPS_MAX,
): FrequentClassification[] {
  type Agg = {
    type: 'income' | 'expense'
    categoryId: string
    subcategoryId: string | null
    count: number
    lastDate: string
  }
  const groups = new Map<string, Agg>()
  for (const row of rows) {
    if (!row.categoryId) continue
    if (row.categoryActive === false) continue
    if (row.subcategoryId && row.subcategoryActive === false) continue
    if (row.categoryCanonical && EXCLUDED_CHIP_CATEGORY_CANONICALS.includes(row.categoryCanonical)) {
      continue
    }
    if (
      row.subcategoryCanonical &&
      EXCLUDED_CHIP_SUBCATEGORY_CANONICALS.includes(row.subcategoryCanonical)
    ) {
      continue
    }
    const key = `${row.type}|${row.categoryId}|${row.subcategoryId ?? ''}`
    const existing = groups.get(key)
    if (existing) {
      existing.count += 1
      if (row.date > existing.lastDate) existing.lastDate = row.date
    } else {
      groups.set(key, {
        type: row.type,
        categoryId: row.categoryId,
        subcategoryId: row.subcategoryId,
        count: 1,
        lastDate: row.date,
      })
    }
  }

  const byFrequency = (a: Agg, b: Agg): number =>
    b.count - a.count || (b.lastDate > a.lastDate ? 1 : b.lastDate < a.lastDate ? -1 : 0)

  const topFor = (type: 'income' | 'expense'): FrequentClassification[] =>
    [...groups.values()]
      .filter((g) => g.type === type)
      .sort(byFrequency)
      .slice(0, perTypeLimit)
      .map((g) => ({ categoryId: g.categoryId, subcategoryId: g.subcategoryId }))

  return [...topFor('expense'), ...topFor('income')]
}
