import type { BalanceCurrency } from '@grana/money-logic'
import type { SharedExpenseItem } from './types'

export type SharedCategoryGroup = {
  categoryId: string | null
  name: string | null
  canonicalName: string | null
  isSystem: boolean
  color: string | null
  /** Household TOTAL for the category in this currency (both parts), not the
   *  user's own portion. /shared shows the household's spending — unlike the
   *  dashboard, which shows only the user's part (see spending-counts-shared-split). */
  value: number
}

/** Total shared spending (gross) in a currency: sum of the household total
 *  (`amount`) of the devengado-scoped EXPENSES. */
export function sharedSpendingTotal(
  items: SharedExpenseItem[],
  currency: BalanceCurrency,
): number {
  return items
    .filter((e) => e.kind === 'expense' && e.currencyCode === currency)
    .reduce((acc, e) => acc + e.amount, 0)
}

/** Total received shared reimbursements in a currency (household total). */
export function sharedReimbursementsTotal(
  items: SharedExpenseItem[],
  currency: BalanceCurrency,
): number {
  return items
    .filter((e) => e.kind === 'reimbursement' && e.currencyCode === currency)
    .reduce((acc, e) => acc + e.amount, 0)
}

/** A member's own share of the net (own expense shares − own reimbursement shares). */
export function sharedOwnNetShare(
  items: SharedExpenseItem[],
  currency: BalanceCurrency,
): number {
  return items
    .filter((e) => e.currencyCode === currency)
    .reduce((acc, e) => acc + (e.kind === 'expense' ? e.ownShare : -e.ownShare), 0)
}

/**
 * Group shared EXPENSES by category for one currency, summing the HOUSEHOLD
 * TOTAL (`amount`, both parts). Sorted descending by value. Reimbursements are
 * ignored here (gross spending; net = bruto − reintegros is a later step). The
 * caller adds i18n labels, colour fallback and percentages.
 */
export function groupSharedSpendingByCategory(
  items: SharedExpenseItem[],
  currency: BalanceCurrency,
): SharedCategoryGroup[] {
  const byCat = new Map<string, SharedCategoryGroup>()
  for (const e of items) {
    if (e.kind !== 'expense' || e.currencyCode !== currency) continue
    const key = e.categoryId ?? 'none'
    const cur =
      byCat.get(key) ??
      {
        categoryId: e.categoryId,
        name: e.categoryName,
        canonicalName: e.categoryCanonicalName,
        isSystem: e.categoryIsSystem,
        color: e.categoryColor,
        value: 0,
      }
    cur.value += e.amount
    byCat.set(key, cur)
  }
  return [...byCat.values()].sort((a, b) => b.value - a.value)
}
