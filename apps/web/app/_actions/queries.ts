'use server'

import { createClient } from '@/lib/supabase/server'
import { getAuthenticatedUserId } from './_lib/auth'
import { getAccounts } from '@/lib/accounts/queries'
import { getAllCategories } from '@/lib/categories/queries'

// Thin server-action wrappers around the query functions, kept ONLY for the
// routes that have not yet migrated to direct browser→Supabase reads
// (web-data-access spec): /transactions/recurring. Each wrapper is deleted as
// soon as its last consumer migrates. Do not add new read wrappers — new reads
// call the query functions directly with the browser client.

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
