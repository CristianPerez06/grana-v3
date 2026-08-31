import type { DbClient } from '@/lib/supabase/db-client'
import {
  getMonthCategoryBreakdown as getMonthCategoryBreakdownShared,
  UNCATEGORIZED_ID,
  type MonthCategoryBreakdown,
} from '@grana/dashboard'
import { financialTodayISO } from '@grana/money-logic'
import {
  getAccountMovementsAscending,
  getPendingReimbursements,
  TRANSACTION_SELECT,
  attachLinkedExpenses,
  isHistoryRow,
} from '@grana/transactions'

export { UNCATEGORIZED_ID, type MonthCategoryBreakdown }
import type { TransactionWithDetails } from './types'

// The account-scoped read slice (movements list + pending reimbursements) and
// its `PendingReimbursementVM` type now live in `@grana/transactions` so mobile
// can reuse them. Re-exported here so existing call sites keep their imports and
// the `accountMovementsAscending` / `accountPendingReimbursements` query keys
// stay unchanged. The shared select shape and helpers (`TRANSACTION_SELECT`,
// `attachLinkedExpenses`, `isHistoryRow`) are imported above and reused by the
// web-retained feed reads below.
export { getAccountMovementsAscending, getPendingReimbursements }
export type { PendingReimbursementVM } from '@grana/transactions'

// ── getTransactions ───────────────────────────────────────────────────────────

export async function getTransactions(
  supabase: DbClient,
  accountId: string,
  options: { limit?: number; offset?: number; currencyCode?: 'ARS' | 'USD' } = {},
): Promise<TransactionWithDetails[]> {
  const { limit = 20, offset = 0, currencyCode } = options

  let query = supabase
    .from('transactions')
    .select(TRANSACTION_SELECT)
    .or(`account_id.eq.${accountId},transfer_destination_account_id.eq.${accountId}`)
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .range(offset, offset + limit - 1)

  if (currencyCode) {
    query = query.eq('currency_code', currencyCode)
  }

  const { data, error } = await query

  if (error) throw error

  return attachLinkedExpenses(
    supabase,
    ((data ?? []) as unknown as TransactionWithDetails[]).filter(isHistoryRow),
  )
}

// ── Global movements feed ─────────────────────────────────────────────────────
// `getGlobalMovements`, `getGlobalMovementsPage` and `hasAnyTransaction` now live
// in `@grana/transactions` (the mobile Movimientos tab is the second consumer).
// Re-exported here so web keeps importing them from `@/lib/transactions/queries`
// unchanged — same RPC (`get_movements_page`), same pagination, same query keys.
export { getGlobalMovements, getGlobalMovementsPage, hasAnyTransaction } from '@grana/transactions'

// The transaction-graph detail reads (detail + installment family + expense
// reimbursements) now live in `@grana/transactions` (the mobile `/transactions/[txId]`
// screen is the second consumer). Re-exported here so web keeps importing them from
// `@/lib/transactions/queries` unchanged — same select shape and RLS path.
export {
  getTransactionDetail,
  getInstallmentFamily,
  getReimbursementsForExpense,
} from '@grana/transactions'
export type { ExpenseReimbursementVM } from '@grana/transactions'

// The filter-options catalog (accounts / categories / subcategories of the
// active category) now lives in `@grana/transactions` so the mobile Movimientos
// tab and the mobile account detail reuse it. Re-exported here so web keeps
// importing it from `@/lib/transactions/queries` unchanged — same shape, same
// RLS path, same TanStack query keys.
export { getMovementFilterOptions } from '@grana/transactions'
export type { MovementFilterOptions } from '@grana/transactions'

// ── getMonthCategoryBreakdown ──────────────────────────────────────────────────
// The implementation lives in `@grana/dashboard` (shared with mobile). Web wraps
// it to inject its server client; `UNCATEGORIZED_ID` and `MonthCategoryBreakdown`
// are re-exported above so existing callers don't need to change imports.

export async function getMonthCategoryBreakdown(
  supabase: DbClient,
  month: string,
  todayISO: string = financialTodayISO(),
): Promise<MonthCategoryBreakdown> {
  return getMonthCategoryBreakdownShared(supabase, month, todayISO)
}

// ── getMonthCategoryLines (drilled reconciliation list) ────────────────────────
// The rows that COMPOSE a category's weight in the "En qué se fue" donut for a
// month + currency. Now lives in `@grana/transactions` (the native drill is the
// second consumer): it needs that package's movement machinery, and it could NOT
// go to `@grana/dashboard` next to `getMonthCategoryBreakdown` without closing
// the `transactions → dashboard` cycle. The devengado lens itself stays shared in
// `@grana/money-logic`, guarded by the `category-lines-reconcile` invariant test.
export { getMonthCategoryLines } from '@grana/transactions'
export type { MonthCategoryLines } from '@grana/transactions'

// ── Spending-overview reads ───────────────────────────────────────────────────
// `hasUsdAccount`, `getMonthIncomeBreakdown` and `getMonthSubcategoryBreakdown`
// now live in `@grana/dashboard` (the native "En qué se fue" card is the second
// consumer). Re-exported here so web keeps importing them from
// `@/lib/transactions/queries` unchanged — same queries, same query keys.
export {
  getMonthIncomeBreakdown,
  getMonthSubcategoryBreakdown,
  hasUsdAccount,
  SUBCATEGORY_UNCATEGORIZED_ID,
  type MonthSubcategoryBreakdown,
} from '@grana/dashboard'
