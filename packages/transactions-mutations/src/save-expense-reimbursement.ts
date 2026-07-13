import type { GranaSupabaseClient } from '@grana/supabase'
import {
  saveExpenseReimbursementSchema,
  validateActionInput,
  type SaveExpenseReimbursementInput,
} from '@grana/validation'
import { insertDeclaredReimbursement } from './internal/declared-reimbursement'

export type SaveExpenseReimbursementArgs = {
  supabase: GranaSupabaseClient
  userId: string
  input: unknown
  today: Date
}

export type SaveExpenseReimbursementResult =
  | { ok: true }
  | {
      ok: false
      fieldErrors?: Partial<Record<keyof SaveExpenseReimbursementInput, string>>
      formError?: string
    }

/**
 * Add / edit / remove the reintegro linked to an EXISTING expense (or madre),
 * from the edit form. Reconciles against the current state:
 *
 * - A `reimbursement` declaration in the input **adds** it (when none exists) or
 *   **replaces** the pending one. Editing goes through delete+insert (not UPDATE)
 *   because `estimated_amount` is immutable on UPDATE by the DB trigger, and a
 *   pending reimbursement has no accounting impact, so recreating it is safe.
 * - No declaration ⇒ **remove** any pending one.
 * - A received/cancelled reimbursement is never touched here — those transitions
 *   already hit saldo/resumen and are owned by the confirm/cancel flows. The edit
 *   form shows them read-only and never calls this; a settled one reaching here
 *   means a stale client, so we reject defensively.
 *
 * When the expense is shared, the reimbursement inherits the household split (one
 * row) via the caller-supplied `shared` spec (the expense's resulting shared
 * state), so the derived debt nets it. Mirrors `insertDeclaredReimbursement` used
 * by the create paths.
 *
 * Does NOT handle auth or cache invalidation — the caller verifies the user,
 * supplies the client, and invalidates on success.
 */
export async function saveExpenseReimbursement(
  args: SaveExpenseReimbursementArgs,
): Promise<SaveExpenseReimbursementResult> {
  const { supabase, userId, input, today } = args

  const validation = await validateActionInput(saveExpenseReimbursementSchema, input)
  if (!validation.ok) return { ok: false, fieldErrors: validation.fieldErrors }
  const data = validation.data

  // The origin must be the user's own expense (a simple/card expense or the
  // installment madre — both stored as `type='expense'`).
  const { data: expense } = await supabase
    .from('transactions')
    .select('id, type, account_id, card_period_id, currency_code, is_parent')
    .eq('id', data.expense_id)
    .eq('user_id', userId)
    .single()

  if (!expense) return { ok: false, formError: 'Gasto no encontrado.' }
  if (expense.type !== 'expense') {
    return { ok: false, formError: 'El movimiento no es un gasto.' }
  }

  const { data: linked } = await supabase
    .from('transactions')
    .select('id, received_at, cancelled_at')
    .eq('type', 'reimbursement')
    .eq('linked_transaction_id', data.expense_id)
    .eq('user_id', userId)

  const rows = linked ?? []
  const settled = rows.filter((r) => r.received_at != null || r.cancelled_at != null)
  const pending = rows.filter((r) => r.received_at == null && r.cancelled_at == null)

  if (settled.length > 0) {
    return {
      ok: false,
      formError: 'Este reintegro ya fue recibido o cancelado y no puede editarse desde acá.',
    }
  }

  // Remove the pending one first (delete+insert covers add and edit uniformly; a
  // bare remove stops here). Deleting the reimbursement cascades its splits.
  for (const r of pending) {
    const { error } = await supabase
      .from('transactions')
      .delete()
      .eq('id', r.id)
      .eq('user_id', userId)
    if (error) return { ok: false, formError: error.message }
  }

  if (!data.reimbursement) return { ok: true }

  // A 'statement' reimbursement nets in a card period. Default it to the expense's
  // own period (1× purchase) or the first cuota's period (madre) — mirroring the
  // create paths — when the caller didn't pin one.
  let declaration = data.reimbursement
  if (declaration.target === 'statement' && declaration.card_period_id == null) {
    let periodId: string | null = expense.card_period_id
    if (expense.is_parent) {
      const { data: firstChild } = await supabase
        .from('transactions')
        .select('card_period_id')
        .eq('parent_id', data.expense_id)
        .eq('is_parent', false)
        .order('installment_n', { ascending: true })
        .limit(1)
        .maybeSingle()
      periodId = firstChild?.card_period_id ?? null
    }
    if (periodId) declaration = { ...declaration, card_period_id: periodId }
  }

  const r = await insertDeclaredReimbursement(supabase, {
    userId,
    expenseId: data.expense_id,
    currencyCode: expense.currency_code,
    declaration,
    // Shared expense → the reimbursement inherits the same split (one row).
    shared: data.shared,
    today,
  })
  if (!r.ok) return { ok: false, formError: r.error }

  return { ok: true }
}
