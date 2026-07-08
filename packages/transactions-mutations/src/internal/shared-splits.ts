import type { GranaSupabaseClient } from '@grana/supabase'
import { Money } from '@grana/validation'
import { splitAmountByPercentages } from '@grana/money-logic'

export type SharedSplitSpec = {
  household_id: string
  splits: { user_id: string; percentage: number }[]
}

/** A movement to mark shared, with the base amount used to compute the split. */
export type SharedTarget = { transactionId: string; amount: number }

/**
 * Mark the given movements as shared and insert their per-member splits. Reused
 * by the expense paths (cash/debit single, and — for installments — the child
 * cuotas) and by shared reimbursements (which inherit the origin's percentages).
 *
 * Pure split math comes from `splitAmountByPercentages` (residue to the first
 * part, exact sum). RLS enforces household membership and own-transaction writes.
 */
export async function applySharedSplits(
  supabase: GranaSupabaseClient,
  spec: SharedSplitSpec,
  targets: SharedTarget[],
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (targets.length === 0) return { ok: true }

  const ids = targets.map((t) => t.transactionId)
  const { error: markError } = await supabase
    .from('transactions')
    .update({ is_shared: true, household_id: spec.household_id })
    .in('id', ids)
  if (markError) return { ok: false, error: markError.message }

  const userIds = spec.splits.map((s) => s.user_id)
  const percentages = spec.splits.map((s) => s.percentage)

  const rows = targets.flatMap((t) => {
    const parts = splitAmountByPercentages(t.amount, percentages)
    return parts.map((part, i) => ({
      transaction_id: t.transactionId,
      household_id: spec.household_id,
      user_id: userIds[i],
      percentage: percentages[i],
      amount_assigned: Money.toNumber(part),
    }))
  })

  // Upsert (not insert) so re-applying a split on an existing shared movement
  // updates its rows in place. A delete-then-insert would transiently zero the
  // per-transaction sum, tripping the deferred `trg_splits_sum_total` invariant;
  // the member set is stable (2 rows per transaction), so the `(transaction_id,
  // user_id)` keys already exist on an edit and the sum stays exact throughout.
  const { error: splitError } = await supabase
    .from('shared_expense_split')
    .upsert(rows, { onConflict: 'transaction_id,user_id' })
  if (splitError) return { ok: false, error: splitError.message }

  return { ok: true }
}
