'use server'

import { revalidatePath } from 'next/cache'
import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { getTodayAR } from '@/lib/date'
import type {
  CreateCreditCardInput,
  RegisterCardPurchaseInput,
  RegisterInstallmentsInput,
  PayCardPeriodInput,
  UpdatePeriodDatesInput,
} from '@grana/validation'
import {
  createCreditCard as createCreditCardMutation,
  payCardPeriod as payCardPeriodMutation,
  updatePeriodDates as updatePeriodDatesMutation,
  updateCreditCard as updateCreditCardMutation,
  updateInstallmentParent as updateInstallmentParentMutation,
  deleteInstallmentParent as deleteInstallmentParentMutation,
  revertCardPeriodPayment as revertCardPeriodPaymentMutation,
  type CardMutationResult,
  type RevertPaymentSummary,
} from '@grana/cards'
import { archiveAccount } from '@grana/accounts'
import {
  registerInstallments as registerInstallmentsOrchestrator,
  registerCardPurchase as registerCardPurchaseOrchestrator,
} from '@grana/transactions-mutations'
import type { ActionResult } from './types'
import { translatePostgresError } from './_lib/translate-error'
import { getAuthenticatedUserId } from './_lib/auth'
import { revalidateAfterMovementMutation } from './_helpers'

/**
 * Map a neutral `CardMutationResult` from `@grana/cards` to the web `ActionResult`:
 * field errors pass through, a raw Postgres `errorCode` is translated by kind, and
 * a `messageKey` is resolved with next-intl (with its interpolation params). Same
 * precedence as `createCreditCard` (errorCode before messageKey).
 */
async function toCardActionResult<T>(result: CardMutationResult<T>): Promise<ActionResult<T>> {
  if (result.ok) return { ok: true }
  if (result.fieldErrors) return { ok: false, fieldErrors: result.fieldErrors }
  if (result.errorCode) {
    return {
      ok: false,
      errorCode: result.errorCode,
      formError: await translatePostgresError(result.errorCode, 'card'),
    }
  }
  const t = await getTranslations()
  return {
    ok: false,
    formError: result.messageKey
      ? t(result.messageKey, result.messageParams)
      : await translatePostgresError(undefined, 'card'),
  }
}

// ── createCreditCard (2 fechas: resumen actual; el siguiente nace estimado) ─

export async function createCreditCard(
  input: unknown,
): Promise<ActionResult<CreateCreditCardInput> & { id?: string }> {
  // Thin shell over the shared `@grana/cards` mutation: this layer only resolves
  // auth + supabase, translates the neutral result for the web user, and
  // revalidates the affected route trees. The orchestration (account + currencies
  // + 2 periods, name derivation, rollback) lives in the package so mobile reuses it.
  const userId = await getAuthenticatedUserId()
  const supabase = await createClient()

  const result = await createCreditCardMutation({
    supabase,
    userId,
    input,
    today: getTodayAR(),
  })

  if (!result.ok) {
    if (result.fieldErrors) return { ok: false, fieldErrors: result.fieldErrors }
    if (result.errorCode) {
      return {
        ok: false,
        errorCode: result.errorCode,
        formError: await translatePostgresError(result.errorCode, 'card'),
      }
    }
    const t = await getTranslations()
    return {
      ok: false,
      formError: result.messageKey ? t(result.messageKey) : await translatePostgresError(undefined, 'card'),
    }
  }

  revalidatePath('/cards')
  revalidatePath('/accounts')
  return { ok: true, id: result.id }
}

// ── registerCardPurchase ──────────────────────────────────────────────────────

export async function registerCardPurchase(
  input: unknown,
): Promise<ActionResult<RegisterCardPurchaseInput> & { id?: string }> {
  const userId = await getAuthenticatedUserId()
  const supabase = await createClient()
  const result = await registerCardPurchaseOrchestrator({
    supabase,
    userId,
    input,
    today: getTodayAR(),
  })
  if (result.ok) {
    revalidatePath('/cards')
    revalidatePath('/transactions')
    revalidatePath('/shared')
  }
  return result
}

// ── registerInstallments ──────────────────────────────────────────────────────
// Shell: auth + client + orchestrator + revalidate. The orchestration (split,
// period assignment, parent+children fan-out, rollback dance) lives in
// `@grana/transactions-mutations` so mobile can reuse it intact.

export async function registerInstallments(
  input: unknown,
): Promise<ActionResult<RegisterInstallmentsInput> & { parentId?: string }> {
  const userId = await getAuthenticatedUserId()
  const supabase = await createClient()
  const result = await registerInstallmentsOrchestrator({
    supabase,
    userId,
    input,
    today: getTodayAR(),
  })
  if (result.ok) {
    revalidatePath('/cards')
    revalidatePath('/transactions')
    revalidatePath('/shared')
  }
  return result
}

// ── payCardPeriod ─────────────────────────────────────────────────────────────
// Shell over `@grana/cards.payCardPeriod`: the payment legs, stamp tax and
// running-cycle confirmation live in the package (shared with mobile). This
// layer resolves auth + client, maps the neutral result, and revalidates.

export async function payCardPeriod(
  input: unknown,
): Promise<ActionResult<PayCardPeriodInput> & { expenseId?: string }> {
  const userId = await getAuthenticatedUserId()
  const supabase = await createClient()
  const result = await payCardPeriodMutation({ supabase, userId, input, today: getTodayAR() })
  if (!result.ok) return toCardActionResult(result)
  revalidatePath('/cards')
  revalidatePath('/transactions')
  return { ok: true, expenseId: result.expenseId }
}

// ── revertCardPeriodPayment ───────────────────────────────────────────────────
// Shell over `@grana/cards.revertCardPeriodPayment`: the whole reversal is one
// database transaction (RPC), so this layer only resolves the client, maps the
// neutral result and revalidates. Reverts the MONEY only — the dates the payment
// confirmed for the running cycle stay confirmed (see the change's design.md).

export async function revertCardPeriodPayment(
  periodId: string,
): Promise<ActionResult<never> & { summary?: RevertPaymentSummary }> {
  await getAuthenticatedUserId()
  const supabase = await createClient()
  const result = await revertCardPeriodPaymentMutation({ supabase, periodId })
  if (!result.ok) return toCardActionResult(result)
  // The reversal moves money back into an account, un-pays a statement and
  // deletes movements, so it touches every surface a movement mutation does.
  // `revalidatePath('/cards', 'layout')` inside the helper already covers the
  // nested period detail this is called from.
  revalidateAfterMovementMutation()
  return { ok: true, summary: result.summary }
}

// ── updatePeriodDates ─────────────────────────────────────────────────────────

export async function updatePeriodDates(
  periodId: string,
  input: unknown,
): Promise<ActionResult<UpdatePeriodDatesInput>> {
  const userId = await getAuthenticatedUserId()
  const supabase = await createClient()
  const result = await updatePeriodDatesMutation({ supabase, userId, periodId, input })
  if (!result.ok) return toCardActionResult(result)
  revalidatePath('/cards')
  return { ok: true }
}

// ── deactivateCreditCardAccount (archive vía @grana/accounts, R-tarjeta guard) ─
// A card IS an account: archive/reactivate flow through `@grana/accounts`, which
// already enforces the pending-debt guard for `type === 'credit'`. No duplicate
// guard here. The `pending_debt` result is surfaced verbatim so the card UI's
// block dialog keeps working.

export async function deactivateCreditCardAccount(
  accountId: string,
): Promise<ActionResult<never> & { reason?: string }> {
  const userId = await getAuthenticatedUserId()
  const supabase = await createClient()

  const result = await archiveAccount({ supabase, userId, id: accountId, today: getTodayAR() })

  if (!result.ok) {
    if (result.reason === 'pending_debt') {
      return { ok: false, formError: 'pending_debt', reason: 'pending_debt' }
    }
    if (result.errorCode) {
      return { ok: false, formError: await translatePostgresError(result.errorCode, 'card') }
    }
    const t = await getTranslations()
    return {
      ok: false,
      formError: result.messageKey ? t(result.messageKey) : await translatePostgresError(undefined, 'card'),
    }
  }

  revalidatePath('/cards')
  revalidatePath('/accounts')
  return { ok: true }
}

// ── updateCreditCard ──────────────────────────────────────────────────────────

export async function updateCreditCard(
  id: string,
  input: unknown,
): Promise<ActionResult<never>> {
  const userId = await getAuthenticatedUserId()
  const supabase = await createClient()
  const result = await updateCreditCardMutation({ supabase, userId, id, input })
  if (!result.ok) return toCardActionResult(result)
  revalidatePath('/cards')
  revalidatePath('/accounts')
  return { ok: true }
}

// ── updateInstallmentParent ───────────────────────────────────────────────────

export async function updateInstallmentParent(
  parentId: string,
  input: unknown,
): Promise<ActionResult<never>> {
  const userId = await getAuthenticatedUserId()
  const supabase = await createClient()
  const result = await updateInstallmentParentMutation({ supabase, userId, parentId, input })
  if (!result.ok) return toCardActionResult(result)
  if (result.sharedTouched) revalidatePath('/shared')
  revalidatePath('/transactions')
  revalidatePath('/cards')
  return { ok: true }
}

// ── deleteInstallmentParent ───────────────────────────────────────────────────

export async function deleteInstallmentParent(
  parentId: string,
): Promise<ActionResult<never>> {
  const userId = await getAuthenticatedUserId()
  const supabase = await createClient()
  const result = await deleteInstallmentParentMutation({ supabase, userId, parentId })
  if (!result.ok) return toCardActionResult(result)
  revalidatePath('/transactions')
  revalidatePath('/cards')
  return { ok: true }
}
