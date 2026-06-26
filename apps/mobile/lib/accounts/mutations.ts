import type { QueryClient } from '@tanstack/react-query'
import {
  createAccount as createAccountMutation,
  updateAccount as updateAccountMutation,
  archiveAccount as archiveAccountMutation,
  reactivateAccount as reactivateAccountMutation,
  deleteAccount as deleteAccountMutation,
  addCurrencyToAccount as addCurrencyMutation,
  deactivateCurrencyFromAccount as deactivateCurrencyMutation,
  type AccountMutationResult,
  type Institution,
} from '@grana/accounts'
import { getTodayAR } from '@grana/money-logic'
import { createCustomInstitutionSchema, validateActionInput } from '@grana/validation'
import { supabase } from '../supabase'
import { invalidateAfterAccountMutation } from './invalidation'

// Native analogue of the web shell `apps/web/app/_actions/accounts.ts`. There is
// no 'use server' here: the screens call these directly. Each wrapper resolves
// the userId, injects `today`, calls the SAME `@grana/accounts` mutation the web
// shell calls, maps the neutral result to a native `ActionResult`, and on success
// invalidates the affected query keys. The lib never translates — `errorKey` is a
// catalog path the screen resolves with `useT`; `fieldErrors` are already-localized
// yup strings passed through.

export type ActionResult =
  | { ok: true; id?: string }
  | {
      ok: false
      errorKey: string
      fieldErrors?: Record<string, string>
      /** Structured slug (e.g. `pending_debt`) to branch UX, independent of text. */
      reason?: string
    }

// Same mapping as web's translatePostgresError for the `account` kind.
function mapPostgresError(code: string | undefined): string {
  if (code === '23505') return 'accounts.errors.duplicate'
  return 'accounts.errors.generic'
}

function mapResult<T>(result: AccountMutationResult<T>): ActionResult {
  if (result.ok) return { ok: true, id: result.id }
  const reason = result.reason ? { reason: result.reason } : {}
  if (result.fieldErrors) {
    return {
      ok: false,
      errorKey: 'accounts.errors.generic',
      fieldErrors: result.fieldErrors as Record<string, string>,
      ...reason,
    }
  }
  if (result.messageKey) return { ok: false, errorKey: result.messageKey, ...reason }
  if (result.errorCode) return { ok: false, errorKey: mapPostgresError(result.errorCode), ...reason }
  return { ok: false, errorKey: 'accounts.errors.generic', ...reason }
}

async function requireUserId(): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')
  return user.id
}

// ── Account mutations ──────────────────────────────────────────────────────────

export async function createAccount(
  queryClient: QueryClient,
  input: unknown,
): Promise<ActionResult> {
  const userId = await requireUserId()
  const result = mapResult(
    await createAccountMutation({ supabase, userId, input, today: getTodayAR() }),
  )
  if (result.ok) invalidateAfterAccountMutation(queryClient, result.id)
  return result
}

export async function updateAccount(
  queryClient: QueryClient,
  id: string,
  input: unknown,
): Promise<ActionResult> {
  const userId = await requireUserId()
  const result = mapResult(await updateAccountMutation({ supabase, userId, id, input }))
  if (result.ok) invalidateAfterAccountMutation(queryClient, id)
  return result
}

export async function archiveAccount(
  queryClient: QueryClient,
  id: string,
): Promise<ActionResult> {
  const userId = await requireUserId()
  const result = mapResult(
    await archiveAccountMutation({ supabase, userId, id, today: getTodayAR() }),
  )
  if (result.ok) invalidateAfterAccountMutation(queryClient, id)
  return result
}

export async function reactivateAccount(
  queryClient: QueryClient,
  id: string,
): Promise<ActionResult> {
  const userId = await requireUserId()
  const result = mapResult(await reactivateAccountMutation({ supabase, userId, id }))
  if (result.ok) invalidateAfterAccountMutation(queryClient, id)
  return result
}

export async function deleteAccount(
  queryClient: QueryClient,
  id: string,
): Promise<ActionResult> {
  const userId = await requireUserId()
  const result = mapResult(await deleteAccountMutation({ supabase, userId, id }))
  if (result.ok) invalidateAfterAccountMutation(queryClient)
  return result
}

export async function addCurrencyToAccount(
  queryClient: QueryClient,
  accountId: string,
  input: unknown,
): Promise<ActionResult> {
  const userId = await requireUserId()
  const result = mapResult(
    await addCurrencyMutation({ supabase, userId, accountId, input, today: getTodayAR() }),
  )
  if (result.ok) invalidateAfterAccountMutation(queryClient, accountId)
  return result
}

export async function deactivateCurrencyFromAccount(
  queryClient: QueryClient,
  accountId: string,
  currencyCode: 'ARS' | 'USD',
): Promise<ActionResult> {
  const userId = await requireUserId()
  const result = mapResult(
    await deactivateCurrencyMutation({ supabase, userId, accountId, currencyCode }),
  )
  if (result.ok) invalidateAfterAccountMutation(queryClient, accountId)
  return result
}

// ── Custom institution ─────────────────────────────────────────────────────────
// Not in @grana/accounts (web keeps it as a server action), so the native side
// reimplements the insert. Mirror of apps/web/app/_actions/institutions.ts.

export type CreateInstitutionResult =
  | { ok: true; institution: Institution }
  | { ok: false; errorKey: string; fieldErrors?: Record<string, string> }

export async function createCustomInstitution(
  queryClient: QueryClient,
  input: unknown,
): Promise<CreateInstitutionResult> {
  const validation = await validateActionInput(createCustomInstitutionSchema, input)
  if (!validation.ok) {
    return {
      ok: false,
      errorKey: 'accounts.customInstitution.errors.create_failed',
      fieldErrors: validation.fieldErrors as Record<string, string>,
    }
  }

  const userId = await requireUserId()

  // slug is NOT NULL in the table; a DB trigger re-derives it for user rows, so
  // this value is overwritten server-side — we pass one only to keep the insert valid.
  const slug = validation.data.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  const { data, error } = await supabase
    .from('institutions')
    .insert({
      name: validation.data.name,
      slug,
      brand_color: validation.data.brand_color,
      icon_type: validation.data.icon_type,
      user_id: userId,
    })
    .select('id, name, slug, brand_color, icon_type, is_active, user_id')
    .single()

  if (error || !data) {
    if (error?.code === '23505') {
      return { ok: false, errorKey: 'accounts.customInstitution.errors.duplicate' }
    }
    return { ok: false, errorKey: 'accounts.customInstitution.errors.create_failed' }
  }

  invalidateAfterAccountMutation(queryClient)
  return { ok: true, institution: data as Institution }
}
