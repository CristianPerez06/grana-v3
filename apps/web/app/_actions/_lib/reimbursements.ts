import type { createClient } from '@/lib/supabase/server'
import { normalizeMoneyAmount, type ReimbursementDeclarationInput } from '@grana/validation'
import { formatDateISO, getTodayAR } from '@/lib/date'

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

/**
 * Inserts a reimbursement declared while registering an expense, linked to the
 * just-created expense. Used by the expense-creation actions inside the same
 * call so the pair is created together (the caller rolls back the expense if
 * this fails — see design.md Decisión 9).
 *
 * - pending  (`received_now` false): `amount` = estimate, `received_at` = null.
 *   The PENDING amount is an estimate and never enters any calculation.
 * - received (`received_now` true):  `amount` = real (defaults to the estimate),
 *   `received_at` = now.
 *
 * Link integrity (linked is an expense of the same user; statement requires a
 * credit card; statement+received requires a period) is enforced by the DB
 * trigger `trg_fn_reimbursement_invariants`.
 */
export async function insertDeclaredReimbursement(
  supabase: SupabaseClient,
  params: {
    userId: string
    expenseId: string
    currencyCode: string
    declaration: ReimbursementDeclarationInput
  },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { userId, expenseId, currencyCode, declaration: d } = params

  const estimated = normalizeMoneyAmount(d.estimated_amount) ?? d.estimated_amount
  const receivedNow = d.received_now === true
  const amount = receivedNow
    ? normalizeMoneyAmount(d.amount ?? d.estimated_amount) ?? d.estimated_amount
    : estimated
  const date = d.date ?? formatDateISO(getTodayAR())

  const { error } = await supabase.from('transactions').insert({
    user_id: userId,
    account_id: d.account_id,
    type: 'reimbursement',
    amount,
    currency_code: currencyCode,
    date,
    linked_transaction_id: expenseId,
    reimbursement_target: d.target,
    estimated_amount: estimated,
    received_at: receivedNow ? new Date().toISOString() : null,
    card_period_id: d.target === 'statement' ? d.card_period_id ?? null : null,
    description: d.description ?? null,
  })

  if (error) return { ok: false, error: error.message }
  return { ok: true }
}
