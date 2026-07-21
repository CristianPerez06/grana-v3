// Shared/Compartido read layer for mobile. The query bodies and debt/ledger
// derivation live in `@grana/shared` (shared with web); these wrappers inject
// the native Supabase client and keep the app's signatures. Types are
// re-exported so the rest of the mobile app keeps importing them from here.
// Same pattern as `lib/cards/queries.ts` and `lib/transactions/queries.ts`.

import { supabase } from '../supabase'
import {
  getHousehold as getHouseholdImpl,
  getHouseholdDebt as getHouseholdDebtImpl,
  getHouseholdOutlook as getHouseholdOutlookImpl,
  getCurrentAccount as getCurrentAccountImpl,
  getPendingSettlements as getPendingSettlementsImpl,
  getSharedAccruedMovements as getSharedAccruedMovementsImpl,
  getMovementSharedInfo as getMovementSharedInfoImpl,
  getSharedExpenses as getSharedExpensesImpl,
} from '@grana/shared'
import type {
  Household,
  HouseholdMember,
  DebtByCurrency,
  PendingSettlement,
  SharedExpenseItem,
  CurrentAccountData,
  MovementSharedInfo,
} from '@grana/shared'

export type {
  Household,
  HouseholdMember,
  DebtByCurrency,
  PendingSettlement,
  SharedExpenseItem,
  CurrentAccountData,
  MovementSharedInfo,
}

/** The current user's active household (members + default split), or null. */
export function getHousehold(): Promise<Household | null> {
  return getHouseholdImpl(supabase)
}

/** Net pairwise debt per currency at `asOf` (defaults to today). */
export function getHouseholdDebt(asOf?: string): Promise<DebtByCurrency | null> {
  return getHouseholdDebtImpl(supabase, asOf)
}

/** Per-month projection of what enters the debt in the next `monthsAhead` months. */
export function getHouseholdOutlook(monthsAhead = 3) {
  return getHouseholdOutlookImpl(supabase, monthsAhead)
}

/** The household current account (extracto + ecuación + saldo + projection). */
export function getCurrentAccount(): Promise<CurrentAccountData | null> {
  return getCurrentAccountImpl(supabase)
}

/** Settlements awaiting the current user (receiver) to assign an account. */
export function getPendingSettlements(): Promise<PendingSettlement[]> {
  return getPendingSettlementsImpl(supabase)
}

/** Shared movements of the household scoped by DEVENGADO for the month. */
export function getSharedAccruedMovements(month: string): Promise<SharedExpenseItem[]> {
  return getSharedAccruedMovementsImpl(supabase, month)
}

/** Split info for a movement detail (own share + other members' shares). */
export function getMovementSharedInfo(
  transactionId: string,
  isParent: boolean,
): Promise<MovementSharedInfo | null> {
  return getMovementSharedInfoImpl(supabase, transactionId, isParent)
}

/** Recent shared expenses with this user's share (by month, or latest `limit`). */
export function getSharedExpenses(
  opts: { limit?: number; month?: string } = {},
): Promise<SharedExpenseItem[]> {
  return getSharedExpensesImpl(supabase, opts)
}
