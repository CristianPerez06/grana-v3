'use server'

import { createClient } from '@/lib/supabase/server'
import { getTodayAR } from '@/lib/date'
import type {
  CreateAccountInput,
  UpdateAccountInput,
  AddCurrencyInput,
} from '@grana/validation'
import {
  createAccount as createAccountImpl,
  updateAccount as updateAccountImpl,
  archiveAccount as archiveAccountImpl,
  reactivateAccount as reactivateAccountImpl,
  deleteAccount as deleteAccountImpl,
  addCurrencyToAccount as addCurrencyToAccountImpl,
  deactivateCurrencyFromAccount as deactivateCurrencyFromAccountImpl,
  type AccountMutationResult,
} from '@grana/accounts'
import type { ActionResult } from './types'
import { translatePostgresError } from './_lib/translate-error'
import { getAuthenticatedUserId } from './_lib/auth'
import { revalidateAfterAccountMutation } from './_helpers'

// The mutation logic lives in `@grana/accounts` so mobile can reuse it. These
// wrappers are the web platform shell: resolve the authenticated user, build the
// server client, inject `today`, then map the package's neutral result to
// `ActionResult` — translating raw Postgres error codes to user-facing messages
// (web i18n) — and revalidate on success.
async function finish<T>(
  result: AccountMutationResult<T>,
): Promise<ActionResult<T> & { id?: string; reason?: string }> {
  if (result.ok) {
    revalidateAfterAccountMutation()
    return { ok: true, id: result.id }
  }
  const formError =
    result.formError ??
    (result.errorCode != null ? await translatePostgresError(result.errorCode, 'account') : undefined)
  return {
    ok: false,
    fieldErrors: result.fieldErrors,
    formError,
    reason: result.reason,
  }
}

// ── createAccount ─────────────────────────────────────────────────────────────

export async function createAccount(
  input: unknown,
): Promise<ActionResult<CreateAccountInput> & { id?: string }> {
  const userId = await getAuthenticatedUserId()
  const supabase = await createClient()
  return finish(await createAccountImpl({ supabase, userId, input, today: getTodayAR() }))
}

// ── updateAccount ─────────────────────────────────────────────────────────────

export async function updateAccount(
  id: string,
  input: unknown,
): Promise<ActionResult<UpdateAccountInput>> {
  const userId = await getAuthenticatedUserId()
  const supabase = await createClient()
  return finish(await updateAccountImpl({ supabase, userId, id, input }))
}

// ── archiveAccount ────────────────────────────────────────────────────────────

export async function archiveAccount(
  id: string,
): Promise<ActionResult<never> & { reason?: string }> {
  const userId = await getAuthenticatedUserId()
  const supabase = await createClient()
  return finish(await archiveAccountImpl({ supabase, userId, id, today: getTodayAR() }))
}

// ── reactivateAccount ─────────────────────────────────────────────────────────

export async function reactivateAccount(id: string): Promise<ActionResult<never>> {
  const userId = await getAuthenticatedUserId()
  const supabase = await createClient()
  return finish(await reactivateAccountImpl({ supabase, userId, id }))
}

// ── deleteAccount ─────────────────────────────────────────────────────────────

export async function deleteAccount(id: string): Promise<ActionResult<never>> {
  const userId = await getAuthenticatedUserId()
  const supabase = await createClient()
  return finish(await deleteAccountImpl({ supabase, userId, id }))
}

// ── addCurrencyToAccount ──────────────────────────────────────────────────────

export async function addCurrencyToAccount(
  accountId: string,
  input: unknown,
): Promise<ActionResult<AddCurrencyInput>> {
  const userId = await getAuthenticatedUserId()
  const supabase = await createClient()
  return finish(await addCurrencyToAccountImpl({ supabase, userId, accountId, input, today: getTodayAR() }))
}

// ── deactivateCurrencyFromAccount ─────────────────────────────────────────────

export async function deactivateCurrencyFromAccount(
  accountId: string,
  currencyCode: 'ARS' | 'USD',
): Promise<ActionResult<never>> {
  const userId = await getAuthenticatedUserId()
  const supabase = await createClient()
  return finish(await deactivateCurrencyFromAccountImpl({ supabase, userId, accountId, currencyCode }))
}
