import type { QueryClient } from '@tanstack/react-query'
import {
  createCreditCard as createCreditCardMutation,
  updateCreditCard as updateCreditCardMutation,
  updatePeriodDates as updatePeriodDatesMutation,
  payCardPeriod as payCardPeriodMutation,
  type CardMutationResult,
} from '@grana/cards'
import {
  archiveAccount as archiveAccountMutation,
  reactivateAccount as reactivateAccountMutation,
  deleteAccount as deleteAccountMutation,
  type AccountMutationResult,
} from '@grana/accounts'
import { getTodayAR } from '@grana/money-logic'
import { supabase } from '../supabase'
import { invalidateAfterCardMutation, invalidateAfterCardPayment } from './invalidation'

// Native analogue of the web shell `createCreditCard` in
// `apps/web/app/_actions/credit-cards.ts`. No 'use server': screens call this
// directly. It resolves the userId, injects `today`, calls the SAME `@grana/cards`
// mutation the web shell calls, maps the neutral result to a native `ActionResult`,
// and on success invalidates the affected query keys. The lib never translates —
// `errorKey` is a catalog path the screen resolves with `useT`; `fieldErrors` are
// already-localized yup strings passed through.

export type ActionResult =
  | { ok: true; id?: string }
  | {
      ok: false
      errorKey: string
      fieldErrors?: Record<string, string>
      /** Structured slug (e.g. `pending_debt`) to branch UX, independent of text. */
      reason?: string
    }

// Same mapping as web's translatePostgresError for the `card` kind.
function mapPostgresError(code: string | undefined): string {
  if (code === '23505') return 'cards.errors.duplicate'
  return 'cards.errors.generic'
}

function mapResult(
  result: CardMutationResult,
  fallbackKey = 'cards.errors.generic',
): ActionResult {
  if (result.ok) return { ok: true, id: result.id }
  if (result.fieldErrors) {
    return {
      ok: false,
      errorKey: fallbackKey,
      fieldErrors: result.fieldErrors as Record<string, string>,
    }
  }
  if (result.messageKey) return { ok: false, errorKey: result.messageKey }
  if (result.errorCode) return { ok: false, errorKey: mapPostgresError(result.errorCode) }
  return { ok: false, errorKey: fallbackKey }
}

// Archive/reactivate/delete delegate to the shared account mutations, whose result
// carries the structured `reason` slug (`pending_debt`) that the edit screen needs
// to branch to the block dialog — so map it through distinctly.
function mapAccountResult<T>(result: AccountMutationResult<T>): ActionResult {
  if (result.ok) return { ok: true, id: result.id }
  const reason = result.reason ? { reason: result.reason } : {}
  if (result.messageKey) return { ok: false, errorKey: result.messageKey, ...reason }
  if (result.errorCode)
    return { ok: false, errorKey: mapPostgresError(result.errorCode), ...reason }
  return { ok: false, errorKey: 'cards.errors.generic', ...reason }
}

async function requireUserId(): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')
  return user.id
}

export async function createCreditCard(
  queryClient: QueryClient,
  input: unknown,
): Promise<ActionResult> {
  const userId = await requireUserId()
  const result = mapResult(
    await createCreditCardMutation({ supabase, userId, input, today: getTodayAR() }),
    'cards.errors.create_failed',
  )
  if (result.ok) invalidateAfterCardMutation(queryClient)
  return result
}

// ── Edit card (name / bank / limit) + cycle dates ────────────────────────────────

export async function updateCreditCard(
  queryClient: QueryClient,
  id: string,
  input: unknown,
): Promise<ActionResult> {
  const userId = await requireUserId()
  const result = mapResult(await updateCreditCardMutation({ supabase, userId, id, input }))
  if (result.ok) invalidateAfterCardMutation(queryClient)
  return result
}

export async function updatePeriodDates(
  queryClient: QueryClient,
  periodId: string,
  input: unknown,
): Promise<ActionResult> {
  const userId = await requireUserId()
  const result = mapResult(await updatePeriodDatesMutation({ supabase, userId, periodId, input }))
  if (result.ok) invalidateAfterCardPayment(queryClient)
  return result
}

// ── Pay a statement ──────────────────────────────────────────────────────────────
// The screen only assembles the `PayCardPeriodInput`; all tax/FX/next-period logic
// lives inside the shared `payCardPeriod`. On success the payment shifts balances
// and the feed, so invalidate the wider set.

export async function payCardPeriod(
  queryClient: QueryClient,
  input: unknown,
): Promise<ActionResult> {
  const userId = await requireUserId()
  const result = mapResult(
    await payCardPeriodMutation({ supabase, userId, input, today: getTodayAR() }),
  )
  if (result.ok) invalidateAfterCardPayment(queryClient)
  return result
}

// ── Archive / reactivate / delete (a card is an account) ─────────────────────────
// Delegate to the shared `@grana/accounts` mutations, which enforce the
// `type==='credit'` pending-debt guard. `archiveCard` surfaces the `pending_debt`
// reason so the edit screen can show the block dialog.

export async function archiveCard(queryClient: QueryClient, id: string): Promise<ActionResult> {
  const userId = await requireUserId()
  const result = mapAccountResult(
    await archiveAccountMutation({ supabase, userId, id, today: getTodayAR() }),
  )
  if (result.ok) invalidateAfterCardMutation(queryClient)
  return result
}

export async function reactivateCard(queryClient: QueryClient, id: string): Promise<ActionResult> {
  const userId = await requireUserId()
  const result = mapAccountResult(await reactivateAccountMutation({ supabase, userId, id }))
  if (result.ok) invalidateAfterCardMutation(queryClient)
  return result
}

export async function deleteCard(queryClient: QueryClient, id: string): Promise<ActionResult> {
  const userId = await requireUserId()
  const result = mapAccountResult(await deleteAccountMutation({ supabase, userId, id }))
  if (result.ok) invalidateAfterCardMutation(queryClient)
  return result
}
