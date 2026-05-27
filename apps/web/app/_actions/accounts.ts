'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { formatDateISO, getTodayAR } from '@/lib/date'
import { getTransactionSums } from '@/lib/transactions/balance'
import {
  Money,
  normalizeMoneyAmount,
  createAccountSchema,
  updateAccountSchema,
  addCurrencySchema,
  validateActionInput,
  type CreateAccountInput,
  type UpdateAccountInput,
  type AddCurrencyInput,
} from '@grana/validation'
import { getCreditCardDebtCheck } from '@/lib/cards/queries'
import type { ActionResult } from './types'
import { translatePostgresError } from './_lib/translate-error'
import { getAuthenticatedUserId } from './_lib/auth'

function normalizeActionMoney(value: number): number {
  return normalizeMoneyAmount(value) ?? value
}

// ── createAccount ─────────────────────────────────────────────────────────────

export async function createAccount(
  input: unknown,
): Promise<ActionResult<CreateAccountInput> & { id?: string }> {
  const validation = await validateActionInput(createAccountSchema, input)
  if (!validation.ok) return { ok: false, fieldErrors: validation.fieldErrors }

  const userId = await getAuthenticatedUserId()
  const supabase = await createClient()
  const today = formatDateISO(getTodayAR())

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
    initial_balance: normalizeActionMoney(c.initial_balance),
    initial_balance_date: today,
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

  if (error) return { ok: false, formError: await translatePostgresError(error.code, 'account') }

  revalidatePath('/accounts')
  return { ok: true }
}

// ── archiveAccount ────────────────────────────────────────────────────────────

export async function archiveAccount(
  id: string,
): Promise<ActionResult<never> & { reason?: string }> {
  const userId = await getAuthenticatedUserId()
  const supabase = await createClient()

  // For credit accounts, enforce R-tarjeta (no pending debt before archiving)
  const { data: account } = await supabase
    .from('accounts')
    .select('type')
    .eq('id', id)
    .eq('user_id', userId)
    .single()

  if (account?.type === 'credit') {
    const debtCheck = await getCreditCardDebtCheck(id)
    if (debtCheck.hasPendingDebt) {
      return { ok: false, formError: 'pending_debt', reason: 'pending_debt' }
    }
  }

  const { error } = await supabase
    .from('accounts')
    .update({ is_active: false })
    .eq('id', id)
    .eq('user_id', userId)

  if (error) return { ok: false, formError: await translatePostgresError(error.code, 'account') }

  revalidatePath('/accounts')
  revalidatePath('/cards')
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

  if (error) return { ok: false, formError: await translatePostgresError(error.code, 'account') }

  revalidatePath('/accounts')
  return { ok: true }
}

// ── deleteAccount ─────────────────────────────────────────────────────────────

export async function deleteAccount(id: string): Promise<ActionResult<never>> {
  const userId = await getAuthenticatedUserId()
  const supabase = await createClient()

  // Block delete if the account has any transaction history (either as source
  // or as transfer destination). Archive must be used instead for accounts with
  // history — see openspec/specs/accounts/spec.md.
  const { data: existingTx, error: txError } = await supabase
    .from('transactions')
    .select('id')
    .or(`account_id.eq.${id},transfer_destination_account_id.eq.${id}`)
    .limit(1)

  if (txError) return { ok: false, formError: txError.message }

  if (existingTx && existingTx.length > 0) {
    return {
      ok: false,
      formError: 'Esta cuenta tiene movimientos. Archivala para preservar el historial.',
    }
  }

  const { error } = await supabase
    .from('accounts')
    .delete()
    .eq('id', id)
    .eq('user_id', userId)

  if (error) return { ok: false, formError: await translatePostgresError(error.code, 'account') }

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
  const today = formatDateISO(getTodayAR())

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
      initial_balance: normalizeActionMoney(validation.data.initial_balance),
      initial_balance_date: today,
      is_active: true,
    },
    { onConflict: 'account_id,currency_code' },
  )

  if (error) return { ok: false, formError: await translatePostgresError(error.code, 'account') }

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

  const txSums = (await getTransactionSums([accountId])).get(accountId) ?? { ARS: 0, USD: 0 }
  const totalBalance = Money.add(
    Money.from(target.initial_balance),
    Money.from(txSums[currencyCode] ?? 0),
  )

  if (!Money.isZero(totalBalance)) {
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

  if (error) return { ok: false, formError: await translatePostgresError(error.code, 'account') }

  revalidatePath('/accounts')
  return { ok: true }
}
