'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import {
  createIncomeSchema,
  createExpenseSchema,
  updateTransactionSchema,
  createTransferSchema,
  createAdjustmentSchema,
  updateTransferSchema,
  updateAdjustmentSchema,
  validateActionInput,
  type CreateIncomeInput,
  type CreateExpenseInput,
  type UpdateTransactionInput,
  type CreateTransferInput,
  type CreateAdjustmentInput,
  type UpdateTransferInput,
  type UpdateAdjustmentInput,
} from '@grana/validation'
import type { ActionResult } from './types'

async function getAuthenticatedUserId(): Promise<string> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')
  return user.id
}

async function verifyActiveCurrency(
  supabase: Awaited<ReturnType<typeof createClient>>,
  accountId: string,
  currencyCode: string,
): Promise<boolean> {
  const { data } = await supabase
    .from('account_currencies')
    .select('id')
    .eq('account_id', accountId)
    .eq('currency_code', currencyCode)
    .eq('is_active', true)
    .single()

  return data !== null
}

// ── createIncome ──────────────────────────────────────────────────────────────

export async function createIncome(
  input: unknown,
): Promise<ActionResult<CreateIncomeInput> & { id?: string }> {
  const validation = await validateActionInput(createIncomeSchema, input)
  if (!validation.ok) return { ok: false, fieldErrors: validation.fieldErrors }

  const userId = await getAuthenticatedUserId()
  const supabase = await createClient()

  const currencyActive = await verifyActiveCurrency(
    supabase,
    validation.data.account_id,
    validation.data.currency_code,
  )
  if (!currencyActive) {
    return { ok: false, formError: 'La moneda seleccionada no está activa en esta cuenta.' }
  }

  const { data, error } = await supabase
    .from('transactions')
    .insert({
      user_id: userId,
      account_id: validation.data.account_id,
      type: 'income',
      amount: validation.data.amount,
      currency_code: validation.data.currency_code,
      date: validation.data.date,
      category_id: validation.data.category_id ?? null,
      subcategory_id: validation.data.subcategory_id ?? null,
      description: validation.data.description ?? null,
    })
    .select('id')
    .single()

  if (error || !data) {
    return { ok: false, formError: error?.message ?? 'No se pudo registrar el ingreso.' }
  }

  revalidatePath('/accounts')
  revalidatePath(`/accounts/${validation.data.account_id}`)
  return { ok: true, id: data.id }
}

// ── createExpense ─────────────────────────────────────────────────────────────

export async function createExpense(
  input: unknown,
): Promise<ActionResult<CreateExpenseInput> & { id?: string }> {
  const validation = await validateActionInput(createExpenseSchema, input)
  if (!validation.ok) return { ok: false, fieldErrors: validation.fieldErrors }

  const userId = await getAuthenticatedUserId()
  const supabase = await createClient()

  const currencyActive = await verifyActiveCurrency(
    supabase,
    validation.data.account_id,
    validation.data.currency_code,
  )
  if (!currencyActive) {
    return { ok: false, formError: 'La moneda seleccionada no está activa en esta cuenta.' }
  }

  const { data, error } = await supabase
    .from('transactions')
    .insert({
      user_id: userId,
      account_id: validation.data.account_id,
      type: 'expense',
      amount: validation.data.amount,
      currency_code: validation.data.currency_code,
      date: validation.data.date,
      category_id: validation.data.category_id,
      subcategory_id: validation.data.subcategory_id ?? null,
      description: validation.data.description ?? null,
    })
    .select('id')
    .single()

  if (error || !data) {
    return { ok: false, formError: error?.message ?? 'No se pudo registrar el gasto.' }
  }

  revalidatePath('/accounts')
  revalidatePath(`/accounts/${validation.data.account_id}`)
  return { ok: true, id: data.id }
}

// ── updateTransaction ─────────────────────────────────────────────────────────

export async function updateTransaction(
  id: string,
  accountId: string,
  input: unknown,
): Promise<ActionResult<UpdateTransactionInput>> {
  const validation = await validateActionInput(updateTransactionSchema, input)
  if (!validation.ok) return { ok: false, fieldErrors: validation.fieldErrors }

  const userId = await getAuthenticatedUserId()
  const supabase = await createClient()

  const { data: existing } = await supabase
    .from('transactions')
    .select('id')
    .eq('id', id)
    .eq('user_id', userId)
    .single()

  if (!existing) return { ok: false, formError: 'Transacción no encontrada.' }

  const { error } = await supabase
    .from('transactions')
    .update({
      ...(validation.data.amount !== undefined && { amount: validation.data.amount }),
      ...(validation.data.date !== undefined && { date: validation.data.date }),
      ...('description' in validation.data && { description: validation.data.description ?? null }),
      ...('category_id' in validation.data && { category_id: validation.data.category_id ?? null }),
      ...('subcategory_id' in validation.data && { subcategory_id: validation.data.subcategory_id ?? null }),
    })
    .eq('id', id)
    .eq('user_id', userId)

  if (error) return { ok: false, formError: error.message }

  revalidatePath('/accounts')
  revalidatePath(`/accounts/${accountId}`)
  revalidatePath(`/accounts/${accountId}/transactions/${id}`)
  return { ok: true }
}

// ── deleteTransaction ─────────────────────────────────────────────────────────

export async function deleteTransaction(
  id: string,
  accountId: string,
): Promise<ActionResult<never>> {
  const userId = await getAuthenticatedUserId()
  const supabase = await createClient()

  const { error } = await supabase
    .from('transactions')
    .delete()
    .eq('id', id)
    .eq('user_id', userId)

  if (error) return { ok: false, formError: error.message }

  revalidatePath('/accounts')
  revalidatePath(`/accounts/${accountId}`)
  return { ok: true }
}

// ── createTransfer ────────────────────────────────────────────────────────────

export async function createTransfer(
  input: unknown,
): Promise<ActionResult<CreateTransferInput> & { id?: string }> {
  const validation = await validateActionInput(createTransferSchema, input)
  if (!validation.ok) return { ok: false, fieldErrors: validation.fieldErrors }

  const userId = await getAuthenticatedUserId()
  const supabase = await createClient()

  const [sourceActive, destActive] = await Promise.all([
    verifyActiveCurrency(supabase, validation.data.account_id, validation.data.currency_code),
    verifyActiveCurrency(
      supabase,
      validation.data.transfer_destination_account_id,
      validation.data.currency_code,
    ),
  ])

  if (!sourceActive) {
    return { ok: false, formError: 'La moneda seleccionada no está activa en la cuenta origen.' }
  }
  if (!destActive) {
    return {
      ok: false,
      formError: 'La moneda seleccionada no está activa en la cuenta destino.',
    }
  }

  const { data, error } = await supabase
    .from('transactions')
    .insert({
      user_id: userId,
      account_id: validation.data.account_id,
      transfer_destination_account_id: validation.data.transfer_destination_account_id,
      type: 'transfer',
      amount: validation.data.amount,
      currency_code: validation.data.currency_code,
      date: validation.data.date,
      description: validation.data.description ?? null,
    })
    .select('id')
    .single()

  if (error || !data) {
    return { ok: false, formError: error?.message ?? 'No se pudo registrar la transferencia.' }
  }

  revalidatePath('/accounts')
  revalidatePath(`/accounts/${validation.data.account_id}`)
  revalidatePath(`/accounts/${validation.data.transfer_destination_account_id}`)
  return { ok: true, id: data.id }
}

// ── createAdjustment ──────────────────────────────────────────────────────────

export async function createAdjustment(
  input: unknown,
): Promise<ActionResult<CreateAdjustmentInput> & { id?: string }> {
  const validation = await validateActionInput(createAdjustmentSchema, input)
  if (!validation.ok) return { ok: false, fieldErrors: validation.fieldErrors }

  const userId = await getAuthenticatedUserId()
  const supabase = await createClient()

  const currencyActive = await verifyActiveCurrency(
    supabase,
    validation.data.account_id,
    validation.data.currency_code,
  )
  if (!currencyActive) {
    return { ok: false, formError: 'La moneda seleccionada no está activa en esta cuenta.' }
  }

  const { data, error } = await supabase
    .from('transactions')
    .insert({
      user_id: userId,
      account_id: validation.data.account_id,
      type: 'adjustment',
      amount: validation.data.amount,
      currency_code: validation.data.currency_code,
      date: validation.data.date,
      description: validation.data.description ?? null,
    })
    .select('id')
    .single()

  if (error || !data) {
    return { ok: false, formError: error?.message ?? 'No se pudo registrar el ajuste.' }
  }

  revalidatePath('/accounts')
  revalidatePath(`/accounts/${validation.data.account_id}`)
  return { ok: true, id: data.id }
}

// ── updateTransfer ────────────────────────────────────────────────────────────

export async function updateTransfer(
  id: string,
  accountId: string,
  destinationAccountId: string,
  input: unknown,
): Promise<ActionResult<UpdateTransferInput>> {
  const validation = await validateActionInput(updateTransferSchema, input)
  if (!validation.ok) return { ok: false, fieldErrors: validation.fieldErrors }

  const userId = await getAuthenticatedUserId()
  const supabase = await createClient()

  const { data: existing } = await supabase
    .from('transactions')
    .select('id, type')
    .eq('id', id)
    .eq('user_id', userId)
    .eq('type', 'transfer')
    .single()

  if (!existing) return { ok: false, formError: 'Transferencia no encontrada.' }

  const { error } = await supabase
    .from('transactions')
    .update({
      ...(validation.data.amount !== undefined && { amount: validation.data.amount }),
      ...(validation.data.date !== undefined && { date: validation.data.date }),
      ...('description' in validation.data && { description: validation.data.description ?? null }),
    })
    .eq('id', id)
    .eq('user_id', userId)

  if (error) return { ok: false, formError: error.message }

  revalidatePath('/accounts')
  revalidatePath(`/accounts/${accountId}`)
  revalidatePath(`/accounts/${destinationAccountId}`)
  revalidatePath(`/accounts/${accountId}/transactions/${id}`)
  return { ok: true }
}

// ── updateAdjustment ──────────────────────────────────────────────────────────

export async function updateAdjustment(
  id: string,
  accountId: string,
  input: unknown,
): Promise<ActionResult<UpdateAdjustmentInput>> {
  const validation = await validateActionInput(updateAdjustmentSchema, input)
  if (!validation.ok) return { ok: false, fieldErrors: validation.fieldErrors }

  const userId = await getAuthenticatedUserId()
  const supabase = await createClient()

  const { data: existing } = await supabase
    .from('transactions')
    .select('id, type')
    .eq('id', id)
    .eq('user_id', userId)
    .eq('type', 'adjustment')
    .single()

  if (!existing) return { ok: false, formError: 'Ajuste no encontrado.' }

  const { error } = await supabase
    .from('transactions')
    .update({
      ...(validation.data.amount !== undefined && { amount: validation.data.amount }),
      ...(validation.data.date !== undefined && { date: validation.data.date }),
      ...('description' in validation.data && { description: validation.data.description ?? null }),
    })
    .eq('id', id)
    .eq('user_id', userId)

  if (error) return { ok: false, formError: error.message }

  revalidatePath('/accounts')
  revalidatePath(`/accounts/${accountId}`)
  revalidatePath(`/accounts/${accountId}/transactions/${id}`)
  return { ok: true }
}

// ── deleteTransfer ────────────────────────────────────────────────────────────

export async function deleteTransfer(
  id: string,
  accountId: string,
  destinationAccountId: string,
): Promise<ActionResult<never>> {
  const userId = await getAuthenticatedUserId()
  const supabase = await createClient()

  const { error } = await supabase
    .from('transactions')
    .delete()
    .eq('id', id)
    .eq('user_id', userId)

  if (error) return { ok: false, formError: error.message }

  revalidatePath('/accounts')
  revalidatePath(`/accounts/${accountId}`)
  revalidatePath(`/accounts/${destinationAccountId}`)
  return { ok: true }
}

// ── deleteAdjustment ──────────────────────────────────────────────────────────

export async function deleteAdjustment(
  id: string,
  accountId: string,
): Promise<ActionResult<never>> {
  const userId = await getAuthenticatedUserId()
  const supabase = await createClient()

  const { error } = await supabase
    .from('transactions')
    .delete()
    .eq('id', id)
    .eq('user_id', userId)

  if (error) return { ok: false, formError: error.message }

  revalidatePath('/accounts')
  revalidatePath(`/accounts/${accountId}`)
  return { ok: true }
}
