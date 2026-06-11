'use server'

import { createClient } from '@/lib/supabase/server'
import { getAuthenticatedUserId } from './_lib/auth'
import {
  getMovementFilterOptions,
  getMonthCategoryBreakdown,
  getPendingReimbursements,
  getAccountMovementsAscending,
  type MonthCategoryBreakdown,
} from '@/lib/transactions/queries'
import type { TransactionWithDetails } from '@/lib/transactions/types'
import { getRecurrenceLinkedTransactionIds } from '@/lib/recurrences/queries'
import {
  getAccounts,
  getAccountDetail,
  getInstitutions,
} from '@/lib/accounts/queries'
import { getAllCategories } from '@/lib/categories/queries'

// Thin server-action wrappers around the query functions, kept ONLY for the
// routes that have not yet migrated to direct browser→Supabase reads
// (web-data-access spec): /accounts/[id], /dashboard and /transactions/recurring.
// Each wrapper is deleted as soon as its last consumer migrates. Do not add
// new read wrappers — new reads call the query functions directly with the
// browser client.

export async function getMovementFilterOptionsAction(
  options: { categoryId?: string } = {},
): Promise<Awaited<ReturnType<typeof getMovementFilterOptions>>> {
  await getAuthenticatedUserId()
  return getMovementFilterOptions(await createClient(), options)
}

export async function getMonthCategoryBreakdownAction(
  month: string,
): Promise<MonthCategoryBreakdown> {
  await getAuthenticatedUserId()
  return getMonthCategoryBreakdown(await createClient(), month)
}

export async function getPendingReimbursementsAction(
  accountId?: string,
): Promise<Awaited<ReturnType<typeof getPendingReimbursements>>> {
  await getAuthenticatedUserId()
  return getPendingReimbursements(await createClient(), accountId)
}

export async function getRecurrenceLinkedTransactionIdsAction(
  txIds: string[],
): Promise<Awaited<ReturnType<typeof getRecurrenceLinkedTransactionIds>>> {
  await getAuthenticatedUserId()
  return getRecurrenceLinkedTransactionIds(await createClient(), txIds)
}

export async function getAccountsAction(): Promise<
  Awaited<ReturnType<typeof getAccounts>>
> {
  await getAuthenticatedUserId()
  return getAccounts(await createClient())
}

export async function getAllCategoriesAction(): Promise<
  Awaited<ReturnType<typeof getAllCategories>>
> {
  await getAuthenticatedUserId()
  return getAllCategories(await createClient())
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
  return getAccountDetail(await createClient(), id)
}

export async function getAccountMovementsAscendingAction(
  accountId: string,
): Promise<TransactionWithDetails[]> {
  await getAuthenticatedUserId()
  return getAccountMovementsAscending(await createClient(), accountId)
}

export async function getInstitutionsAction(): Promise<
  Awaited<ReturnType<typeof getInstitutions>>
> {
  await getAuthenticatedUserId()
  return getInstitutions(await createClient())
}
