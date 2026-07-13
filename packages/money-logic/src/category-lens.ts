// ── Category-spending lens (CONSUMO / devengado) ───────────────────────────────
// The two drift-prone rules that define which movements compose a category's
// spend, and at what amount, under the "En qué se fue" lens. Extracted so the
// donut breakdown (`getMonthCategoryBreakdown`, weights per category) and the
// drilled reconciliation list (`getMonthCategoryLines`, the rows that compose
// each weight) share ONE definition — a `reconcile-category-drill-list`
// invariant test exercises both paths over the same rows to guarantee they
// never diverge.

/**
 * The portion of a movement attributable to the current user, under the shared
 * "cuenta corriente" model:
 *   - own (not shared) → the whole amount;
 *   - shared → the user's `shared_expense_split.amount_assigned` (looked up in
 *     `mySplitByTx`), or `null` when she has no split (0% / 100% the other
 *     member's) → the caller skips the row entirely.
 *
 * Applies identically to expenses and reimbursements (a shared reimbursement
 * nets only the user's part).
 */
export function categoryOwnPortion(
  row: { id: string; is_shared: boolean; amount: number },
  mySplitByTx: Map<string, number>,
): number | null {
  return row.is_shared ? (mySplitByTx.get(row.id) ?? null) : row.amount
}

/**
 * Whether an `expense` row counts as category spend under the devengado lens.
 * Excluded: the installment PARENT (`is_parent`, off-ledger — its cuota children
 * count by their own date instead) and the statement PAYMENT (`hasStatementPayment`
 * — it cancels debt, the consumos it covers already counted in their month).
 * Cuota children, cash/debit expenses and card consumos all count.
 */
export function countsAsCategorySpend(row: {
  is_parent: boolean
  hasStatementPayment: boolean
}): boolean {
  return !row.is_parent && !row.hasStatementPayment
}
