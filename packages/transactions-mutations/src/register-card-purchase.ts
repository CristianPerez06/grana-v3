import type { GranaSupabaseClient } from '@grana/supabase'
import {
  normalizeMoneyAmount,
  registerCardPurchaseSchema,
  validateActionInput,
  type RegisterCardPurchaseInput,
} from '@grana/validation'
import { applySharedSplits } from './internal/shared-splits'
import {
  getCardPeriodsWithStatus,
  getOrCreatePeriodForDate,
  CardPurchasePredatesHistoryError,
} from './internal/card-periods'
import { insertDeclaredReimbursement } from './internal/declared-reimbursement'

export type RegisterCardPurchaseArgs = {
  supabase: GranaSupabaseClient
  userId: string
  input: unknown
  today: Date
}

export type RegisterCardPurchaseResult =
  | { ok: true; id: string }
  | {
      ok: false
      fieldErrors?: Partial<Record<keyof RegisterCardPurchaseInput, string>>
      formError?: string
    }

function normalizeMoney(value: number): number {
  return normalizeMoneyAmount(value) ?? value
}

function normalizeFxRate(value: number): number {
  return normalizeMoneyAmount(value, { decimalPlaces: 6 }) ?? value
}

/** ISO date → DD/MM/AAAA for user-facing messages. */
function formatHistoryDate(iso: string): string {
  return iso.split('-').reverse().join('/')
}

/**
 * Orchestrator for the single-row card purchase flow (1×, no installment
 * children). Variants: declared reimbursement (rollback the expense if it
 * fails) and shared split (rollback if it fails).
 *
 * Does NOT handle auth or cache invalidation. The caller verifies the user,
 * supplies the supabase client, and invalidates caches on success.
 */
export async function registerCardPurchase(
  args: RegisterCardPurchaseArgs,
): Promise<RegisterCardPurchaseResult> {
  const { supabase, userId, input, today } = args

  const validation = await validateActionInput(registerCardPurchaseSchema, input)
  if (!validation.ok) return { ok: false, fieldErrors: validation.fieldErrors }

  const data = validation.data

  const { data: account, error: accountError } = await supabase
    .from('accounts')
    .select('type, is_active')
    .eq('id', data.account_id)
    .eq('user_id', userId)
    .single()

  if (accountError || !account) {
    return { ok: false, formError: 'Tarjeta no encontrada.' }
  }
  if (account.type !== 'credit') {
    return { ok: false, formError: 'Esta acción solo aplica a tarjetas de crédito.' }
  }
  if (!account.is_active) {
    return { ok: false, formError: 'Esta tarjeta está archivada.' }
  }

  let periodId: string
  try {
    periodId = await getOrCreatePeriodForDate(supabase, data.account_id, data.date, today)
  } catch (e) {
    if (e instanceof CardPurchasePredatesHistoryError) {
      return {
        ok: false,
        formError: `La fecha del consumo es anterior al primer resumen de la tarjeta (${formatHistoryDate(e.oldestStartDate)}). Grana registra consumos desde ese resumen en adelante.`,
      }
    }
    return { ok: false, formError: 'No se pudo asignar un período a esta fecha.' }
  }

  const periods = await getCardPeriodsWithStatus(supabase, data.account_id)
  const targetPeriod = periods.find((p) => p.id === periodId)
  if (targetPeriod && targetPeriod.has_payment) {
    return {
      ok: false,
      formError:
        'No podés registrar consumos en un período ya pagado. Elegí una fecha en un período abierto.',
    }
  }

  const dueDate = targetPeriod?.due_date ?? null

  const { data: tx, error: txError } = await supabase
    .from('transactions')
    .insert({
      user_id: userId,
      account_id: data.account_id,
      type: 'expense',
      amount: normalizeMoney(data.amount),
      currency_code: data.currency_code,
      date: data.date,
      category_id: data.category_id,
      subcategory_id: data.subcategory_id ?? null,
      description: data.description ?? null,
      status: 'pending',
      card_period_id: periodId,
      due_date: dueDate,
      fx_rate_to_ars: data.fx_rate_to_ars != null ? normalizeFxRate(data.fx_rate_to_ars) : null,
      is_parent: false,
    })
    .select('id')
    .single()

  if (txError || !tx) {
    return { ok: false, formError: txError?.message ?? 'Error al registrar el consumo.' }
  }

  if (data.reimbursement) {
    // A statement reimbursement nets in a card period; default it to the
    // purchase's period (required when it is received now).
    const declaration =
      data.reimbursement.target === 'statement'
        ? { ...data.reimbursement, card_period_id: data.reimbursement.card_period_id ?? periodId }
        : data.reimbursement
    const r = await insertDeclaredReimbursement(supabase, {
      userId,
      expenseId: tx.id,
      currencyCode: data.currency_code,
      declaration,
      shared: data.shared,
      today,
    })
    if (!r.ok) {
      await supabase.from('transactions').delete().eq('id', tx.id).eq('user_id', userId)
      return { ok: false, formError: `El consumo no se guardó (reintegro inválido): ${r.error}` }
    }
  }

  if (data.shared) {
    const s = await applySharedSplits(
      supabase,
      { household_id: data.shared.household_id, splits: data.shared.splits },
      [{ transactionId: tx.id, amount: normalizeMoney(data.amount) }],
    )
    if (!s.ok) {
      await supabase.from('transactions').delete().eq('id', tx.id).eq('user_id', userId)
      return { ok: false, formError: `El consumo no se guardó (compartido inválido): ${s.error}` }
    }
  }

  return { ok: true, id: tx.id }
}
