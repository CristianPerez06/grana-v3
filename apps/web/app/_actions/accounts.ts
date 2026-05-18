'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import {
  createAccountSchema,
  updateAccountSchema,
  addCurrencySchema,
  validateActionInput,
  type CreateAccountInput,
  type UpdateAccountInput,
  type AddCurrencyInput,
} from '@grana/validation'
import type { ActionResult } from './types'

async function getAuthenticatedUserId(): Promise<string> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')
  return user.id
}

// ── createAccount ─────────────────────────────────────────────────────────────

export async function createAccount(
  input: unknown,
): Promise<ActionResult<CreateAccountInput> & { id?: string }> {
  const validation = await validateActionInput(createAccountSchema, input)
  if (!validation.ok) return { ok: false, fieldErrors: validation.fieldErrors }

  const userId = await getAuthenticatedUserId()
  const supabase = await createClient()

  const { data: account, error: accountError } = await supabase
    .from('accounts')
    .insert({
      user_id: userId,
      name: validation.data.name,
      type: validation.data.type,
      institution_id: validation.data.institution_id ?? null,
    })
    .select('id')
    .single()

  if (accountError || !account) {
    return { ok: false, formError: accountError?.message ?? 'Failed to create account' }
  }

  const currencyRows = validation.data.currencies.map((c) => ({
    account_id: account.id,
    currency_code: c.currency_code,
    initial_balance: c.initial_balance,
    initial_balance_date: new Date().toLocaleDateString('en-CA'),
  }))

  const { error: currencyError } = await supabase
    .from('account_currencies')
    .insert(currencyRows)

  if (currencyError) {
    await supabase.from('accounts').delete().eq('id', account.id)
    return { ok: false, formError: currencyError.message }
  }

  revalidatePath('/accounts')
  return { ok: true, id: account.id }
}

// ── updateAccount ─────────────────────────────────────────────────────────────

export async function updateAccount(
  id: string,
  input: unknown,
): Promise<ActionResult<UpdateAccountInput>> {
  const validation = await validateActionInput(updateAccountSchema, input)
  if (!validation.ok) return { ok: false, fieldErrors: validation.fieldErrors }

  const userId = await getAuthenticatedUserId()
  const supabase = await createClient()

  const updates: { name?: string; institution_id?: string | null } = {}
  if (validation.data.name !== undefined) updates.name = validation.data.name
  if (validation.data.institution_id !== undefined) {
    updates.institution_id = validation.data.institution_id
  }

  const { error } = await supabase
    .from('accounts')
    .update(updates)
    .eq('id', id)
    .eq('user_id', userId)

  if (error) return { ok: false, formError: error.message }

  revalidatePath('/accounts')
  return { ok: true }
}

// ── archiveAccount ────────────────────────────────────────────────────────────

export async function archiveAccount(id: string): Promise<ActionResult<never>> {
  const userId = await getAuthenticatedUserId()
  const supabase = await createClient()

  const { data: currencies, error: fetchError } = await supabase
    .from('account_currencies')
    .select('currency_code, initial_balance')
    .eq('account_id', id)
    .eq('is_active', true)

  if (fetchError) return { ok: false, formError: fetchError.message }

  const hasNonZeroBalance = (currencies ?? []).some((c) => c.initial_balance !== 0)
  if (hasNonZeroBalance) {
    return {
      ok: false,
      formError: 'No podés archivar una cuenta con saldo distinto de cero.',
    }
  }

  const { error } = await supabase
    .from('accounts')
    .update({ is_active: false })
    .eq('id', id)
    .eq('user_id', userId)

  if (error) return { ok: false, formError: error.message }

  revalidatePath('/accounts')
  return { ok: true }
}

// ── reactivateAccount ─────────────────────────────────────────────────────────

export async function reactivateAccount(id: string): Promise<ActionResult<never>> {
  const userId = await getAuthenticatedUserId()
  const supabase = await createClient()

  const { error } = await supabase
    .from('accounts')
    .update({ is_active: true })
    .eq('id', id)
    .eq('user_id', userId)

  if (error) return { ok: false, formError: error.message }

  revalidatePath('/accounts')
  return { ok: true }
}

// ── deleteAccount ─────────────────────────────────────────────────────────────

export async function deleteAccount(id: string): Promise<ActionResult<never>> {
  const userId = await getAuthenticatedUserId()
  const supabase = await createClient()

  // Guard: once transactions module exists, block delete if account has any.
  // For now the table doesn't exist, so any account can be deleted.
  const { error } = await supabase
    .from('accounts')
    .delete()
    .eq('id', id)
    .eq('user_id', userId)

  if (error) return { ok: false, formError: error.message }

  revalidatePath('/accounts')
  return { ok: true }
}

// ── addCurrencyToAccount ──────────────────────────────────────────────────────

export async function addCurrencyToAccount(
  accountId: string,
  input: unknown,
): Promise<ActionResult<AddCurrencyInput>> {
  const validation = await validateActionInput(addCurrencySchema, input)
  if (!validation.ok) return { ok: false, fieldErrors: validation.fieldErrors }

  const userId = await getAuthenticatedUserId()
  const supabase = await createClient()

  const { data: account, error: ownerError } = await supabase
    .from('accounts')
    .select('id')
    .eq('id', accountId)
    .eq('user_id', userId)
    .single()

  if (ownerError || !account) return { ok: false, formError: 'Cuenta no encontrada.' }

  const { error } = await supabase.from('account_currencies').upsert(
    {
      account_id: accountId,
      currency_code: validation.data.currency_code,
      initial_balance: validation.data.initial_balance,
      initial_balance_date: new Date().toLocaleDateString('en-CA'),
      is_active: true,
    },
    { onConflict: 'account_id,currency_code' },
  )

  if (error) return { ok: false, formError: error.message }

  revalidatePath('/accounts')
  return { ok: true }
}

// ── deactivateCurrencyFromAccount ─────────────────────────────────────────────

export async function deactivateCurrencyFromAccount(
  accountId: string,
  currencyCode: 'ARS' | 'USD',
): Promise<ActionResult<never>> {
  const userId = await getAuthenticatedUserId()
  const supabase = await createClient()

  const { data: account, error: ownerError } = await supabase
    .from('accounts')
    .select('id')
    .eq('id', accountId)
    .eq('user_id', userId)
    .single()

  if (ownerError || !account) return { ok: false, formError: 'Cuenta no encontrada.' }

  const { data: currencies, error: fetchError } = await supabase
    .from('account_currencies')
    .select('currency_code, initial_balance, is_active')
    .eq('account_id', accountId)
    .eq('is_active', true)

  if (fetchError) return { ok: false, formError: fetchError.message }

  const activeCurrencies = currencies ?? []

  if (activeCurrencies.length <= 1) {
    return { ok: false, formError: 'Debe quedar al menos una moneda activa.' }
  }

  const target = activeCurrencies.find((c) => c.currency_code === currencyCode)
  if (!target) return { ok: false, formError: 'Moneda no encontrada en la cuenta.' }

  // Check combined balance: initial_balance + net transaction sums
  // Include incoming transfers where this account is the destination
  const { data: txSumRow } = await supabase
    .from('transactions')
    .select('account_id, transfer_destination_account_id, amount, type')
    .or(
      `account_id.eq.${accountId},transfer_destination_account_id.eq.${accountId}`,
    )
    .eq('currency_code', currencyCode)

  const txNet = (txSumRow ?? []).reduce((acc, row) => {
    if (row.type === 'income') return acc + Number(row.amount)
    if (row.type === 'expense') return acc - Number(row.amount)
    if (row.type === 'transfer') {
      if (row.account_id === accountId) return acc - Number(row.amount)
      if (row.transfer_destination_account_id === accountId) return acc + Number(row.amount)
    }
    if (row.type === 'adjustment') return acc + Number(row.amount)
    return acc
  }, 0)

  const totalBalance = Number(target.initial_balance) + txNet
  if (totalBalance !== 0) {
    return {
      ok: false,
      formError: 'No podés desactivar una moneda con saldo distinto de cero.',
    }
  }

  const { error } = await supabase
    .from('account_currencies')
    .update({ is_active: false })
    .eq('account_id', accountId)
    .eq('currency_code', currencyCode)

  if (error) return { ok: false, formError: error.message }

  revalidatePath('/accounts')
  return { ok: true }
}
