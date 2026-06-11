'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getTodayAR } from '@/lib/date'
import {
  createCreditCardSchema,
  payCardPeriodSchema,
  updatePeriodDatesSchema,
  validateActionInput,
  Money,
  normalizeMoneyAmount,
  type CreateCreditCardInput,
  type RegisterCardPurchaseInput,
  type RegisterInstallmentsInput,
  type PayCardPeriodInput,
  type UpdatePeriodDatesInput,
} from '@grana/validation'
import { getCreditCardDebtCheck } from '@/lib/cards/queries'
import {
  derivePeriodStatus,
  planRunningCycleConfirmation,
  splitAmountIntoInstallments,
  suggestNextPeriodDates,
  addDaysToISO,
  formatDateISO,
} from '@/lib/cards/utils'
import {
  registerInstallments as registerInstallmentsOrchestrator,
  registerCardPurchase as registerCardPurchaseOrchestrator,
} from '@grana/transactions-mutations'
import type { ActionResult } from './types'
import { translatePostgresError } from './_lib/translate-error'
import { getAuthenticatedUserId } from './_lib/auth'

function normalizeActionMoney(value: number): number {
  return normalizeMoneyAmount(value) ?? value
}

function normalizeActionFxRate(value: number): number {
  return normalizeMoneyAmount(value, { decimalPlaces: 6 }) ?? value
}

// ── 4.1: createCreditCard (2 fechas: resumen actual; el siguiente nace estimado) ─

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
  if (data.current_end_date > addDaysToISO(todayStr, 40)) {
    return { ok: false, formError: 'La fecha de cierre actual es demasiado lejana.' }
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
  // P1 (real): start=current_end-30d, end=current_end, due=current_due — the
  // dates the last emitted statement announced.
  // P2 (estimated): the bank announces its real dates only when P1 closes, so
  // it is born projected (is_estimated=true) and confirmed when P1 is paid.
  const projected = suggestNextPeriodDates(
    [{ end_date: data.current_end_date, due_date: data.current_due_date }],
    today,
  )
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
      end_date: projected.suggestedEndDate,
      due_date: projected.suggestedDueDate,
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
  const userId = await getAuthenticatedUserId()
  const supabase = await createClient()
  const result = await registerCardPurchaseOrchestrator({
    supabase,
    userId,
    input,
    today: getTodayAR(),
  })
  if (result.ok) {
    revalidatePath('/cards')
    revalidatePath('/transactions')
    revalidatePath('/shared')
  }
  return result
}

// ── 4.4: registerInstallments ─────────────────────────────────────────────────
// Shell: auth + client + orchestrator + revalidate. The orchestration (split,
// period assignment, parent+children fan-out, rollback dance) lives in
// `@grana/transactions-mutations` so mobile can reuse it intact.

export async function registerInstallments(
  input: unknown,
): Promise<ActionResult<RegisterInstallmentsInput> & { parentId?: string }> {
  const userId = await getAuthenticatedUserId()
  const supabase = await createClient()
  const result = await registerInstallmentsOrchestrator({
    supabase,
    userId,
    input,
    today: getTodayAR(),
  })
  if (result.ok) {
    revalidatePath('/cards')
    revalidatePath('/transactions')
    revalidatePath('/shared')
  }
  return result
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

  // USD debt requires the payment-day cotización (the only point where the
  // conversion is real). Mirrors the pendingAmountUSD math of getCardPeriods:
  // pending USD consumos minus received USD statement reimbursements.
  const { data: periodTxRows, error: periodTxError } = await supabase
    .from('transactions')
    .select('type, amount, currency_code, status, received_at, cancelled_at')
    .eq('card_period_id', data.period_id)

  if (periodTxError) {
    return { ok: false, formError: 'No se pudo verificar la deuda del período.' }
  }

  const usdPending = (periodTxRows ?? [])
    .filter((r) => r.type !== 'reimbursement' && r.status === 'pending' && r.currency_code === 'USD')
    .reduce((sum, r) => Money.toNumber(Money.add(Money.from(sum), Money.from(Math.abs(Number(r.amount))))), 0)
  const usdReimbursed = (periodTxRows ?? [])
    .filter(
      (r) =>
        r.type === 'reimbursement' &&
        r.currency_code === 'USD' &&
        r.received_at != null &&
        r.cancelled_at == null,
    )
    .reduce((sum, r) => Money.toNumber(Money.add(Money.from(sum), Money.from(Math.abs(Number(r.amount))))), 0)
  const pendingUSD = Money.toNumber(Money.subtract(Money.from(usdPending), Money.from(usdReimbursed)))

  if (pendingUSD > 0 && (data.fx_rate_to_ars == null || data.fx_rate_to_ars <= 0)) {
    return {
      ok: false,
      formError: 'El resumen tiene deuda en dólares: falta la cotización del día de pago.',
    }
  }

  // ── Confirmación del ciclo en curso (P(n+1)) ────────────────────────────────
  // The statement being paid announces the dates of the cycle now running: the
  // user has them in hand at this exact moment. next_end_date/next_due_date
  // confirm the period that follows the one being paid (usually estimated).
  // The branching lives in planRunningCycleConfirmation (pure, tested); this
  // block fetches its inputs and executes the plan. It runs BEFORE the payment
  // inserts: confirmed dates are real-world facts, so if the payment fails
  // afterwards they harmlessly stay confirmed.
  const { data: laterPeriods, error: laterPeriodsError } = await supabase
    .from('card_periods')
    .select('id, start_date, end_date, due_date, is_estimated')
    .eq('account_id', period.account_id)
    .gt('start_date', period.start_date)
    .order('start_date', { ascending: true })
    .limit(2)

  if (laterPeriodsError) {
    return { ok: false, formError: 'No se pudo determinar el ciclo en curso de la tarjeta.' }
  }

  const nextPeriodRow = laterPeriods?.[0] ?? null
  const nextNextRow = laterPeriods?.[1] ?? null

  const laterIds = (laterPeriods ?? []).map((p) => p.id)
  let laterPaidIds = new Set<string>()
  if (laterIds.length > 0) {
    const { data: laterPayments } = await supabase
      .from('period_payments')
      .select('period_id')
      .in('period_id', laterIds)
    laterPaidIds = new Set((laterPayments ?? []).map((p) => p.period_id))
  }

  let nextNextHasTx = false
  if (nextNextRow) {
    const { data: nextNextTx } = await supabase
      .from('transactions')
      .select('id')
      .eq('card_period_id', nextNextRow.id)
      .limit(1)
      .maybeSingle()
    nextNextHasTx = Boolean(nextNextTx)
  }

  const plan = planRunningCycleConfirmation({
    paidPeriodEndDate: period.end_date,
    nextPeriod: nextPeriodRow
      ? {
          start_date: nextPeriodRow.start_date,
          end_date: nextPeriodRow.end_date,
          due_date: nextPeriodRow.due_date,
          has_payment: laterPaidIds.has(nextPeriodRow.id),
        }
      : null,
    nextNext: nextNextRow
      ? {
          start_date: nextNextRow.start_date,
          end_date: nextNextRow.end_date,
          is_estimated: nextNextRow.is_estimated,
          has_payment: laterPaidIds.has(nextNextRow.id),
          has_transactions: nextNextHasTx,
        }
      : null,
    confirmedEndDate: data.next_end_date,
    confirmedDueDate: data.next_due_date,
  })

  const periodEndDisplay = period.end_date.split('-').reverse().join('/')
  if (plan.action === 'reject') {
    const rejectMessages: Record<typeof plan.reason, string> = {
      end_not_after_paid_close: `El cierre del ciclo en curso debe ser posterior al ${periodEndDisplay} (cierre del resumen que estás pagando).`,
      next_already_paid:
        'El ciclo en curso ya tiene un pago registrado: sus fechas no se pueden modificar desde acá.',
      boundary_next_paid:
        'El próximo resumen ya está pagado. No se puede modificar el borde entre ambos resúmenes.',
      would_swallow_real_period:
        'La nueva fecha de cierre cubriría todo el próximo resumen. Editá primero las fechas del próximo resumen.',
    }
    return { ok: false, formError: rejectMessages[plan.reason] }
  }

  const newNextStart = addDaysToISO(data.next_end_date, 1)
  // Suggestion history for projections: the paid cycle + the just-confirmed one.
  const confirmedHistory = [
    { end_date: period.end_date, due_date: period.due_date },
    { end_date: data.next_end_date, due_date: data.next_due_date },
  ]
  const invalidDatesError = `No se pudo confirmar el ciclo en curso: las fechas son inválidas o se superponen con un resumen existente. El cierre debe ser posterior al ${periodEndDisplay} y el vencimiento posterior al cierre.`

  if (plan.createConfirmedNext) {
    // Legacy edge (no running period row yet): create it directly confirmed.
    const { error: createNextError } = await supabase.from('card_periods').upsert(
      {
        account_id: period.account_id,
        start_date: addDaysToISO(period.end_date, 1),
        end_date: data.next_end_date,
        due_date: data.next_due_date,
        is_estimated: false,
      },
      { onConflict: 'account_id,start_date' },
    )
    if (createNextError) return { ok: false, formError: invalidDatesError }
  }

  if (nextNextRow && plan.nextNextOp !== 'none') {
    if (plan.nextNextOp === 'reproject') {
      // The confirmed close swallows a bare estimated P(n+2): re-project it
      // past the new close instead of rejecting.
      const reprojected = suggestNextPeriodDates(confirmedHistory, today)
      const { error: reprojectError } = await supabase
        .from('card_periods')
        .update({
          start_date: newNextStart,
          end_date: reprojected.suggestedEndDate,
          due_date: reprojected.suggestedDueDate,
        })
        .eq('id', nextNextRow.id)
      if (reprojectError) return { ok: false, formError: reprojectError.message }
    } else {
      // Boundary cascade with P(n+2) — same semantics as updatePeriodDates.
      if (plan.nextNextOp === 'shift_extend') {
        // Days now covered by the running cycle: move consumos from P(n+2).
        const { error: reassignError } = await supabase
          .from('transactions')
          .update({ card_period_id: nextPeriodRow!.id })
          .eq('card_period_id', nextNextRow.id)
          .lte('date', data.next_end_date)
        if (reassignError) return { ok: false, formError: reassignError.message }
      } else {
        // Shrinking: consumos past the real close belong to P(n+2).
        const { error: reassignError } = await supabase
          .from('transactions')
          .update({ card_period_id: nextNextRow.id })
          .eq('card_period_id', nextPeriodRow!.id)
          .gt('date', data.next_end_date)
        if (reassignError) return { ok: false, formError: reassignError.message }
      }

      const { error: shiftError } = await supabase
        .from('card_periods')
        .update({ start_date: newNextStart })
        .eq('id', nextNextRow.id)
      if (shiftError) return { ok: false, formError: shiftError.message }
    }
  }

  if (!plan.createConfirmedNext && nextPeriodRow) {
    // Confirm the running cycle with the statement's dates.
    const { error: confirmError } = await supabase
      .from('card_periods')
      .update({
        end_date: data.next_end_date,
        due_date: data.next_due_date,
        is_estimated: false,
      })
      .eq('id', nextPeriodRow.id)
    if (confirmError) return { ok: false, formError: invalidDatesError }
  }

  if (plan.createEagerEstimated) {
    // Eager invariant: there is always an estimated period after the running
    // one, so the timeline's "Próximo" never disappears and consumos beyond
    // the confirmed close have a home.
    const projected = suggestNextPeriodDates(confirmedHistory, today)
    const { data: eagerPeriod, error: eagerError } = await supabase
      .from('card_periods')
      .upsert(
        {
          account_id: period.account_id,
          start_date: newNextStart,
          end_date: projected.suggestedEndDate,
          due_date: projected.suggestedDueDate,
          is_estimated: true,
        },
        { onConflict: 'account_id,start_date' },
      )
      .select('id')
      .single()

    if (eagerError || !eagerPeriod) {
      return { ok: false, formError: 'No se pudo crear el próximo resumen estimado.' }
    }

    if (plan.reassignShrunkTailToEager && nextPeriodRow) {
      // Shrunk running cycle with no P(n+2) row before this call: consumos that
      // fell out of the confirmed range move to the fresh estimated period.
      const { error: reassignError } = await supabase
        .from('transactions')
        .update({ card_period_id: eagerPeriod.id })
        .eq('card_period_id', nextPeriodRow.id)
        .gt('date', data.next_end_date)
      if (reassignError) return { ok: false, formError: reassignError.message }
    }
  }

  // 1. INSERT expense on payment account. The payment-day fx (when the period
  // had USD debt) is persisted on the expense for traceability.
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
      fx_rate_to_ars: data.fx_rate_to_ars != null ? normalizeActionFxRate(data.fx_rate_to_ars) : null,
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

  revalidatePath('/cards')
  revalidatePath('/transactions')
  return { ok: true, expenseId: expense.id }
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

  // Boundary cascade: the boundary between this period and the next is the
  // point where this.end_date + 1 == next.start_date. If the user moves the
  // boundary in either direction (extending or shrinking), the next period's
  // start_date is shifted to keep the two contiguous, and transactions in the
  // affected window are reassigned accordingly.
  const { data: nextPeriod } = await supabase
    .from('card_periods')
    .select('id, start_date, end_date')
    .eq('account_id', period.account_id)
    .gt('start_date', period.start_date)
    .order('start_date', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (nextPeriod) {
    const newNextStart = addDaysToISO(data.end_date, 1)
    const boundaryMoved = newNextStart !== nextPeriod.start_date

    if (boundaryMoved) {
      const { data: nextPayment } = await supabase
        .from('period_payments')
        .select('id')
        .eq('period_id', nextPeriod.id)
        .maybeSingle()

      if (nextPayment) {
        return {
          ok: false,
          formError:
            'El próximo resumen ya está pagado. No se puede modificar el borde entre ambos resúmenes.',
        }
      }

      if (data.end_date >= nextPeriod.end_date) {
        return {
          ok: false,
          formError:
            'La nueva fecha de cierre cubriría todo el próximo resumen. Editá primero las fechas del próximo resumen.',
        }
      }

      const isExtending = data.end_date > period.end_date

      if (isExtending) {
        // Move transactions from next → current for the days now covered by current.
        const { error: reassignError } = await supabase
          .from('transactions')
          .update({ card_period_id: periodId })
          .eq('card_period_id', nextPeriod.id)
          .lte('date', data.end_date)

        if (reassignError) return { ok: false, formError: reassignError.message }
      } else {
        // Shrinking: move transactions from current → next for the days that fall
        // out of current and are now covered by next.
        const { error: reassignError } = await supabase
          .from('transactions')
          .update({ card_period_id: nextPeriod.id })
          .eq('card_period_id', periodId)
          .gt('date', data.end_date)

        if (reassignError) return { ok: false, formError: reassignError.message }
      }

      const { error: nextUpdateError } = await supabase
        .from('card_periods')
        .update({ start_date: newNextStart })
        .eq('id', nextPeriod.id)

      if (nextUpdateError) return { ok: false, formError: nextUpdateError.message }
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
  const debtCheck = await getCreditCardDebtCheck(supabase, accountId)
  if (debtCheck.hasPendingDebt) {
    return { ok: false, formError: 'pending_debt', reason: 'pending_debt' }
  }

  const { error } = await supabase
    .from('accounts')
    .update({ is_active: false })
    .eq('id', accountId)
    .eq('user_id', userId)

  if (error) return { ok: false, formError: await translatePostgresError(error.code, 'card') }

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

  if (error) return { ok: false, formError: await translatePostgresError(error.code, 'card') }

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

  // Amount change: re-split the new total across all children (residue on the
  // first installment, matching registerInstallments). Only reachable when no
  // child is paid, per the guard above. Child dates/periods are preserved.
  if ('amount' in safeInput) {
    const rawAmount = Number(safeInput.amount)
    if (!Number.isFinite(rawAmount) || rawAmount <= 0) {
      return { ok: false, formError: 'El monto debe ser mayor a cero.' }
    }
    const n = parent.installments_total ?? (children?.length ?? 0)
    if (n <= 0) {
      return { ok: false, formError: 'La compra no tiene cuotas para recalcular.' }
    }
    const amounts = splitAmountIntoInstallments(rawAmount, n)
    parentUpdates.amount = rawAmount
    for (const child of children ?? []) {
      const idx = (child.installment_n ?? 0) - 1
      if (idx < 0 || idx >= amounts.length) continue
      const { error } = await supabase
        .from('transactions')
        .update({ amount: Money.toNumber(amounts[idx]) })
        .eq('id', child.id)
      if (error) return { ok: false, formError: error.message }
    }
  }

  // Update parent
  if (Object.keys(parentUpdates).length > 0) {
    const { error } = await supabase
      .from('transactions')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .update(parentUpdates as any)
      .eq('id', parentId)
    if (error) return { ok: false, formError: await translatePostgresError(error.code, 'card') }
  }

  // Propagate to children
  if (Object.keys(childUpdates).length > 0) {
    const { error } = await supabase
      .from('transactions')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .update(childUpdates as any)
      .eq('parent_id', parentId)
    if (error) return { ok: false, formError: await translatePostgresError(error.code, 'card') }
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

  if (error) return { ok: false, formError: await translatePostgresError(error.code, 'card') }

  revalidatePath('/transactions')
  revalidatePath('/cards')
  return { ok: true }
}

