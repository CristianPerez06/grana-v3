// Transactions read layer for mobile. The feed read (the get_movements_page RPC
// wrapper, the FinancialMovement mapper and the MovementFilters contract) lives
// in `@grana/transactions`, shared with web. These wrappers inject the native
// Supabase client and keep the app's app-level signatures. Types are re-exported
// so the rest of the mobile app keeps importing them from here.

import { supabase } from '../supabase'
import {
  getGlobalMovementsPage,
  getInstallmentFamily,
  getReimbursementsForExpense,
  getTransactionDetail,
  hasAnyTransaction as hasAnyTransactionImpl,
  toFinancialMovement,
  type FinancialMovement,
} from '@grana/transactions'
import { getMovementSharedInfo } from '../shared/queries'
import type { MovementDetailData } from '../../components/transactions/detail/MovementDetailView'

export type { FinancialMovement }

export type MovementsFeedPage = {
  movements: FinancialMovement[]
  hasMore: boolean
  nextLimit: number
}

// One page of the global movements feed for a `YYYY-MM` month. `limit` grows via
// the "load more" action (the shared read applies the limit+1 lookahead and
// returns `hasMore` / `nextLimit`).
export async function getMovementsFeedPage(
  month: string,
  limit: number,
): Promise<MovementsFeedPage> {
  return getGlobalMovementsPage(supabase, { limit, filters: { month } })
}

// Welcome vs. month-empty empty-state discriminator (LIMIT 1, constant cost).
export async function hasAnyTransaction(): Promise<boolean> {
  return hasAnyTransactionImpl(supabase)
}

// The movement detail graph, keyed by `txId`. Composes the extracted
// transaction-graph reads (`@grana/transactions`) + the local shared-info mirror,
// mirroring the web detail page's fan-out. Returns null when the movement is not
// found (or RLS-invisible) so the screen renders its not-found state.
export async function getMovementDetail(txId: string): Promise<MovementDetailData | null> {
  const transaction = await getTransactionDetail(supabase, txId)
  if (!transaction) return null

  const movement = toFinancialMovement(transaction)

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
  }
}
