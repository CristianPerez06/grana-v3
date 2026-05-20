'use server'

import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import {
  perfilSchema,
  saldoActualSchema,
  validateActionInput,
  type PerfilInput,
  type SaldoActualInput,
} from '@grana/validation'
import type { ActionResult } from './types'

export const savePerfilAction = async (
  input: unknown,
): Promise<ActionResult<PerfilInput>> => {
  const validation = await validateActionInput(perfilSchema, input)
  if (!validation.ok) return { ok: false, fieldErrors: validation.fieldErrors }

  const { mode, has_bank_account, institution_id, bank_account_name } = validation.data

  const supabase = await createClient()
  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError || !userData.user) {
    const t = await getTranslations('onboarding.errors')
    return { ok: false, formError: t('generic') }
  }

  const { error: updateError } = await supabase
    .from('profiles')
    .update({ mode })
    .eq('id', userData.user.id)

  if (updateError) {
    const t = await getTranslations('onboarding.errors')
    return { ok: false, formError: t('generic') }
  }

  if (mode === 'experto' && has_bank_account && institution_id && bank_account_name) {
    const { data: account, error: accountError } = await supabase
      .from('accounts')
      .insert({
        user_id: userData.user.id,
        name: bank_account_name,
        type: 'bank',
        institution_id,
      })
      .select('id')
      .single()

    if (accountError || !account) {
      const t = await getTranslations('onboarding.errors')
      return { ok: false, formError: t('generic') }
    }

    const { error: currenciesError } = await supabase
      .from('account_currencies')
      .insert([
        { account_id: account.id, currency_code: 'ARS', initial_balance: 0 },
        { account_id: account.id, currency_code: 'USD', initial_balance: 0 },
      ])

    if (currenciesError) {
      // Rollback: delete the orphan account so the wizard can retry cleanly.
      await supabase.from('accounts').delete().eq('id', account.id)
      const t = await getTranslations('onboarding.errors')
      return { ok: false, formError: t('generic') }
    }
  }

  return { ok: true }
}

export const saveSaldoActualAction = async (
  input: unknown,
): Promise<ActionResult<SaldoActualInput>> => {
  const validation = await validateActionInput(saldoActualSchema, input)
  if (!validation.ok) return { ok: false, fieldErrors: validation.fieldErrors }

  const {
    primary_account_id,
    primary_ars,
    primary_usd,
    cash_account_id,
    cash_ars,
    cash_usd,
  } = validation.data

  const supabase = await createClient()
  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError || !userData.user) {
    const t = await getTranslations('onboarding.errors')
    return { ok: false, formError: t('generic') }
  }

  const updates: Array<{
    account_id: string
    currency_code: 'ARS' | 'USD'
    amount: number
  }> = []

  if (primary_ars !== undefined && primary_ars > 0) {
    updates.push({ account_id: primary_account_id, currency_code: 'ARS', amount: primary_ars })
  }
  if (primary_usd !== undefined && primary_usd > 0) {
    updates.push({ account_id: primary_account_id, currency_code: 'USD', amount: primary_usd })
  }
  if (cash_account_id && cash_ars !== undefined && cash_ars > 0) {
    updates.push({ account_id: cash_account_id, currency_code: 'ARS', amount: cash_ars })
  }
  if (cash_account_id && cash_usd !== undefined && cash_usd > 0) {
    updates.push({ account_id: cash_account_id, currency_code: 'USD', amount: cash_usd })
  }

  for (const u of updates) {
    const { error } = await supabase
      .from('account_currencies')
      .update({ initial_balance: u.amount })
      .eq('account_id', u.account_id)
      .eq('currency_code', u.currency_code)

    if (error) {
      const t = await getTranslations('onboarding.errors')
      return { ok: false, formError: t('generic') }
    }
  }

  return { ok: true }
}

export const completeOnboardingAction = async (): Promise<ActionResult<never>> => {
  const supabase = await createClient()
  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError || !userData.user) {
    const t = await getTranslations('onboarding.errors')
    return { ok: false, formError: t('generic') }
  }

  const { data: existing } = await supabase
    .from('profiles')
    .select('onboarding_completed_at')
    .eq('id', userData.user.id)
    .single()

  if (existing?.onboarding_completed_at) {
    return { ok: true }
  }

  const { error } = await supabase
    .from('profiles')
    .update({ onboarding_completed_at: new Date().toISOString() })
    .eq('id', userData.user.id)

  if (error) {
    const t = await getTranslations('onboarding.errors')
    return { ok: false, formError: t('generic') }
  }

  return { ok: true }
}

