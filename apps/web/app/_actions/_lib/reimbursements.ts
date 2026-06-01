import type { createClient } from '@/lib/supabase/server'
import { normalizeMoneyAmount, type ReimbursementDeclarationInput } from '@grana/validation'
import { formatDateISO, getTodayAR } from '@/lib/date'
import { applySharedSplits, type SharedSplitSpec } from './shared-splits'

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
    /** When the origin expense is shared, the reimbursement inherits the split. */
    shared?: SharedSplitSpec
  },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { userId, expenseId, currencyCode, declaration: d, shared } = params

  const estimated = normalizeMoneyAmount(d.estimated_amount) ?? d.estimated_amount
  const receivedNow = d.received_now === true
  const amount = receivedNow
    ? normalizeMoneyAmount(d.amount ?? d.estimated_amount) ?? d.estimated_amount
    : estimated
  const date = d.date ?? formatDateISO(getTodayAR())

  const { data: reimbursement, error } = await supabase
    .from('transactions')
    .insert({
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
    .select('id')
    .single()

  if (error || !reimbursement) return { ok: false, error: error?.message ?? 'reimbursement insert failed' }

  // Shared expense → the reimbursement inherits the same split (the debt formula
  // subtracts it once received). Splits on a pending reimbursement are harmless:
  // getHouseholdDebt only counts received ones.
  if (shared) {
    const s = await applySharedSplits(supabase, shared, [
      { transactionId: reimbursement.id, amount },
    ])
    if (!s.ok) {
      await supabase.from('transactions').delete().eq('id', reimbursement.id).eq('user_id', userId)
      return { ok: false, error: s.error }
    }
  }

  return { ok: true }
}
