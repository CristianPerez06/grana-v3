// Transactions read layer for mobile. The feed read (the get_movements_page RPC
// wrapper, the FinancialMovement mapper and the MovementFilters contract) lives
// in `@grana/transactions`, shared with web. These wrappers inject the native
// Supabase client and keep the app's app-level signatures. Types are re-exported
// so the rest of the mobile app keeps importing them from here.

import { supabase } from '../supabase'
import {
  getGlobalMovementsPage,
  hasAnyTransaction as hasAnyTransactionImpl,
  type FinancialMovement,
} from '@grana/transactions'

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
