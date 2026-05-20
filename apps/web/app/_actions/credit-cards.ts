'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getTodayAR } from '@/lib/date'
import {
  createCreditCardSchema,
  createNovatoCreditCardSchema,
  registerCardPurchaseSchema,
  registerInstallmentsSchema,
  payCardPeriodSchema,
  updatePeriodDatesSchema,
  validateActionInput,
  Money,
  normalizeMoneyAmount,
  type CreateCreditCardInput,
  type CreateNovatoCreditCardInput,
  type RegisterCardPurchaseInput,
  type RegisterInstallmentsInput,
  type PayCardPeriodInput,
  type UpdatePeriodDatesInput,
} from '@grana/validation'
import {
  getCreditCardDebtCheck,
  getCardPeriodsWithStatus,
  getOrCreatePeriodForDate,
} from '@/lib/cards/queries'
import {
  derivePeriodStatus,
  splitAmountIntoInstallments,
  addDaysToISO,
  addMonthsToISO,
  formatDateISO,
} from '@/lib/cards/utils'
import type { ActionResult } from './types'

function normalizeActionMoney(value: number): number {
  return normalizeMoneyAmount(value) ?? value
}

function normalizeActionFxRate(value: number): number {
  return normalizeMoneyAmount(value, { decimalPlaces: 6 }) ?? value
}

async function getAuthenticatedUserId(): Promise<string> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')
  return user.id
}

// ── 4.1: createCreditCard (experto, 4 fechas) ─────────────────────────────────

export async function createCreditCard(
  input: unknown,
): Promise<ActionResult<CreateCreditCardInput> & { id?: string }> {
  const validation = await validateActionInput(createCreditCardSchema, input)
  if (!validation.ok) return { ok: false, fieldErrors: validation.fieldErrors }

  const today = getTodayAR()
  const todayStr = formatDateISO(today)
  const data = validation.data

  // Sanity: current_end_date must be within ±40 days of today
  if (data.current_end_date < addDaysToISO(todayStr, -40)) {
    return { ok: false, formError: 'La fecha de cierre actual es demasiado antigua.' }
  }
  // Sanity: next_due_date must be within 90 days
  if (data.next_due_date > addDaysToISO(todayStr, 90)) {
    return { ok: false, formError: 'La fecha de vencimiento próximo es demasiado lejana.' }
  }

  const userId = await getAuthenticatedUserId()
  const supabase = await createClient()

  // Build auto name if not provided: "Network Banco"
  let cardName = data.name?.trim() ?? ''
  if (!cardName) {
    let networkLabel = data.other_network_name ?? ''
    if (data.network_id) {
      const { data: network } = await supabase
        .from('card_networks')
        .select('name')
        .eq('id', data.network_id)
        .single()
      networkLabel = network?.name ?? ''
    }
    const { data: institution } = await supabase
      .from('institutions')
      .select('name')
      .eq('id', data.institution_id)
      .single()
    cardName = [networkLabel, institution?.name].filter(Boolean).join(' ') || 'Tarjeta'
  }

  // INSERT account
  const { data: account, error: accountError } = await supabase
    .from('accounts')
    .insert({
      user_id: userId,
      name: cardName,
      type: 'credit',
      institution_id: data.institution_id,
      network_id: data.network_id ?? null,
      other_network_name: data.other_network_name ?? null,
      credit_limit: data.credit_limit != null ? normalizeActionMoney(data.credit_limit) : null,
    })
    .select('id')
    .single()

  if (accountError || !account) {
    return { ok: false, formError: accountError?.message ?? 'Error al crear la tarjeta.' }
  }

  // INSERT account_currencies (ARS forced, initial_balance=0)
  const currencyRows = data.currencies.map((c) => ({
    account_id: account.id,
    currency_code: c.currency_code,
    initial_balance: 0,
    initial_balance_date: todayStr,
  }))

  const { error: currencyError } = await supabase
    .from('account_currencies')
    .insert(currencyRows)

  if (currencyError) {
    await supabase.from('accounts').delete().eq('id', account.id)
    return { ok: false, formError: currencyError.message }
  }

  // INSERT 2 card_periods
  // P1: start=current_end-30d, end=current_end, due=current_due
  // P2: start=current_end+1d, end=next_end, due=next_due
  const periodRows = [
    {
      account_id: account.id,
      start_date: addDaysToISO(data.current_end_date, -30),
      end_date: data.current_end_date,
      due_date: data.current_due_date,
      is_estimated: false,
    },
    {
      account_id: account.id,
      start_date: addDaysToISO(data.current_end_date, 1),
      end_date: data.next_end_date,
      due_date: data.next_due_date,
      is_estimated: false,
    },
  ]

  const { error: periodsError } = await supabase.from('card_periods').insert(periodRows)

  if (periodsError) {
    await supabase.from('accounts').delete().eq('id', account.id)
    return { ok: false, formError: periodsError.message }
  }

  revalidatePath('/cards')
  revalidatePath('/accounts')
  return { ok: true, id: account.id }
}

// ── 4.2: createNovatoCreditCard (onboarding novato, 1 fecha) ──────────────────

export async function createNovatoCreditCard(
  input: unknown,
): Promise<ActionResult<CreateNovatoCreditCardInput> & { id?: string }> {
  const validation = await validateActionInput(createNovatoCreditCardSchema, input)
  if (!validation.ok) return { ok: false, fieldErrors: validation.fieldErrors }

  const today = getTodayAR()
  const todayStr = formatDateISO(today)
  const { close_date } = validation.data

  // Sanity: close_date must not be before today - 7 days
  if (close_date < addDaysToISO(todayStr, -7)) {
    return {
      ok: false,
      formError: 'Tomá la fecha del próximo cierre que figura en tu resumen del banco.',
    }
  }

  const userId = await getAuthenticatedUserId()
  const supabase = await createClient()

  const { data: account, error: accountError } = await supabase
    .from('accounts')
    .insert({
      user_id: userId,
      name: 'Mi tarjeta',
      type: 'credit',
      institution_id: null,
      network_id: null,
      other_network_name: 'Mi tarjeta',
      credit_limit: null,
    })
    .select('id')
    .single()

  if (accountError || !account) {
    return { ok: false, formError: accountError?.message ?? 'Error al crear la tarjeta.' }
  }

  const { error: currencyError } = await supabase.from('account_currencies').insert({
    account_id: account.id,
    currency_code: 'ARS',
    initial_balance: 0,
    initial_balance_date: todayStr,
  })

  if (currencyError) {
    await supabase.from('accounts').delete().eq('id', account.id)
    return { ok: false, formError: currencyError.message }
  }

  // P1: start=close_date-30d, end=close_date, due=close_date+15d
  // P2: start=close_date+1d, end=close_date+30d, due=close_date+45d
  const periodRows = [
    {
      account_id: account.id,
      start_date: addDaysToISO(close_date, -30),
      end_date: close_date,
      due_date: addDaysToISO(close_date, 15),
      is_estimated: true,
    },
    {
      account_id: account.id,
      start_date: addDaysToISO(close_date, 1),
      end_date: addDaysToISO(close_date, 30),
      due_date: addDaysToISO(close_date, 45),
      is_estimated: true,
    },
  ]

  const { error: periodsError } = await supabase.from('card_periods').insert(periodRows)

  if (periodsError) {
    await supabase.from('accounts').delete().eq('id', account.id)
    return { ok: false, formError: periodsError.message }
  }

  revalidatePath('/cards')
  revalidatePath('/accounts')
  return { ok: true, id: account.id }
}

// ── 4.3: registerCardPurchase ─────────────────────────────────────────────────

export async function registerCardPurchase(
  input: unknown,
): Promise<ActionResult<RegisterCardPurchaseInput> & { id?: string }> {
  const validation = await validateActionInput(registerCardPurchaseSchema, input)
  if (!validation.ok) return { ok: false, fieldErrors: validation.fieldErrors }

  const userId = await getAuthenticatedUserId()
  const supabase = await createClient()
  const data = validation.data

  // Verify account belongs to user and is a credit card
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

  // Find or create the period that covers txDate
  let periodId: string
  try {
    periodId = await getOrCreatePeriodForDate(data.account_id, data.date)
  } catch {
    return { ok: false, formError: 'No se pudo asignar un período a esta fecha.' }
  }

  // Verify the period is not paid (backdating check)
  const periods = await getCardPeriodsWithStatus(data.account_id)
  const targetPeriod = periods.find((p) => p.id === periodId)
  if (targetPeriod && targetPeriod.has_payment) {
    return {
      ok: false,
      formError:
        'No podés registrar consumos en un período ya pagado. Elegí una fecha en un período abierto.',
    }
  }

  const today = getTodayAR()
  const dueDate = targetPeriod?.due_date ?? null

  const { data: tx, error: txError } = await supabase
    .from('transactions')
    .insert({
      user_id: userId,
      account_id: data.account_id,
      type: 'expense',
      amount: normalizeActionMoney(data.amount),
      currency_code: data.currency_code,
      date: data.date,
      category_id: data.category_id,
      subcategory_id: data.subcategory_id ?? null,
      description: data.description ?? null,
      status: 'pending',
      card_period_id: periodId,
      due_date: dueDate,
      fx_rate_to_ars: data.fx_rate_to_ars != null ? normalizeActionFxRate(data.fx_rate_to_ars) : null,
      is_parent: false,
    })
    .select('id')
    .single()

  if (txError || !tx) {
    return { ok: false, formError: txError?.message ?? 'Error al registrar el consumo.' }
  }

  revalidatePath('/cards')
  revalidatePath('/transactions')
  return { ok: true, id: tx.id }
}

// ── 4.4: registerInstallments ─────────────────────────────────────────────────

export async function registerInstallments(
  input: unknown,
): Promise<ActionResult<RegisterInstallmentsInput> & { parentId?: string }> {
  const validation = await validateActionInput(registerInstallmentsSchema, input)
  if (!validation.ok) return { ok: false, fieldErrors: validation.fieldErrors }

  const userId = await getAuthenticatedUserId()
  const supabase = await createClient()
  const data = validation.data
  const n = data.installments_total

  // Verify account
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
    return { ok: false, formError: 'Las cuotas solo aplican a tarjetas de crédito.' }
  }

  // Split amounts (residue on first installment)
  const normalizedAmount = normalizeActionMoney(data.amount)
  const installmentAmounts = splitAmountIntoInstallments(normalizedAmount, n)

  // Pre-compute dates and periods for all N installments
  const installmentDates: string[] = []
  for (let i = 0; i < n; i++) {
    installmentDates.push(addMonthsToISO(data.date, i))
  }

  // Ensure periods exist for all installment dates (rolling)
  const periodIds: string[] = []
  for (const txDate of installmentDates) {
    try {
      const periodId = await getOrCreatePeriodForDate(data.account_id, txDate)
      periodIds.push(periodId)
    } catch {
      return {
        ok: false,
        formError: `No se pudo asignar un período para la cuota del ${txDate}.`,
      }
    }
  }

  // Check no period is already paid (backdating check)
  const periods = await getCardPeriodsWithStatus(data.account_id)
  const paidPeriodIds = new Set(periods.filter((p) => p.has_payment).map((p) => p.id))
  for (const pid of periodIds) {
    if (paidPeriodIds.has(pid)) {
      return {
        ok: false,
        formError: 'Una o más cuotas caerían en un período ya pagado.',
      }
    }
  }

  // INSERT parent (off-ledger)
  const { data: parent, error: parentError } = await supabase
    .from('transactions')
    .insert({
      user_id: userId,
      account_id: null,
      type: 'expense',
      amount: normalizedAmount,
      currency_code: 'ARS',
      date: data.date,
      category_id: data.category_id,
      subcategory_id: data.subcategory_id ?? null,
      description: data.description ?? null,
      is_parent: true,
      installments_total: n,
    })
    .select('id')
    .single()

  if (parentError || !parent) {
    return { ok: false, formError: parentError?.message ?? 'Error al crear la compra.' }
  }

  // INSERT N children
  const childRows = installmentAmounts.map((installmentMoney, i) => {
    const txDate = installmentDates[i]
    const periodId = periodIds[i]
    const period = periods.find((p) => p.id === periodId)

    return {
      user_id: userId,
      account_id: data.account_id,
      type: 'expense' as const,
      amount: Money.toNumber(installmentMoney),
      currency_code: 'ARS',
      date: txDate,
      category_id: data.category_id,
      subcategory_id: data.subcategory_id ?? null,
      description: data.description ?? null,
      is_parent: false,
      parent_id: parent.id,
      status: 'pending' as const,
      card_period_id: periodId,
      due_date: period?.due_date ?? null,
      installment_n: i + 1,
      installments_total: n,
    }
  })

  const { error: childrenError } = await supabase.from('transactions').insert(childRows)

  if (childrenError) {
    await supabase.from('transactions').delete().eq('id', parent.id)
    return { ok: false, formError: childrenError.message }
  }

  revalidatePath('/cards')
  revalidatePath('/transactions')
  return { ok: true, parentId: parent.id }
}

// ── 4.5: payCardPeriod ────────────────────────────────────────────────────────

export async function payCardPeriod(
  input: unknown,
): Promise<ActionResult<PayCardPeriodInput> & { expenseId?: string }> {
  const validation = await validateActionInput(payCardPeriodSchema, input)
  if (!validation.ok) return { ok: false, fieldErrors: validation.fieldErrors }

  const userId = await getAuthenticatedUserId()
  const supabase = await createClient()
  const data = validation.data

  // Verify period ownership
  const { data: period, error: periodError } = await supabase
    .from('card_periods')
    .select('id, account_id, start_date, end_date, due_date')
    .eq('id', data.period_id)
    .single()

  if (periodError || !period) {
    return { ok: false, formError: 'Período no encontrado.' }
  }

  const { data: account, error: accountError } = await supabase
    .from('accounts')
    .select('user_id, name')
    .eq('id', period.account_id)
    .eq('user_id', userId)
    .single()

  if (accountError || !account) {
    return { ok: false, formError: 'No tenés acceso a este período.' }
  }

  // Verify period is not already paid
  const { data: existingPayment } = await supabase
    .from('period_payments')
    .select('id')
    .eq('period_id', data.period_id)
    .maybeSingle()

  if (existingPayment) {
    return { ok: false, formError: 'Este período ya fue pagado.' }
  }

  // Verify period is closed or overdue (not open)
  const today = getTodayAR()
  const status = derivePeriodStatus(period, today, false)
  if (status === 'open') {
    return {
      ok: false,
      formError: 'El período aún no cerró. Solo podés pagar períodos cerrados o vencidos.',
    }
  }

  // Verify payment account belongs to user
  const { data: paymentAccount, error: paymentAccountError } = await supabase
    .from('accounts')
    .select('type, is_active')
    .eq('id', data.payment_account_id)
    .eq('user_id', userId)
    .single()

  if (paymentAccountError || !paymentAccount) {
    return { ok: false, formError: 'Cuenta de pago no encontrada.' }
  }
  if (paymentAccount.type === 'credit') {
    return { ok: false, formError: 'No podés pagar un resumen desde otra tarjeta.' }
  }

  // Find the last known period for this card (to determine where to append the new one)
  const { data: lastPeriodRow, error: lastPeriodError } = await supabase
    .from('card_periods')
    .select('end_date')
    .eq('account_id', period.account_id)
    .order('end_date', { ascending: false })
    .limit(1)
    .single()

  if (lastPeriodError || !lastPeriodRow) {
    return { ok: false, formError: 'No se pudo determinar el último período de la tarjeta.' }
  }

  // Sanity: new end_date must be after the last known period's end
  if (data.next_end_date <= lastPeriodRow.end_date) {
    return {
      ok: false,
      formError: 'La fecha de cierre debe ser posterior al último resumen conocido.',
    }
  }

  // 1. INSERT expense on payment account
  const { data: expense, error: expenseError } = await supabase
    .from('transactions')
    .insert({
      user_id: userId,
      account_id: data.payment_account_id,
      type: 'expense',
      amount: normalizeActionMoney(data.amount),
      currency_code: 'ARS',
      date: data.payment_date,
      category_id: null,
      description: `Pago de tarjeta ${account.name}`,
      is_parent: false,
      status: null,
      card_period_id: null,
    })
    .select('id')
    .single()

  if (expenseError || !expense) {
    return { ok: false, formError: expenseError?.message ?? 'Error al registrar el pago.' }
  }

  // 2. UPDATE child transactions to 'paid'
  const { error: updateError } = await supabase
    .from('transactions')
    .update({ status: 'paid' })
    .eq('card_period_id', data.period_id)
    .eq('status', 'pending')

  if (updateError) {
    await supabase.from('transactions').delete().eq('id', expense.id)
    return { ok: false, formError: updateError.message }
  }

  // 3. INSERT period_payment
  const { error: paymentError } = await supabase.from('period_payments').insert({
    period_id: data.period_id,
    transaction_id: expense.id,
  })

  if (paymentError) {
    // Rollback: revert transactions to pending and delete expense
    await supabase
      .from('transactions')
      .update({ status: 'pending' })
      .eq('card_period_id', data.period_id)
      .eq('status', 'paid')
    await supabase.from('transactions').delete().eq('id', expense.id)
    return { ok: false, formError: paymentError.message }
  }

  // 4. INSERT next card_period starting after the last known period
  // lastPeriodRow.end_date is the furthest end_date for this card (e.g. P2 when paying P1)
  const newPeriodStartDate = addDaysToISO(lastPeriodRow.end_date, 1)
  const { error: nextPeriodError } = await supabase.from('card_periods').upsert(
    {
      account_id: period.account_id,
      start_date: newPeriodStartDate,
      end_date: data.next_end_date,
      due_date: data.next_due_date,
      is_estimated: false,
    },
    { onConflict: 'account_id,start_date' },
  )

  if (nextPeriodError) {
    // Rollback: delete period_payment, revert transactions, delete expense
    await supabase.from('period_payments').delete().eq('period_id', data.period_id)
    await supabase
      .from('transactions')
      .update({ status: 'pending' })
      .eq('card_period_id', data.period_id)
      .eq('status', 'paid')
    await supabase.from('transactions').delete().eq('id', expense.id)
    return { ok: false, formError: nextPeriodError.message }
  }

  revalidatePath('/cards')
  revalidatePath('/transactions')
  return { ok: true, expenseId: expense.id }
}

// ── 4.6: reverseCardPayment ───────────────────────────────────────────────────

export async function reverseCardPayment(
  paymentId: string,
): Promise<ActionResult<never>> {
  const userId = await getAuthenticatedUserId()
  const supabase = await createClient()

  // Fetch payment with linked period and transaction
  const { data: payment, error: fetchError } = await supabase
    .from('period_payments')
    .select('id, period_id, transaction_id')
    .eq('id', paymentId)
    .single()

  if (fetchError || !payment) {
    return { ok: false, formError: 'Pago no encontrado.' }
  }

  // Verify ownership via the period → account → user chain
  const { data: period, error: periodError } = await supabase
    .from('card_periods')
    .select('account_id, end_date')
    .eq('id', payment.period_id)
    .single()

  if (periodError || !period) {
    return { ok: false, formError: 'Período no encontrado.' }
  }

  const { data: ownerCheck, error: ownerError } = await supabase
    .from('accounts')
    .select('id')
    .eq('id', period.account_id)
    .eq('user_id', userId)
    .single()

  if (ownerError || !ownerCheck) {
    return { ok: false, formError: 'No tenés acceso a este pago.' }
  }

  // 1. Revert child transactions to 'pending'
  const { error: revertError } = await supabase
    .from('transactions')
    .update({ status: 'pending' })
    .eq('card_period_id', payment.period_id)
    .eq('status', 'paid')

  if (revertError) {
    return { ok: false, formError: revertError.message }
  }

  // 2. DELETE period_payment
  const { error: deletePaymentError } = await supabase
    .from('period_payments')
    .delete()
    .eq('id', paymentId)

  if (deletePaymentError) {
    // Rollback: re-mark transactions as paid
    await supabase
      .from('transactions')
      .update({ status: 'paid' })
      .eq('card_period_id', payment.period_id)
      .eq('status', 'pending')
    return { ok: false, formError: deletePaymentError.message }
  }

  // 3. DELETE the expense transaction
  const { error: deleteExpenseError } = await supabase
    .from('transactions')
    .delete()
    .eq('id', payment.transaction_id)

  if (deleteExpenseError) {
    // Rollback is complex here — log and surface error but don't leave orphaned state
    return { ok: false, formError: deleteExpenseError.message }
  }

  // NOTE: the next card_period created during the payment is intentionally NOT deleted.
  // The user can manage it manually if needed.

  revalidatePath('/cards')
  revalidatePath('/transactions')
  return { ok: true }
}

// ── 4.7: updatePeriodDates ────────────────────────────────────────────────────

export async function updatePeriodDates(
  periodId: string,
  input: unknown,
): Promise<ActionResult<UpdatePeriodDatesInput>> {
  const validation = await validateActionInput(updatePeriodDatesSchema, input)
  if (!validation.ok) return { ok: false, fieldErrors: validation.fieldErrors }

  const userId = await getAuthenticatedUserId()
  const supabase = await createClient()
  const data = validation.data

  // Verify ownership
  const { data: period, error: periodError } = await supabase
    .from('card_periods')
    .select('account_id, start_date, end_date, due_date')
    .eq('id', periodId)
    .single()

  if (periodError || !period) {
    return { ok: false, formError: 'Período no encontrado.' }
  }

  const { data: ownerCheck } = await supabase
    .from('accounts')
    .select('id')
    .eq('id', period.account_id)
    .eq('user_id', userId)
    .single()

  if (!ownerCheck) {
    return { ok: false, formError: 'No tenés acceso a este período.' }
  }

  // Verify period is not paid
  const { data: existingPayment } = await supabase
    .from('period_payments')
    .select('id')
    .eq('period_id', periodId)
    .maybeSingle()

  if (existingPayment) {
    return { ok: false, formError: 'No podés editar las fechas de un período ya pagado.' }
  }

  // Chronological check: new end_date must come after start_date
  if (data.end_date <= period.start_date) {
    return {
      ok: false,
      formError: 'La fecha de cierre debe ser posterior al inicio del período.',
    }
  }

  const { error: updateError } = await supabase
    .from('card_periods')
    .update({
      end_date: data.end_date,
      due_date: data.due_date,
      is_estimated: false,
    })
    .eq('id', periodId)

  if (updateError) return { ok: false, formError: updateError.message }

  revalidatePath('/cards')
  return { ok: true }
}

// ── 4.8: deactivateCreditCardAccount (archive with R-tarjeta check) ───────────

export async function deactivateCreditCardAccount(
  accountId: string,
): Promise<ActionResult<never> & { reason?: string }> {
  const userId = await getAuthenticatedUserId()
  const supabase = await createClient()

  // Verify ownership
  const { data: account, error: accountError } = await supabase
    .from('accounts')
    .select('type')
    .eq('id', accountId)
    .eq('user_id', userId)
    .single()

  if (accountError || !account) {
    return { ok: false, formError: 'Tarjeta no encontrada.' }
  }
  if (account.type !== 'credit') {
    return { ok: false, formError: 'Esta acción solo aplica a tarjetas de crédito.' }
  }

  // R-tarjeta: block if pending debt exists
  const debtCheck = await getCreditCardDebtCheck(accountId)
  if (debtCheck.hasPendingDebt) {
    return { ok: false, formError: 'pending_debt', reason: 'pending_debt' }
  }

  const { error } = await supabase
    .from('accounts')
    .update({ is_active: false })
    .eq('id', accountId)
    .eq('user_id', userId)

  if (error) return { ok: false, formError: error.message }

  revalidatePath('/cards')
  revalidatePath('/accounts')
  return { ok: true }
}

// ── 4.9: updateCreditCard ─────────────────────────────────────────────────────

export async function updateCreditCard(
  id: string,
  input: unknown,
): Promise<ActionResult<never>> {
  // Allowed fields: name, institution_id, credit_limit
  // NOT allowed: type, network_id, other_network_name (immutable post-creation)
  const safeInput = input as Record<string, unknown>
  if ('type' in safeInput || 'network_id' in safeInput || 'other_network_name' in safeInput) {
    return { ok: false, formError: 'La red de la tarjeta no se puede modificar.' }
  }

  const userId = await getAuthenticatedUserId()
  const supabase = await createClient()

  const updates: { name?: string; institution_id?: string | null; credit_limit?: number | null } = {}

  if (typeof safeInput.name === 'string') {
    const trimmed = safeInput.name.trim()
    if (trimmed.length < 1 || trimmed.length > 50) {
      return { ok: false, formError: 'El nombre debe tener entre 1 y 50 caracteres.' }
    }
    updates.name = trimmed
  }
  if ('institution_id' in safeInput) {
    updates.institution_id = (safeInput.institution_id as string | null) ?? null
  }
  if ('credit_limit' in safeInput) {
    const limit = safeInput.credit_limit as number | null
    if (limit !== null && limit <= 0) {
      return { ok: false, formError: 'El límite de crédito debe ser un número positivo.' }
    }
    updates.credit_limit = limit != null ? normalizeActionMoney(limit) : limit
  }

  if (Object.keys(updates).length === 0) {
    return { ok: true }
  }

  const { error } = await supabase
    .from('accounts')
    .update(updates)
    .eq('id', id)
    .eq('user_id', userId)

  if (error) return { ok: false, formError: error.message }

  revalidatePath('/cards')
  revalidatePath('/accounts')
  return { ok: true }
}

// ── 4.10: updateInstallmentParent ─────────────────────────────────────────────

export async function updateInstallmentParent(
  parentId: string,
  input: unknown,
): Promise<ActionResult<never>> {
  const userId = await getAuthenticatedUserId()
  const supabase = await createClient()

  // Verify ownership
  const { data: parent, error: fetchError } = await supabase
    .from('transactions')
    .select('id, amount, date, category_id, subcategory_id, description, installments_total')
    .eq('id', parentId)
    .eq('user_id', userId)
    .eq('is_parent', true)
    .single()

  if (fetchError || !parent) {
    return { ok: false, formError: 'Compra en cuotas no encontrada.' }
  }

  const safeInput = input as Record<string, unknown>

  // Check if any child is already paid
  const { data: children, error: childrenError } = await supabase
    .from('transactions')
    .select('id, status, installment_n')
    .eq('parent_id', parentId)
    .eq('is_parent', false)

  if (childrenError) return { ok: false, formError: childrenError.message }

  const hasPaidChild = (children ?? []).some((c) => c.status === 'paid')

  // If trying to change amount/installments_total and any child is paid, reject
  if (hasPaidChild && ('amount' in safeInput || 'installments_total' in safeInput)) {
    return {
      ok: false,
      formError:
        'No podés modificar el monto de una compra que ya tiene cuotas pagadas.',
    }
  }

  // Always propagate category and description to all children
  const parentUpdates: Record<string, unknown> = {}
  const childUpdates: Record<string, unknown> = {}

  if ('category_id' in safeInput) {
    parentUpdates.category_id = safeInput.category_id
    childUpdates.category_id = safeInput.category_id
  }
  if ('subcategory_id' in safeInput) {
    parentUpdates.subcategory_id = safeInput.subcategory_id
    childUpdates.subcategory_id = safeInput.subcategory_id
  }
  if ('description' in safeInput) {
    parentUpdates.description = safeInput.description
    childUpdates.description = safeInput.description
  }

  // Update parent
  if (Object.keys(parentUpdates).length > 0) {
    const { error } = await supabase
      .from('transactions')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .update(parentUpdates as any)
      .eq('id', parentId)
    if (error) return { ok: false, formError: error.message }
  }

  // Propagate to children
  if (Object.keys(childUpdates).length > 0) {
    const { error } = await supabase
      .from('transactions')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .update(childUpdates as any)
      .eq('parent_id', parentId)
    if (error) return { ok: false, formError: error.message }
  }

  revalidatePath('/transactions')
  revalidatePath('/cards')
  return { ok: true }
}

// ── 4.11: deleteInstallmentParent ─────────────────────────────────────────────

export async function deleteInstallmentParent(
  parentId: string,
): Promise<ActionResult<never>> {
  const userId = await getAuthenticatedUserId()
  const supabase = await createClient()

  // Verify ownership
  const { data: parent, error: fetchError } = await supabase
    .from('transactions')
    .select('id')
    .eq('id', parentId)
    .eq('user_id', userId)
    .eq('is_parent', true)
    .single()

  if (fetchError || !parent) {
    return { ok: false, formError: 'Compra en cuotas no encontrada.' }
  }

  // Block if any child is paid
  const { data: paidChild } = await supabase
    .from('transactions')
    .select('id')
    .eq('parent_id', parentId)
    .eq('status', 'paid')
    .limit(1)
    .maybeSingle()

  if (paidChild) {
    return {
      ok: false,
      formError: 'No podés eliminar una compra con cuotas ya pagadas.',
    }
  }

  // DELETE parent (CASCADE deletes all children via FK)
  const { error } = await supabase
    .from('transactions')
    .delete()
    .eq('id', parentId)
    .eq('user_id', userId)

  if (error) return { ok: false, formError: error.message }

  revalidatePath('/transactions')
  revalidatePath('/cards')
  return { ok: true }
}

