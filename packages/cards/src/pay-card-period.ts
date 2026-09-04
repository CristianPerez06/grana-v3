import type { GranaSupabaseClient } from '@grana/supabase'
import {
  derivePeriodStatus,
  deriveStampTaxRate,
  planRunningCycleConfirmation,
  suggestNextPeriodDates,
  addDaysToISO,
} from '@grana/money-logic'
import {
  payCardPeriodSchema,
  validateActionInput,
  Money,
  normalizeMoneyAmount,
  type PayCardPeriodInput,
} from '@grana/validation'
import type { CardMutationResult } from './mutations'

function normalizeActionMoney(value: number): number {
  return normalizeMoneyAmount(value) ?? value
}

function normalizeActionFxRate(value: number): number {
  return normalizeMoneyAmount(value, { decimalPlaces: 6 }) ?? value
}

/**
 * Pay a card statement. Single source of truth shared by web and mobile: verifies
 * ownership/closed-state, confirms the running cycle's dates (via the pure
 * `planRunningCycleConfirmation`), inserts the payment expense, the optional
 * impuesto de sellos (freezing the ARS base before the insert and remembering the
 * derived rate), sweeps the period's charges to `paid`, and records the
 * `period_payment` — rolling back partial writes on any failure. `supabase`,
 * `userId` and `today` are injected so the package stays platform-agnostic; error
 * text is neutral (`messageKey`/`errorCode`), never translated here.
 */
export async function payCardPeriod(args: {
  supabase: GranaSupabaseClient
  userId: string
  input: unknown
  today: Date
}): Promise<CardMutationResult<PayCardPeriodInput> & { expenseId?: string }> {
  const { supabase, userId, today } = args
  const validation = await validateActionInput(payCardPeriodSchema, args.input)
  if (!validation.ok) return { ok: false, fieldErrors: validation.fieldErrors }

  const data = validation.data

  // Verify period ownership
  const { data: period, error: periodError } = await supabase
    .from('card_periods')
    .select('id, account_id, start_date, end_date, due_date')
    .eq('id', data.period_id)
    .single()

  if (periodError || !period) {
    return { ok: false, messageKey: 'cards.errors.period_not_found' }
  }

  const { data: account, error: accountError } = await supabase
    .from('accounts')
    .select('user_id, name, stamp_tax_rate')
    .eq('id', period.account_id)
    .eq('user_id', userId)
    .single()

  if (accountError || !account) {
    return { ok: false, messageKey: 'cards.errors.period_no_access' }
  }

  // Verify period is not already paid
  const { data: existingPayment } = await supabase
    .from('period_payments')
    .select('id')
    .eq('period_id', data.period_id)
    .limit(1)
    .maybeSingle()

  if (existingPayment) {
    return { ok: false, messageKey: 'cards.errors.period_already_paid' }
  }

  // Verify period is closed or overdue (not open)
  const status = derivePeriodStatus(period, today, false)
  if (status === 'open') {
    return { ok: false, messageKey: 'cards.errors.period_not_closed' }
  }

  // Verify payment account belongs to user
  const { data: paymentAccount, error: paymentAccountError } = await supabase
    .from('accounts')
    .select('type, is_active')
    .eq('id', data.payment_account_id)
    .eq('user_id', userId)
    .single()

  if (paymentAccountError || !paymentAccount) {
    return { ok: false, messageKey: 'cards.errors.payment_account_not_found' }
  }
  if (paymentAccount.type === 'credit') {
    return { ok: false, messageKey: 'cards.errors.payment_from_card' }
  }

  // USD debt requires the payment-day cotización (the only point where the
  // conversion is real). Mirrors the pendingAmountUSD math of getCardPeriods:
  // pending USD consumos minus received USD statement reimbursements.
  const { data: periodTxRows, error: periodTxError } = await supabase
    .from('transactions')
    .select('type, amount, currency_code, status, received_at, cancelled_at')
    .eq('card_period_id', data.period_id)

  if (periodTxError) {
    return { ok: false, messageKey: 'cards.errors.debt_check_failed' }
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

  // Base ARS del resumen (consumos pending ARS menos reintegros ARS recibidos),
  // computada ANTES de insertar el sello para que no se incluya en su propia
  // base. Mirrors the pendingAmountARS math of getCardPeriodDetail.
  const arsPending = (periodTxRows ?? [])
    .filter((r) => r.type !== 'reimbursement' && r.status === 'pending' && r.currency_code === 'ARS')
    .reduce((sum, r) => Money.toNumber(Money.add(Money.from(sum), Money.from(Math.abs(Number(r.amount))))), 0)
  const arsReimbursed = (periodTxRows ?? [])
    .filter(
      (r) =>
        r.type === 'reimbursement' &&
        r.currency_code === 'ARS' &&
        r.received_at != null &&
        r.cancelled_at == null,
    )
    .reduce((sum, r) => Money.toNumber(Money.add(Money.from(sum), Money.from(Math.abs(Number(r.amount))))), 0)
  const stampTaxBaseARS = Money.toNumber(Money.subtract(Money.from(arsPending), Money.from(arsReimbursed)))

  if (pendingUSD > 0 && (data.fx_rate_to_ars == null || data.fx_rate_to_ars <= 0)) {
    return { ok: false, messageKey: 'cards.errors.usd_fx_required' }
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
    return { ok: false, messageKey: 'cards.errors.running_cycle_undetermined' }
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
    switch (plan.reason) {
      case 'end_not_after_paid_close':
        return {
          ok: false,
          messageKey: 'cards.errors.running_end_not_after_paid_close',
          messageParams: { date: periodEndDisplay },
        }
      case 'next_already_paid':
        return { ok: false, messageKey: 'cards.errors.running_next_already_paid' }
      case 'boundary_next_paid':
        return { ok: false, messageKey: 'cards.errors.boundary_next_paid' }
      case 'would_swallow_real_period':
        return { ok: false, messageKey: 'cards.errors.would_swallow_next' }
    }
  }

  const newNextStart = addDaysToISO(data.next_end_date, 1)
  // Suggestion history for projections: the paid cycle + the just-confirmed one.
  const confirmedHistory = [
    { end_date: period.end_date, due_date: period.due_date },
    { end_date: data.next_end_date, due_date: data.next_due_date },
  ]

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
    if (createNextError) {
      return {
        ok: false,
        messageKey: 'cards.errors.running_cycle_invalid_dates',
        messageParams: { date: periodEndDisplay },
      }
    }
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
      if (reprojectError) return { ok: false, errorCode: reprojectError.code }
    } else {
      // Boundary cascade with P(n+2) — same semantics as updatePeriodDates.
      if (plan.nextNextOp === 'shift_extend') {
        // Days now covered by the running cycle: move consumos from P(n+2).
        const { error: reassignError } = await supabase
          .from('transactions')
          .update({ card_period_id: nextPeriodRow!.id })
          .eq('card_period_id', nextNextRow.id)
          .lte('date', data.next_end_date)
        if (reassignError) return { ok: false, errorCode: reassignError.code }
      } else {
        // Shrinking: consumos past the real close belong to P(n+2).
        const { error: reassignError } = await supabase
          .from('transactions')
          .update({ card_period_id: nextNextRow.id })
          .eq('card_period_id', nextPeriodRow!.id)
          .gt('date', data.next_end_date)
        if (reassignError) return { ok: false, errorCode: reassignError.code }
      }

      const { error: shiftError } = await supabase
        .from('card_periods')
        .update({ start_date: newNextStart })
        .eq('id', nextNextRow.id)
      if (shiftError) return { ok: false, errorCode: shiftError.code }
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
    if (confirmError) {
      return {
        ok: false,
        messageKey: 'cards.errors.running_cycle_invalid_dates',
        messageParams: { date: periodEndDisplay },
      }
    }
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
      return { ok: false, messageKey: 'cards.errors.eager_estimated_failed' }
    }

    if (plan.reassignShrunkTailToEager && nextPeriodRow) {
      // Shrunk running cycle with no P(n+2) row before this call: consumos that
      // fell out of the confirmed range move to the fresh estimated period.
      const { error: reassignError } = await supabase
        .from('transactions')
        .update({ card_period_id: eagerPeriod.id })
        .eq('card_period_id', nextPeriodRow.id)
        .gt('date', data.next_end_date)
      if (reassignError) return { ok: false, errorCode: reassignError.code }
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
    return { ok: false, errorCode: expenseError?.code, messageKey: 'cards.errors.payment_failed' }
  }

  // 1.5 INSERT impuesto de sellos del resumen (si el usuario confirmó monto > 0).
  // Movimiento de la tarjeta asignado al período, con fecha = cierre del resumen;
  // queda 'pending' y se barre a 'paid' en el paso 2 junto con el resto. La base
  // (stampTaxBaseARS) se congeló antes de este insert para no auto-incluirse.
  const stampTaxAmount = data.stamp_tax_amount ?? 0
  let stampTaxId: string | null = null
  if (stampTaxAmount > 0) {
    const [{ data: impuestosCat }, { data: selloSub }] = await Promise.all([
      supabase
        .from('categories')
        .select('id')
        .eq('canonical_name', 'impuestos')
        .is('user_id', null)
        .maybeSingle(),
      supabase
        .from('subcategories')
        .select('id')
        .eq('canonical_name', 'impuesto-de-sellos')
        .is('user_id', null)
        .maybeSingle(),
    ])

    const { data: stampTx, error: stampError } = await supabase
      .from('transactions')
      .insert({
        user_id: userId,
        account_id: period.account_id,
        type: 'expense',
        amount: normalizeActionMoney(stampTaxAmount),
        currency_code: 'ARS',
        date: period.end_date,
        category_id: impuestosCat?.id ?? null,
        subcategory_id: selloSub?.id ?? null,
        description: 'Impuesto de sellos',
        is_parent: false,
        status: 'pending',
        card_period_id: data.period_id,
        due_date: period.due_date,
        fx_rate_to_ars: null,
      })
      .select('id')
      .single()

    if (stampError || !stampTx) {
      await supabase.from('transactions').delete().eq('id', expense.id)
      return { ok: false, errorCode: stampError?.code, messageKey: 'cards.errors.stamp_tax_failed' }
    }
    stampTaxId = stampTx.id

    // Primera vez para esta tarjeta: derivar y recordar la alícuota para que en
    // los próximos resúmenes Grana la sugiera sola. Una corrección puntual del
    // monto en pagos posteriores NO reescribe la tasa (solo se setea si era null).
    if (account.stamp_tax_rate == null) {
      const derived = deriveStampTaxRate(stampTaxBaseARS, stampTaxAmount)
      if (derived != null) {
        await supabase
          .from('accounts')
          .update({ stamp_tax_rate: derived })
          .eq('id', period.account_id)
      }
    }
  }

  // 2. UPDATE child transactions to 'paid' (incluye el sello recién insertado)
  const { error: updateError } = await supabase
    .from('transactions')
    .update({ status: 'paid' })
    .eq('card_period_id', data.period_id)
    .eq('status', 'pending')

  if (updateError) {
    if (stampTaxId) await supabase.from('transactions').delete().eq('id', stampTaxId)
    await supabase.from('transactions').delete().eq('id', expense.id)
    return { ok: false, errorCode: updateError.code }
  }

  // 3. INSERT period_payment. `stamp_tax_transaction_id` links the sello explicitly so
  // reverting this payment identifies it without guessing by category+period (which
  // would delete a hand-entered sello). `stamp_tax_link_known` defaults to true in the
  // schema: for payments written from here on, a null link means "there was no sello".
  const { error: paymentError } = await supabase.from('period_payments').insert({
    period_id: data.period_id,
    transaction_id: expense.id,
    stamp_tax_transaction_id: stampTaxId,
  })

  if (paymentError) {
    // Rollback: revert transactions to pending, delete the sello, delete expense
    await supabase
      .from('transactions')
      .update({ status: 'pending' })
      .eq('card_period_id', data.period_id)
      .eq('status', 'paid')
    if (stampTaxId) await supabase.from('transactions').delete().eq('id', stampTaxId)
    await supabase.from('transactions').delete().eq('id', expense.id)
    return { ok: false, errorCode: paymentError.code }
  }

  return { ok: true, expenseId: expense.id }
}
