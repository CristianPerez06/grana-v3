'use server'

import { revalidatePath } from 'next/cache'
import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import {
  acceptRecurrenceSuggestionSchema,
  confirmRecurrenceInstanceSchema,
  createRecurrenceFromMovementSchema,
  dismissRecurrenceSuggestionSchema,
  updateRecurrenceSchema,
  validateActionInput,
  type AcceptRecurrenceSuggestionInput,
  type ConfirmRecurrenceInstanceInput,
  type CreateRecurrenceFromMovementInput,
  type DismissRecurrenceSuggestionInput,
  type UpdateRecurrenceInput,
} from '@grana/validation'
import {
  mapInstanceToConfirmPlan,
  RecurrenceMapError,
  type InstanceSnapshot,
} from '@/lib/recurrences/mapper'
import type { RecurrenceCurrencyCode, RecurrenceMovementType } from '@/lib/recurrences/types'
import { createExpense, createIncome, createTransfer } from './transactions'
import { registerCardPurchase } from './credit-cards'
import type { ActionResult } from './types'
import { translatePostgresError } from './_lib/translate-error'
import { getAuthenticatedUserId } from './_lib/auth'

// ── 4.1: createRecurrenceFromMovement ─────────────────────────────────────────
// Crea una regla recurrente a partir de un movimiento real ya registrado.
// El movimiento original sigue existiendo y representa la primera ocurrencia;
// last_generated_date se setea a esa fecha para que 4.4 genere la próxima.

export async function createRecurrenceFromMovement(
  input: unknown,
): Promise<ActionResult<CreateRecurrenceFromMovementInput> & { id?: string }> {
  const validation = await validateActionInput(
    createRecurrenceFromMovementSchema,
    input,
  )
  if (!validation.ok) return { ok: false, fieldErrors: validation.fieldErrors }

  const userId = await getAuthenticatedUserId()
  const supabase = await createClient()
  const { transaction_id, frequency, end_date } = validation.data

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

  revalidatePath('/transactions')
  return { ok: true, id: recurrence.id }
}

// ── 4.6: confirmRecurrenceInstance ────────────────────────────────────────────
// Confirma una instancia pendiente. Crea la transacción real delegando en la
// action existente según el tipo de movimiento. Aplica D6: si el usuario cambia
// el monto al confirmar, propaga ese monto a la regla recurrente.

export async function confirmRecurrenceInstance(
  instanceId: string,
  overrides: unknown,
): Promise<
  ActionResult<ConfirmRecurrenceInstanceInput> & { transactionId?: string }
> {
  const validation = await validateActionInput(
    confirmRecurrenceInstanceSchema,
    overrides,
  )
  if (!validation.ok) return { ok: false, fieldErrors: validation.fieldErrors }

  const userId = await getAuthenticatedUserId()
  const supabase = await createClient()
  const payload = validation.data

  const { data: instance, error: instanceError } = await supabase
    .from('recurrence_instances')
    .select(
      'id, recurrence_id, status, scheduled_date, amount, account_id, transfer_destination_account_id, currency_code, category_id, subcategory_id, description',
    )
    .eq('id', instanceId)
    .eq('user_id', userId)
    .single()

  if (instanceError || !instance) {
    return { ok: false, formError: 'Instancia recurrente no encontrada.' }
  }

  if (instance.status !== 'pending') {
    return { ok: false, formError: 'Esta instancia ya fue resuelta.' }
  }

  const { data: rule, error: ruleError } = await supabase
    .from('recurrences')
    .select('id, movement_type, amount, status')
    .eq('id', instance.recurrence_id)
    .eq('user_id', userId)
    .single()

  if (ruleError || !rule) {
    return { ok: false, formError: 'Regla recurrente no encontrada.' }
  }
  if (rule.status === 'deleted') {
    return { ok: false, formError: 'La regla recurrente fue eliminada.' }
  }

  const { data: account, error: accountError } = await supabase
    .from('accounts')
    .select('type, is_active')
    .eq('id', instance.account_id)
    .eq('user_id', userId)
    .single()

  if (accountError || !account) {
    return { ok: false, formError: 'La cuenta de la regla no existe.' }
  }
  if (!account.is_active) {
    return {
      ok: false,
      formError:
        'La cuenta de la regla está archivada. Editá la regla antes de confirmar.',
    }
  }

  const effective: InstanceSnapshot = {
    account_id: instance.account_id,
    transfer_destination_account_id: instance.transfer_destination_account_id,
    currency_code: instance.currency_code as RecurrenceCurrencyCode,
    amount: payload.amount ?? Number(instance.amount),
    scheduled_date: payload.date ?? instance.scheduled_date,
    category_id:
      payload.category_id !== undefined ? payload.category_id : instance.category_id,
    subcategory_id:
      payload.subcategory_id !== undefined
        ? payload.subcategory_id
        : instance.subcategory_id,
    description:
      payload.description !== undefined ? payload.description : instance.description,
  }

  let plan
  try {
    plan = mapInstanceToConfirmPlan(effective, {
      movementType: rule.movement_type as RecurrenceMovementType,
      accountType: account.type as 'cash' | 'bank' | 'credit',
      fxRateToArs: payload.fx_rate_to_ars ?? null,
    })
  } catch (error) {
    if (error instanceof RecurrenceMapError) {
      const tm = await getTranslations('recurrences.mapper_errors')
      return { ok: false, formError: tm(error.code) }
    }
    throw error
  }

  let delegated: ActionResult<unknown> & { id?: string }
  if (plan.kind === 'income') {
    delegated = await createIncome(plan.input)
  } else if (plan.kind === 'expense') {
    delegated = await createExpense(plan.input)
  } else if (plan.kind === 'transfer') {
    delegated = await createTransfer(plan.input)
  } else {
    delegated = await registerCardPurchase(plan.input)
  }

  if (!delegated.ok || !delegated.id) {
    return {
      ok: false,
      formError:
        ('formError' in delegated && delegated.formError) ||
        'No se pudo registrar el movimiento.',
    }
  }

  const transactionId = delegated.id

  const { data: linked, error: linkError } = await supabase
    .from('recurrence_instances')
    .update({
      status: 'confirmed',
      confirmed_transaction_id: transactionId,
      resolved_at: new Date().toISOString(),
      amount: effective.amount,
      scheduled_date: effective.scheduled_date,
      category_id: effective.category_id,
      subcategory_id: effective.subcategory_id,
      description: effective.description,
    })
    .eq('id', instanceId)
    .eq('user_id', userId)
    .eq('status', 'pending')
    .select('id')

  if (linkError || !linked || linked.length === 0) {
    // Rollback the transaction we just created — otherwise we leak an orphan.
    await supabase.from('transactions').delete().eq('id', transactionId)
    return {
      ok: false,
      formError:
        linkError?.message ?? 'La instancia fue resuelta por otro proceso.',
    }
  }

  // D6: si el usuario cambió el monto al confirmar, propagá a la regla.
  // last_generated_date usa el scheduled_date ORIGINAL (no la override), para
  // que la siguiente generación mantenga el ritmo de la regla.
  const ruleUpdates: { last_generated_date: string; amount?: number } = {
    last_generated_date: instance.scheduled_date,
  }
  if (payload.amount !== undefined && payload.amount !== Number(rule.amount)) {
    ruleUpdates.amount = payload.amount
  }
  await supabase.from('recurrences').update(ruleUpdates).eq('id', rule.id)

  revalidatePath('/transactions')
  revalidatePath('/transactions/recurring')
  return { ok: true, transactionId }
}

// ── 4.7: skipRecurrenceInstance ───────────────────────────────────────────────
// Marca una instancia pendiente como omitida. No crea transacción.
// Avanza el cursor de la regla (last_generated_date) para que 4.4 pase a la
// siguiente fecha y no vuelva a generar la misma instancia.

export async function skipRecurrenceInstance(
  instanceId: string,
): Promise<ActionResult<never>> {
  const userId = await getAuthenticatedUserId()
  const supabase = await createClient()

  const { data: instance, error: instanceError } = await supabase
    .from('recurrence_instances')
    .select('id, recurrence_id, status, scheduled_date')
    .eq('id', instanceId)
    .eq('user_id', userId)
    .single()

  if (instanceError || !instance) {
    return { ok: false, formError: 'Instancia recurrente no encontrada.' }
  }

  if (instance.status !== 'pending') {
    return { ok: false, formError: 'Esta instancia ya fue resuelta.' }
  }

  const { data: updated, error: updateError } = await supabase
    .from('recurrence_instances')
    .update({
      status: 'skipped',
      resolved_at: new Date().toISOString(),
    })
    .eq('id', instanceId)
    .eq('user_id', userId)
    .eq('status', 'pending')
    .select('id')

  if (updateError || !updated || updated.length === 0) {
    return {
      ok: false,
      formError:
        updateError?.message ?? 'La instancia fue resuelta por otro proceso.',
    }
  }

  await supabase
    .from('recurrences')
    .update({ last_generated_date: instance.scheduled_date })
    .eq('id', instance.recurrence_id)
    .eq('user_id', userId)

  revalidatePath('/transactions')
  revalidatePath('/transactions/recurring')
  return { ok: true }
}

// ── 4.8: updateRecurrence ─────────────────────────────────────────────────────
// Edita la regla. No toca instancias pendientes ya generadas: ellas conservan
// el snapshot anterior (el usuario puede skip/confirm normalmente). La próxima
// generación usará la regla nueva.

export async function updateRecurrence(
  id: string,
  input: unknown,
): Promise<ActionResult<UpdateRecurrenceInput>> {
  const validation = await validateActionInput(updateRecurrenceSchema, input)
  if (!validation.ok) return { ok: false, fieldErrors: validation.fieldErrors }

  const userId = await getAuthenticatedUserId()
  const supabase = await createClient()

  const { data: current, error: currentError } = await supabase
    .from('recurrences')
    .select(
      'id, movement_type, account_id, transfer_destination_account_id, start_date, end_date, status',
    )
    .eq('id', id)
    .eq('user_id', userId)
    .single()

  if (currentError || !current) {
    return { ok: false, formError: 'Regla recurrente no encontrada.' }
  }
  if (current.status === 'deleted') {
    return { ok: false, formError: 'La regla está eliminada y no se puede editar.' }
  }

  const updates = validation.data

  const mergedAccount = updates.account_id ?? current.account_id
  const mergedDestination =
    'transfer_destination_account_id' in updates
      ? (updates.transfer_destination_account_id ?? null)
      : current.transfer_destination_account_id
  const mergedStart = updates.start_date ?? current.start_date
  const mergedEnd =
    'end_date' in updates ? (updates.end_date ?? null) : current.end_date

  if (current.movement_type === 'transfer') {
    if (!mergedDestination) {
      return { ok: false, formError: 'La transferencia requiere cuenta destino.' }
    }
    if (mergedDestination === mergedAccount) {
      return {
        ok: false,
        formError: 'La cuenta origen y destino no pueden ser iguales.',
      }
    }
  } else if (mergedDestination != null) {
    return {
      ok: false,
      formError: 'Solo las transferencias usan cuenta destino.',
    }
  }

  if (mergedEnd != null && mergedEnd < mergedStart) {
    return {
      ok: false,
      formError: 'La fecha de fin debe ser posterior o igual al inicio.',
    }
  }

  type RecurrencePatch = {
    account_id?: string
    transfer_destination_account_id?: string | null
    currency_code?: string
    amount?: number
    category_id?: string | null
    subcategory_id?: string | null
    description?: string | null
    frequency?: 'weekly' | 'biweekly' | 'monthly' | 'annual'
    start_date?: string
    end_date?: string | null
  }

  const patch: RecurrencePatch = {}
  if (updates.account_id !== undefined) patch.account_id = updates.account_id
  if (updates.currency_code !== undefined) patch.currency_code = updates.currency_code
  if (updates.amount !== undefined) patch.amount = updates.amount
  if (updates.frequency !== undefined) {
    patch.frequency = updates.frequency as RecurrencePatch['frequency']
  }
  if (updates.start_date !== undefined) patch.start_date = updates.start_date
  if ('transfer_destination_account_id' in updates) {
    patch.transfer_destination_account_id =
      updates.transfer_destination_account_id ?? null
  }
  if ('category_id' in updates) patch.category_id = updates.category_id ?? null
  if ('subcategory_id' in updates) {
    patch.subcategory_id = updates.subcategory_id ?? null
  }
  if ('description' in updates) patch.description = updates.description ?? null
  if ('end_date' in updates) patch.end_date = updates.end_date ?? null

  if (Object.keys(patch).length === 0) return { ok: true }

  const { error: updateError } = await supabase
    .from('recurrences')
    .update(patch)
    .eq('id', id)
    .eq('user_id', userId)

  if (updateError) return { ok: false, formError: updateError.message }

  revalidatePath('/transactions')
  revalidatePath('/transactions/recurring')
  return { ok: true }
}

// ── 4.9: pauseRecurrence / resumeRecurrence ───────────────────────────────────
// Pausar detiene futuras generaciones de 4.4 (que solo procesa status='active').
// No toca instancias pendientes ya generadas — el usuario puede confirmarlas o
// omitirlas. Reanudar simplemente vuelve a 'active'; la próxima generación se
// computa desde last_generated_date como siempre (D8).

export async function pauseRecurrence(id: string): Promise<ActionResult<never>> {
  const userId = await getAuthenticatedUserId()
  const supabase = await createClient()

  const { data: rule, error: ruleError } = await supabase
    .from('recurrences')
    .select('id, status')
    .eq('id', id)
    .eq('user_id', userId)
    .single()

  if (ruleError || !rule) {
    return { ok: false, formError: 'Regla recurrente no encontrada.' }
  }
  if (rule.status === 'deleted') {
    return { ok: false, formError: 'La regla está eliminada.' }
  }
  if (rule.status === 'paused') return { ok: true }

  const { error } = await supabase
    .from('recurrences')
    .update({ status: 'paused' })
    .eq('id', id)
    .eq('user_id', userId)

  if (error) return { ok: false, formError: await translatePostgresError(error.code, 'recurrence') }

  revalidatePath('/transactions')
  revalidatePath('/transactions/recurring')
  return { ok: true }
}

export async function resumeRecurrence(id: string): Promise<ActionResult<never>> {
  const userId = await getAuthenticatedUserId()
  const supabase = await createClient()

  const { data: rule, error: ruleError } = await supabase
    .from('recurrences')
    .select('id, status')
    .eq('id', id)
    .eq('user_id', userId)
    .single()

  if (ruleError || !rule) {
    return { ok: false, formError: 'Regla recurrente no encontrada.' }
  }
  if (rule.status === 'deleted') {
    return {
      ok: false,
      formError: 'La regla está eliminada y no puede reactivarse.',
    }
  }
  if (rule.status === 'active') return { ok: true }

  const { error } = await supabase
    .from('recurrences')
    .update({ status: 'active' })
    .eq('id', id)
    .eq('user_id', userId)

  if (error) return { ok: false, formError: await translatePostgresError(error.code, 'recurrence') }

  revalidatePath('/transactions')
  revalidatePath('/transactions/recurring')
  return { ok: true }
}

// ── 4.10: deleteRecurrence (soft-delete) ──────────────────────────────────────
// Soft-delete: la regla queda con status='deleted' para no romper la integridad
// referencial de instancias confirmadas (mantienen su recurrence_id para audit).
// Las instancias pendientes se BORRAN porque son propuestas, no movimientos
// reales — el usuario ya decidió no seguir con la regla (D8).
// Las transacciones reales ya confirmadas NO se tocan.

export async function deleteRecurrence(id: string): Promise<ActionResult<never>> {
  const userId = await getAuthenticatedUserId()
  const supabase = await createClient()

  const { data: rule, error: ruleError } = await supabase
    .from('recurrences')
    .select('id, status')
    .eq('id', id)
    .eq('user_id', userId)
    .single()

  if (ruleError || !rule) {
    return { ok: false, formError: 'Regla recurrente no encontrada.' }
  }
  if (rule.status === 'deleted') return { ok: true }

  const { error: updateError } = await supabase
    .from('recurrences')
    .update({ status: 'deleted' })
    .eq('id', id)
    .eq('user_id', userId)

  if (updateError) return { ok: false, formError: updateError.message }

  const { error: deleteError } = await supabase
    .from('recurrence_instances')
    .delete()
    .eq('recurrence_id', id)
    .eq('user_id', userId)
    .eq('status', 'pending')

  if (deleteError) {
    return { ok: false, formError: deleteError.message }
  }

  revalidatePath('/transactions')
  revalidatePath('/transactions/recurring')
  return { ok: true }
}

// ── 4.12: acceptRecurrenceSuggestion ──────────────────────────────────────────
// Acepta una sugerencia y crea la regla activa con los valores propuestos.
// start_date = última fecha vista por la detección, last_generated_date = misma
// fecha, para que 4.4 genere la próxima instancia en la siguiente fecha
// esperada (en el futuro).

export async function acceptRecurrenceSuggestion(
  input: unknown,
): Promise<ActionResult<AcceptRecurrenceSuggestionInput> & { id?: string }> {
  const validation = await validateActionInput(
    acceptRecurrenceSuggestionSchema,
    input,
  )
  if (!validation.ok) return { ok: false, fieldErrors: validation.fieldErrors }

  const userId = await getAuthenticatedUserId()
  const supabase = await createClient()
  const data = validation.data

  if (data.movement_type === 'transfer' && !data.transfer_destination_account_id) {
    return { ok: false, formError: 'La transferencia requiere cuenta destino.' }
  }
  if (data.movement_type !== 'transfer' && !data.category_id) {
    return {
      ok: false,
      formError: 'Los ingresos y gastos requieren categoría.',
    }
  }

  const { data: recurrence, error: insertError } = await supabase
    .from('recurrences')
    .insert({
      user_id: userId,
      movement_type: data.movement_type,
      account_id: data.account_id,
      transfer_destination_account_id:
        data.movement_type === 'transfer'
          ? data.transfer_destination_account_id ?? null
          : null,
      currency_code: data.currency_code,
      amount: data.amount,
      category_id:
        data.movement_type === 'transfer' ? null : data.category_id ?? null,
      subcategory_id: null,
      description: data.description ?? null,
      frequency: data.frequency,
      start_date: data.start_date,
      end_date: null,
      last_generated_date: data.start_date,
      status: 'active',
      created_from_transaction_id: null,
    })
    .select('id')
    .single()

  if (insertError || !recurrence) {
    return {
      ok: false,
      formError: insertError?.message ?? 'No se pudo crear la regla recurrente.',
    }
  }

  revalidatePath('/transactions')
  revalidatePath('/transactions/recurring')
  return { ok: true, id: recurrence.id }
}

// ── 4.13: dismissRecurrenceSuggestion ─────────────────────────────────────────
// Persiste el fingerprint del patrón para que la detección on-the-fly no
// vuelva a sugerirlo. Idempotente vía UNIQUE (user_id, fingerprint).

export async function dismissRecurrenceSuggestion(
  input: unknown,
): Promise<ActionResult<DismissRecurrenceSuggestionInput>> {
  const validation = await validateActionInput(
    dismissRecurrenceSuggestionSchema,
    input,
  )
  if (!validation.ok) return { ok: false, fieldErrors: validation.fieldErrors }

  const userId = await getAuthenticatedUserId()
  const supabase = await createClient()

  const { error } = await supabase
    .from('recurrence_suggestion_dismissals')
    .upsert(
      {
        user_id: userId,
        fingerprint: validation.data.fingerprint,
      },
      { onConflict: 'user_id,fingerprint' },
    )

  if (error) return { ok: false, formError: await translatePostgresError(error.code, 'recurrence') }

  revalidatePath('/transactions')
  return { ok: true }
}
