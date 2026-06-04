import type { GranaSupabaseClient } from '@grana/supabase'
import {
  createRecurrenceFromMovementSchema,
  validateActionInput,
  type CreateRecurrenceFromMovementInput,
} from '@grana/validation'
import { presetToInterval, type IntervalUnit } from '@grana/money-logic'

export type CreateRecurrenceFromMovementArgs = {
  supabase: GranaSupabaseClient
  userId: string
  input: unknown
}

export type CreateRecurrenceFromMovementResult =
  | { ok: true; id: string }
  | {
      ok: false
      fieldErrors?: Partial<Record<keyof CreateRecurrenceFromMovementInput, string>>
      formError?: string
    }

/**
 * Orchestrator: create a recurrence rule from an already-registered movement
 * (the seed). The seed transaction continues to exist and represents the first
 * occurrence; `last_generated_date` is set to its date so the generator can
 * produce the next one.
 *
 * Single-row insert with up-front validations against the seed transaction
 * (must exist, belong to the user, not be an installment parent/child, not be
 * an adjustment, have a category for income/expense and a destination for
 * transfers). No rollback because there is nothing to undo on failure.
 *
 * Does NOT handle auth or cache invalidation.
 */
export async function createRecurrenceFromMovement(
  args: CreateRecurrenceFromMovementArgs,
): Promise<CreateRecurrenceFromMovementResult> {
  const { supabase, userId, input } = args

  const validation = await validateActionInput(createRecurrenceFromMovementSchema, input)
  if (!validation.ok) return { ok: false, fieldErrors: validation.fieldErrors }

  const {
    transaction_id,
    frequency,
    end_date,
    interval_count,
    interval_unit,
    max_occurrences,
  } = validation.data

  const interval =
    frequency === 'custom'
      ? { count: interval_count as number, unit: interval_unit as IntervalUnit }
      : presetToInterval(frequency)

  const { data: tx, error: txError } = await supabase
    .from('transactions')
    .select(
      'id, account_id, transfer_destination_account_id, type, amount, currency_code, date, category_id, subcategory_id, description, is_parent, parent_id',
    )
    .eq('id', transaction_id)
    .eq('user_id', userId)
    .single()

  if (txError || !tx) {
    return { ok: false, formError: 'Movimiento no encontrado.' }
  }

  if (tx.is_parent || tx.parent_id != null) {
    return {
      ok: false,
      formError: 'No se puede crear una recurrencia desde una compra en cuotas.',
    }
  }

  if (tx.type === 'adjustment') {
    return { ok: false, formError: 'Los ajustes no admiten recurrencias.' }
  }

  if (!tx.account_id) {
    return { ok: false, formError: 'El movimiento no tiene cuenta asociada.' }
  }

  if (end_date != null && end_date < tx.date) {
    return {
      ok: false,
      formError: 'La fecha de fin debe ser posterior o igual al movimiento de origen.',
    }
  }

  const movementType: 'income' | 'expense' | 'transfer' =
    tx.type === 'income' ? 'income' : tx.type === 'transfer' ? 'transfer' : 'expense'

  if (movementType === 'transfer' && !tx.transfer_destination_account_id) {
    return { ok: false, formError: 'La transferencia no tiene cuenta destino.' }
  }

  if (movementType !== 'transfer' && !tx.category_id) {
    return { ok: false, formError: 'El movimiento no tiene categoría asignada.' }
  }

  const { data: existing } = await supabase
    .from('recurrences')
    .select('id')
    .eq('created_from_transaction_id', tx.id)
    .in('status', ['active', 'paused'])
    .maybeSingle()

  if (existing) {
    return {
      ok: false,
      formError: 'Este movimiento ya tiene una recurrencia asociada.',
    }
  }

  const { data: recurrence, error: insertError } = await supabase
    .from('recurrences')
    .insert({
      user_id: userId,
      movement_type: movementType,
      account_id: tx.account_id,
      transfer_destination_account_id:
        movementType === 'transfer' ? tx.transfer_destination_account_id : null,
      currency_code: tx.currency_code,
      amount: tx.amount,
      category_id: movementType === 'transfer' ? null : tx.category_id,
      subcategory_id: movementType === 'transfer' ? null : tx.subcategory_id,
      description: tx.description,
      frequency,
      interval_count: interval.count,
      interval_unit: interval.unit,
      max_occurrences: max_occurrences ?? null,
      start_date: tx.date,
      end_date: end_date ?? null,
      last_generated_date: tx.date,
      status: 'active',
      created_from_transaction_id: tx.id,
    })
    .select('id')
    .single()

  if (insertError || !recurrence) {
    return {
      ok: false,
      formError: insertError?.message ?? 'No se pudo crear la regla recurrente.',
    }
  }

  return { ok: true, id: recurrence.id }
}
