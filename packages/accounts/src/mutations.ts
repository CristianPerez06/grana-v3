import type { GranaSupabaseClient } from '@grana/supabase'
import { formatDateISO } from '@grana/money-logic'
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
import { getCreditCardDebtCheck } from '@grana/cards'
import { getTransactionSums } from './queries'

/**
 * Neutral mutation result. The web action wrapper maps this to `ActionResult`:
 * `errorCode` (a raw Postgres code) is translated to a user-facing message via
 * `translatePostgresError` (web i18n, can't live in the package); `formError`
 * (already a domain message) and `fieldErrors`/`reason`/`id` pass through.
 */
export type AccountMutationResult<T = never> =
  | { ok: true; id?: string }
  | {
      ok: false
      fieldErrors?: Partial<Record<keyof T, string>>
      formError?: string
      errorCode?: string
      reason?: string
    }

function normalizeActionMoney(value: number): number {
  return normalizeMoneyAmount(value) ?? value
}

// ── createAccount ─────────────────────────────────────────────────────────────

export async function createAccount(args: {
  supabase: GranaSupabaseClient
  userId: string
  input: unknown
  today: Date
}): Promise<AccountMutationResult<CreateAccountInput>> {
  const { supabase, userId, input } = args
  const validation = await validateActionInput(createAccountSchema, input)
  if (!validation.ok) return { ok: false, fieldErrors: validation.fieldErrors }

  const today = formatDateISO(args.today)

  const { data: account, error: accountError } = await supabase
    .from('accounts')
    .insert({
      user_id: userId,
      name: validation.data.name,
      type: validation.data.type,
      institution_id: validation.data.institution_id ?? null,
      color_key: validation.data.color_key ?? null,
      icon_key: validation.data.icon_key ?? null,
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

  return { ok: true, id: account.id }
}

// ── updateAccount ─────────────────────────────────────────────────────────────

export async function updateAccount(args: {
  supabase: GranaSupabaseClient
  userId: string
  id: string
  input: unknown
}): Promise<AccountMutationResult<UpdateAccountInput>> {
  const { supabase, userId, id, input } = args
  const validation = await validateActionInput(updateAccountSchema, input)
  if (!validation.ok) return { ok: false, fieldErrors: validation.fieldErrors }

  const updates: {
    name?: string
    institution_id?: string | null
    color_key?: string | null
    icon_key?: string | null
  } = {}
  if (validation.data.name !== undefined) updates.name = validation.data.name
  if (validation.data.institution_id !== undefined) {
    updates.institution_id = validation.data.institution_id
  }
  // undefined = leave unchanged; null = explicitly revert to auto.
  if (validation.data.color_key !== undefined) updates.color_key = validation.data.color_key ?? null
  if (validation.data.icon_key !== undefined) updates.icon_key = validation.data.icon_key ?? null

  const { error } = await supabase
    .from('accounts')
    .update(updates)
    .eq('id', id)
    .eq('user_id', userId)

  if (error) return { ok: false, errorCode: error.code }

  return { ok: true }
}

// ── archiveAccount ────────────────────────────────────────────────────────────

export async function archiveAccount(args: {
  supabase: GranaSupabaseClient
  userId: string
  id: string
  today: Date
}): Promise<AccountMutationResult> {
  const { supabase, userId, id, today } = args

  // For credit accounts, enforce R-tarjeta (no pending debt before archiving)
  const { data: account } = await supabase
    .from('accounts')
    .select('type')
    .eq('id', id)
    .eq('user_id', userId)
    .single()

  if (account?.type === 'credit') {
    const debtCheck = await getCreditCardDebtCheck(supabase, id, today)
    if (debtCheck.hasPendingDebt) {
      return { ok: false, formError: 'pending_debt', reason: 'pending_debt' }
    }
  }

  const { error } = await supabase
    .from('accounts')
    .update({ is_active: false })
    .eq('id', id)
    .eq('user_id', userId)

  if (error) return { ok: false, errorCode: error.code }

  return { ok: true }
}

// ── reactivateAccount ─────────────────────────────────────────────────────────

export async function reactivateAccount(args: {
  supabase: GranaSupabaseClient
  userId: string
  id: string
}): Promise<AccountMutationResult> {
  const { supabase, userId, id } = args

  const { error } = await supabase
    .from('accounts')
    .update({ is_active: true })
    .eq('id', id)
    .eq('user_id', userId)

  if (error) return { ok: false, errorCode: error.code }

  return { ok: true }
}

// ── deleteAccount ─────────────────────────────────────────────────────────────

export async function deleteAccount(args: {
  supabase: GranaSupabaseClient
  userId: string
  id: string
}): Promise<AccountMutationResult> {
  const { supabase, userId, id } = args

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

  if (error) return { ok: false, errorCode: error.code }

  return { ok: true }
}

// ── addCurrencyToAccount ──────────────────────────────────────────────────────

export async function addCurrencyToAccount(args: {
  supabase: GranaSupabaseClient
  userId: string
  accountId: string
  input: unknown
  today: Date
}): Promise<AccountMutationResult<AddCurrencyInput>> {
  const { supabase, userId, accountId, input } = args
  const validation = await validateActionInput(addCurrencySchema, input)
  if (!validation.ok) return { ok: false, fieldErrors: validation.fieldErrors }

  const today = formatDateISO(args.today)

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

  if (error) return { ok: false, errorCode: error.code }

  return { ok: true }
}

// ── deactivateCurrencyFromAccount ─────────────────────────────────────────────

export async function deactivateCurrencyFromAccount(args: {
  supabase: GranaSupabaseClient
  userId: string
  accountId: string
  currencyCode: 'ARS' | 'USD'
}): Promise<AccountMutationResult> {
  const { supabase, userId, accountId, currencyCode } = args

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

  const txSums = (await getTransactionSums(supabase, [accountId])).get(accountId) ?? { ARS: 0, USD: 0 }
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

  if (error) return { ok: false, errorCode: error.code }

  return { ok: true }
}
