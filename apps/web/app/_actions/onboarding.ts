'use server'

import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import {
  initialBalanceSchema,
  validateActionInput,
  type InitialBalanceInput,
} from '@grana/validation'
import type { ActionResult } from './types'

export const saveInitialBalanceAction = async (
  input: unknown,
): Promise<ActionResult<InitialBalanceInput>> => {
  const validation = await validateActionInput(initialBalanceSchema, input)
  if (!validation.ok) return { ok: false, fieldErrors: validation.fieldErrors }

  const { primary_account_id, primary_ars, primary_usd } = validation.data

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
