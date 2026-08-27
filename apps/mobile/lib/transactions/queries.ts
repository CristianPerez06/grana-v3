// Transactions read layer for mobile. The feed read (the get_movements_page RPC
// wrapper, the FinancialMovement mapper and the MovementFilters contract) lives
// in `@grana/transactions`, shared with web. These wrappers inject the native
// Supabase client and keep the app's app-level signatures. Types are re-exported
// so the rest of the mobile app keeps importing them from here.

import { supabase } from '../supabase'
import {
  getGlobalMovementsPage,
  getInstallmentFamily,
  getMonthCategoryLines,
  getMovementFilterOptions as getMovementFilterOptionsImpl,
  getPendingReimbursements as getPendingReimbursementsImpl,
  getReimbursementsForExpense,
  getTransactionDetail,
  hasAnyTransaction as hasAnyTransactionImpl,
  toFinancialMovement,
  type FinancialMovement,
  type MonthCategoryLines,
  type MovementFilterOptions,
  type MovementFilters,
  type PendingReimbursementVM,
} from '@grana/transactions'
import { getMovementSharedInfo } from '../shared/queries'
import type { MovementDetailData } from '../../components/transactions/detail/MovementDetailView'

export type { FinancialMovement }

export type MovementsFeedPage = {
  movements: FinancialMovement[]
  hasMore: boolean
  nextLimit: number
}

// One page of the global movements feed for a given filter set. `limit` grows via
// the "load more" action (the shared read applies the limit+1 lookahead and
// returns `hasMore` / `nextLimit`).
//
// The WHOLE filter set goes to the RPC, not just the month: the feed paginates,
// so narrowing the page it got back would answer "which of these 50 rows match"
// instead of "which rows of the month match", and `hasMore` would stop
// describing the list on screen. The account detail is the one that filters in
// memory, and only because it loads its account's full history.
export async function getMovementsFeedPage(
  filters: MovementFilters,
  limit: number,
): Promise<MovementsFeedPage> {
  return getGlobalMovementsPage(supabase, { limit, filters })
}

// ── Drilled reconciliation list ───────────────────────────────────────────────
// The rows that COMPOSE a category's weight in the "En qué se fue" donut for the
// month + currency on screen. Uses the DEVENGADO lens, not the CAJA lens of the
// general feed: it shows the cuota of the month (never the off-ledger parent),
// the user's part of a shared movement, and the received reimbursement as its own
// subtracting row — so the sum of what it displays equals the donut weight BY
// CONSTRUCTION. The `category-lines-reconcile` invariant test guards the lens
// helpers against drift.
//
// This is a DRILL-ONLY view. It applies when the category is the only content
// filter active (optionally narrowed by subcategory); the moment the user layers
// an account / type / amount / text filter on top, the screen goes back to
// `getMovementsFeedPage`, which honours all filters combined and makes no
// reconciliation promise.
export type { MonthCategoryLines }
export async function getMonthCategoryLinesFeed(
  month: string,
  categoryId: string,
  currency: 'ARS' | 'USD',
  subcategoryId?: string,
): Promise<MonthCategoryLines> {
  return getMonthCategoryLines(supabase, month, categoryId, currency, subcategoryId)
}

// Option catalog for the filters sheet (active accounts + active categories +
// the active category's subcategories). Shared with web — same implementation,
// same RLS path. The options come from the CATALOG and not from the loaded rows:
// on a paginated feed, row-derived options would grow the filter menu every time
// the user pressed "load more".
export type { MovementFilterOptions } from '@grana/transactions'
export async function getMovementFilterOptions(
  categoryId: string | null,
): Promise<MovementFilterOptions> {
  return getMovementFilterOptionsImpl(supabase, {
    categoryId: categoryId ?? undefined,
  })
}

// Welcome vs. month-empty empty-state discriminator (LIMIT 1, constant cost).
export async function hasAnyTransaction(): Promise<boolean> {
  return hasAnyTransactionImpl(supabase)
}

// Pending reimbursements across all accounts (unscoped), for the feed's
// "Reintegros a confirmar" block. The account detail uses the account-scoped
// variant (`lib/accounts/queries.ts`).
export type { PendingReimbursementVM }
export async function getPendingReimbursementsFeed(): Promise<PendingReimbursementVM[]> {
  return getPendingReimbursementsImpl(supabase)
}

// The movement detail graph, keyed by `txId`. Composes the extracted
// transaction-graph reads (`@grana/transactions`) + the local shared-info mirror,
// mirroring the web detail page's fan-out. Returns null when the movement is not
// found (or RLS-invisible) so the screen renders its not-found state.
export async function getMovementDetail(txId: string): Promise<MovementDetailData | null> {
  const transaction = await getTransactionDetail(supabase, txId)
  if (!transaction) return null

  const movement = toFinancialMovement(transaction)

  // Owner (payer) gate for the edit/delete affordances: a shared movement is
  // readable cross-user but only its owner manages it (mirror of web's page).
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const canManage = transaction.user_id === user?.id

  // Reimbursements hang off the simple expense or the installment parent (madre);
  // for a child row we look them up on the parent.
  const reimbursementExpenseId =
    transaction.type === 'expense' ? (transaction.parent_id ?? transaction.id) : null

  const [family, reimbursements] = await Promise.all([
    transaction.is_parent
      ? getInstallmentFamily(supabase, transaction.id)
      : transaction.parent_id
        ? getInstallmentFamily(supabase, transaction.parent_id)
        : Promise.resolve(null),
    reimbursementExpenseId
      ? getReimbursementsForExpense(supabase, reimbursementExpenseId)
      : Promise.resolve([]),
  ])

  const sharedInfo = transaction.is_shared
    ? await getMovementSharedInfo(transaction.id, transaction.is_parent)
    : null

  return {
    transaction,
    movement,
    installmentParent: family?.parent ?? null,
    installmentSiblings: family?.children ?? null,
    reimbursements,
    sharedInfo,
    canManage,
  }
}
