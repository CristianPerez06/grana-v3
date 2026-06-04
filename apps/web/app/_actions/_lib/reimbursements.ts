// Web wrapper around `@grana/transactions-mutations`'s
// `insertDeclaredReimbursement`. The package helper is platform-neutral and
// requires `today: Date` as a param; this wrapper injects `getTodayAR()` so
// existing web callers keep their signature.
import type { createClient } from '@/lib/supabase/server'
import type { ReimbursementDeclarationInput } from '@grana/validation'
import { getTodayAR } from '@/lib/date'
import {
  insertDeclaredReimbursement as insertDeclaredReimbursementImpl,
  type SharedSplitSpec,
} from '@grana/transactions-mutations'

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

export async function insertDeclaredReimbursement(
  supabase: SupabaseClient,
  params: {
    userId: string
    expenseId: string
    currencyCode: string
    declaration: ReimbursementDeclarationInput
    shared?: SharedSplitSpec
  },
): Promise<{ ok: true } | { ok: false; error: string }> {
  return insertDeclaredReimbursementImpl(supabase, { ...params, today: getTodayAR() })
}
