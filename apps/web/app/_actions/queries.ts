'use server'

import { getAuthenticatedUserId } from './_lib/auth'
import {
  getGlobalMovementsPage,
  getMovementFilterOptions,
  getMonthCategoryBreakdown,
  getMonthSubcategoryBreakdown,
  getMonthIncomeBreakdown,
  hasUsdActivityInMonth,
  hasAnyTransaction,
  getPendingReimbursements,
  getAccountMovementsAscending,
  type MonthCategoryBreakdown,
  type MonthSubcategoryBreakdown,
} from '@/lib/transactions/queries'
import type { MovementFilters } from '@/lib/transactions/filters'
import type { FinancialMovement } from '@/lib/transactions/movements'
import type { TransactionWithDetails } from '@/lib/transactions/types'
import {
  getPendingRecurrenceInstances,
  getTopRecurrenceSuggestion,
  getRecurrenceLinkedTransactionIds,
  generateDueRecurrenceInstances,
} from '@/lib/recurrences/queries'
import {
  getAccounts,
  getAccountDetail,
  getInstitutions,
} from '@/lib/accounts/queries'
import { getAllCategories } from '@/lib/categories/queries'
import { getHousehold } from '@/lib/shared/queries'

// Thin server-action wrappers around the existing query functions so that
// client components on /transactions can call them via TanStack Query without
// exposing Supabase credentials. The wrappers do not add logic — they delegate
// to the underlying query and surface its return value as-is.

export async function getMovementsPageAction(
  options: { limit?: number; offset?: number; filters?: MovementFilters } = {},
): Promise<{ movements: FinancialMovement[]; hasMore: boolean; nextLimit: number }> {
  await getAuthenticatedUserId()
  // Lazy generation of due recurrence instances runs on every page load (same
  // contract as the previous RSC page.tsx).
  await generateDueRecurrenceInstances()
  return getGlobalMovementsPage(options)
}

export async function getMovementFilterOptionsAction(
  options: { categoryId?: string } = {},
): Promise<Awaited<ReturnType<typeof getMovementFilterOptions>>> {
  await getAuthenticatedUserId()
  return getMovementFilterOptions(options)
}

export async function getMonthCategoryBreakdownAction(
  month: string,
): Promise<MonthCategoryBreakdown> {
  await getAuthenticatedUserId()
  return getMonthCategoryBreakdown(month)
}

export async function getMonthSubcategoryBreakdownAction(
  month: string,
  categoryId: string,
): Promise<MonthSubcategoryBreakdown> {
  await getAuthenticatedUserId()
  return getMonthSubcategoryBreakdown(month, categoryId)
}

export async function getMonthIncomeBreakdownAction(
  month: string,
): Promise<MonthCategoryBreakdown> {
  await getAuthenticatedUserId()
  return getMonthIncomeBreakdown(month)
}

export async function hasUsdActivityInMonthAction(month: string): Promise<boolean> {
  await getAuthenticatedUserId()
  return hasUsdActivityInMonth(month)
}

export async function hasAnyTransactionAction(): Promise<boolean> {
  await getAuthenticatedUserId()
  return hasAnyTransaction()
}

export async function getPendingReimbursementsAction(
  accountId?: string,
): Promise<Awaited<ReturnType<typeof getPendingReimbursements>>> {
  await getAuthenticatedUserId()
  return getPendingReimbursements(accountId)
}

export async function getPendingRecurrenceInstancesAction(): Promise<
  Awaited<ReturnType<typeof getPendingRecurrenceInstances>>
> {
  await getAuthenticatedUserId()
  return getPendingRecurrenceInstances()
}

export async function getTopRecurrenceSuggestionAction(): Promise<
  Awaited<ReturnType<typeof getTopRecurrenceSuggestion>>
> {
  await getAuthenticatedUserId()
  return getTopRecurrenceSuggestion()
}

export async function getRecurrenceLinkedTransactionIdsAction(
  txIds: string[],
): Promise<Awaited<ReturnType<typeof getRecurrenceLinkedTransactionIds>>> {
  await getAuthenticatedUserId()
  return getRecurrenceLinkedTransactionIds(txIds)
}

export async function getAccountsAction(): Promise<
  Awaited<ReturnType<typeof getAccounts>>
> {
  await getAuthenticatedUserId()
  return getAccounts()
}

export async function getAllCategoriesAction(): Promise<
  Awaited<ReturnType<typeof getAllCategories>>
> {
  const userId = await getAuthenticatedUserId()
  return getAllCategories(userId)
}

export async function getHouseholdAction(): Promise<
  Awaited<ReturnType<typeof getHousehold>>
> {
  await getAuthenticatedUserId()
  return getHousehold()
}

// ── /accounts/[id] wrappers ───────────────────────────────────────────────────
// Same thin-wrapper contract as the queries above: delegate to the underlying
// function, expose it to the client via TanStack. The /accounts/[id] shell uses
// these to hydrate its header, drawer, movement list (filtered + sliced
// client-side) and the running-balance source.

export async function getAccountDetailAction(
  id: string,
): Promise<Awaited<ReturnType<typeof getAccountDetail>>> {
  await getAuthenticatedUserId()
  return getAccountDetail(id)
}

export async function getAccountMovementsAscendingAction(
  accountId: string,
): Promise<TransactionWithDetails[]> {
  await getAuthenticatedUserId()
  return getAccountMovementsAscending(accountId)
}

export async function getInstitutionsAction(): Promise<
  Awaited<ReturnType<typeof getInstitutions>>
> {
  await getAuthenticatedUserId()
  return getInstitutions()
}
