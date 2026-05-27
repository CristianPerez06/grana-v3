'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import {
  confirmReimbursementSchema,
  cancelReimbursementSchema,
  validateActionInput,
  normalizeMoneyAmount,
  type ConfirmReimbursementInput,
  type CancelReimbursementInput,
} from '@grana/validation'
import type { ActionResult } from './types'
import { getAuthenticatedUserId } from './_lib/auth'
import { getOrCreatePeriodForDate } from '@/lib/cards/queries'

function revalidateReimbursementPaths() {
  revalidatePath('/transactions')
  revalidatePath('/accounts')
  revalidatePath('/cards')
}

// ── confirmReimbursement (reconcile) ────────────────────────────────────────────

/**
 * Confirms a pending reimbursement as received, RECONCILING it: the real amount,
 * the real date, and the destination (cash account for 'account', or the card
 * period where it landed for 'statement') may differ from what was declared.
 * `estimated_amount` is immutable (enforced by the DB trigger).
 */
export async function confirmReimbursement(
  input: unknown,
): Promise<ActionResult<ConfirmReimbursementInput>> {
  const validation = await validateActionInput(confirmReimbursementSchema, input)
  if (!validation.ok) return { ok: false, fieldErrors: validation.fieldErrors }

  const userId = await getAuthenticatedUserId()
  const supabase = await createClient()
  const d = validation.data

  const { data: row, error: fetchErr } = await supabase
    .from('transactions')
    .select('id, type, reimbursement_target, received_at, cancelled_at, account_id')
    .eq('id', d.id)
    .eq('user_id', userId)
    .single()

  if (fetchErr || !row) return { ok: false, formError: 'Reintegro no encontrado.' }
  if (row.type !== 'reimbursement') return { ok: false, formError: 'El movimiento no es un reintegro.' }
  if (row.cancelled_at) return { ok: false, formError: 'El reintegro fue cancelado.' }
  if (row.received_at) return { ok: false, formError: 'El reintegro ya fue confirmado.' }

  const update: {
    received_at: string
    amount: number
    date: string
    account_id?: string
    card_period_id?: string
  } = {
    received_at: new Date().toISOString(),
    amount: normalizeMoneyAmount(d.amount) ?? d.amount,
    date: d.date,
  }

  if (row.reimbursement_target === 'account') {
    if (d.account_id) update.account_id = d.account_id
  } else {
    // statement: the card period is the one covering `date` — which defaults to
    // the consumption date and the user may change. Resolve it and ensure it is
    // not already paid.
    if (!row.account_id) {
      return { ok: false, formError: 'El reintegro no tiene una tarjeta asociada.' }
    }
    let periodId: string
    try {
      periodId = await getOrCreatePeriodForDate(row.account_id, d.date)
    } catch {
      return {
        ok: false,
        formError: 'No se pudo determinar el período de la tarjeta para esa fecha.',
      }
    }
    const { data: payment } = await supabase
      .from('period_payments')
      .select('id')
      .eq('period_id', periodId)
      .maybeSingle()
    if (payment) {
      return {
        ok: false,
        formError: 'Ese resumen ya fue pagado. Elegí una fecha de un período no pagado.',
      }
    }
    update.card_period_id = periodId
  }

  const { error } = await supabase
    .from('transactions')
    .update(update)
    .eq('id', d.id)
    .eq('user_id', userId)

  if (error) return { ok: false, formError: error.message }

  revalidateReimbursementPaths()
  return { ok: true }
}

// ── cancelReimbursement ─────────────────────────────────────────────────────────

/**
 * Cancels a pending reimbursement that never arrived (sets `cancelled_at`), so
 * it stops showing as expected. A received reimbursement cannot be cancelled
 * (received and cancelled are mutually exclusive — see chk_reimbursement_state).
 */
export async function cancelReimbursement(
  input: unknown,
): Promise<ActionResult<CancelReimbursementInput>> {
  const validation = await validateActionInput(cancelReimbursementSchema, input)
  if (!validation.ok) return { ok: false, fieldErrors: validation.fieldErrors }

  const userId = await getAuthenticatedUserId()
  const supabase = await createClient()
  const { id } = validation.data

  const { data: row, error: fetchErr } = await supabase
    .from('transactions')
    .select('id, type, received_at, cancelled_at')
    .eq('id', id)
    .eq('user_id', userId)
    .single()

  if (fetchErr || !row) return { ok: false, formError: 'Reintegro no encontrado.' }
  if (row.type !== 'reimbursement') return { ok: false, formError: 'El movimiento no es un reintegro.' }
  if (row.received_at) return { ok: false, formError: 'No se puede cancelar un reintegro ya recibido.' }
  if (row.cancelled_at) return { ok: true } // already cancelled — idempotent

  const { error } = await supabase
    .from('transactions')
    .update({ cancelled_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', userId)

  if (error) return { ok: false, formError: error.message }

  revalidateReimbursementPaths()
  return { ok: true }
}
