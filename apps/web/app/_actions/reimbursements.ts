'use server'

import { revalidateAfterReimbursementMutation } from './_helpers'
import { createClient } from '@/lib/supabase/server'
import {
  type ConfirmReimbursementInput,
  type CancelReimbursementInput,
  type SaveExpenseReimbursementInput,
} from '@grana/validation'
import {
  saveExpenseReimbursement as saveExpenseReimbursementOrchestrator,
  confirmReimbursement as confirmReimbursementImpl,
  cancelReimbursement as cancelReimbursementImpl,
} from '@grana/transactions-mutations'
import type { ActionResult } from './types'
import { getAuthenticatedUserId } from './_lib/auth'
import { getTodayAR } from '@/lib/date'

// Use shared `revalidateAfterReimbursementMutation` directly at the callsite.

// ── saveExpenseReimbursement (add / edit / remove from the edit form) ────────────

/**
 * Shell for the edit-form reintegro CRUD: auth + client + orchestrator +
 * revalidate. `patch` carries the optional `reimbursement` declaration (absent ⇒
 * remove the pending one) and the expense's resulting `shared` spec (so the
 * reintegro inherits the split). The orchestrator lives in
 * `@grana/transactions-mutations` and does the state reconciliation.
 */
export async function saveExpenseReimbursement(
  id: string,
  patch: unknown,
): Promise<ActionResult<SaveExpenseReimbursementInput>> {
  const userId = await getAuthenticatedUserId()
  const supabase = await createClient()

  const input = { expense_id: id, ...(patch as Record<string, unknown>) }
  const result = await saveExpenseReimbursementOrchestrator({
    supabase,
    userId,
    input,
    today: getTodayAR(),
  })

  if (result.ok) revalidateAfterReimbursementMutation()
  return result
}

// ── confirmReimbursement (reconcile) ────────────────────────────────────────────

/**
 * Confirms a pending reimbursement as received, RECONCILING it: the real amount,
 * the real date, and the destination (cash account for 'account', or the card
 * period where it landed for 'statement') may differ from what was declared.
 * `estimated_amount` is immutable (enforced by the DB trigger). Thin wrapper:
 * the reconcile logic lives in `@grana/transactions-mutations`; this shell
 * resolves auth and revalidates.
 */
export async function confirmReimbursement(
  input: unknown,
): Promise<ActionResult<ConfirmReimbursementInput>> {
  const userId = await getAuthenticatedUserId()
  const supabase = await createClient()

  const result = await confirmReimbursementImpl(supabase, userId, input, getTodayAR())
  if (result.ok) revalidateAfterReimbursementMutation()
  return result
}

// ── cancelReimbursement ─────────────────────────────────────────────────────────

/**
 * Cancels a pending reimbursement that never arrived (sets `cancelled_at`), so
 * it stops showing as expected. A received reimbursement cannot be cancelled
 * (received and cancelled are mutually exclusive — see chk_reimbursement_state).
 * Thin wrapper over the shared mutator.
 */
export async function cancelReimbursement(
  input: unknown,
): Promise<ActionResult<CancelReimbursementInput>> {
  const userId = await getAuthenticatedUserId()
  const supabase = await createClient()

  const result = await cancelReimbursementImpl(supabase, userId, input)
  if (result.ok) revalidateAfterReimbursementMutation()
  return result
}
