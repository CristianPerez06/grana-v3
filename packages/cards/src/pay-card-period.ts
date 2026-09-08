import type { GranaSupabaseClient } from '@grana/supabase'
import {
  derivePeriodStatus,
  deriveStampTaxRate,
  planRunningCycleConfirmation,
  suggestNextPeriodDates,
} from '@grana/money-logic'
import {
  payCardPeriodSchema,
  validateActionInput,
  type PayCardPeriodInput,
} from '@grana/validation'
import type { CardMutationResult } from './mutations'

/** Lo que devuelve `pay_card_period_legs`. */
type PayLegsResult = {
  payment_group_id: string
  transaction_ids: string[]
  settled: boolean
  pending_ars: number | string
  pending_usd: number | string
  /** Base ARS del resumen ANTES del sello; la alícuota se deriva acá afuera. */
  stamp_tax_base_ars: number | string | null
}

/**
 * Traduce los errores de los RPC a `messageKey`s neutrales.
 *
 * Los RPC levantan excepciones con texto estable (nunca traducido) y, en los casos que
 * la app necesita nombrar un número, con `errcode` + `detail`. Acá NO se re-valida nada:
 * la garantía es de la base, esto solo le pone palabras.
 */
function mapPaymentError(error: { message?: string; code?: string; details?: string }): CardMutationResult {
  const message = error.message ?? ''
  const has = (needle: string) => message.includes(needle)

  if (has('not_authenticated') || has('not_owner')) {
    return { ok: false, messageKey: 'cards.errors.period_no_access' }
  }
  if (has('period_not_found')) return { ok: false, messageKey: 'cards.errors.period_not_found' }
  if (has('period_not_closed')) return { ok: false, messageKey: 'cards.errors.period_not_closed' }
  if (has('payment_account_invalid')) {
    return { ok: false, messageKey: 'cards.errors.payment_account_not_found' }
  }
  if (has('payment_account_currency_inactive')) {
    return { ok: false, messageKey: 'cards.errors.payment_currency_inactive' }
  }
  if (has('stamp_tax_only_on_first_payment')) {
    return { ok: false, messageKey: 'cards.errors.period_already_paid' }
  }
  // GRN04: la operación no salda el resumen. `detail` trae "<ars>|<usd>".
  if (error.code === 'GRN04' || has('statement_not_settled')) {
    const [ars, usd] = (error.details ?? '').split('|')
    return {
      ok: false,
      messageKey: 'cards.errors.statement_not_settled',
      messageParams: { ars: ars ?? '', usd: usd ?? '' },
    }
  }
  // GRN03 / I-PAY-5: una imputación excede el pendiente de su moneda.
  if (error.code === 'GRN03' || has('I-PAY-5')) {
    return {
      ok: false,
      messageKey: 'cards.errors.leg_exceeds_pending',
      messageParams: { pending: (error.details ?? '').trim() },
    }
  }
  // I-PAY-2 / I-PAY-3: cruce de monedas o cotización incoherente.
  if (has('I-PAY-2') || has('I-PAY-3')) {
    return { ok: false, messageKey: 'cards.errors.usd_fx_required' }
  }
  if (has('running_cycle_state_changed')) {
    return { ok: false, messageKey: 'cards.errors.running_cycle_undetermined' }
  }
  return { ok: false, errorCode: error.code, messageKey: 'cards.errors.payment_failed' }
}

/**
 * Pagar un resumen de tarjeta. Fuente única compartida por web y mobile.
 *
 * La escritura vive en la base, en DOS operaciones deliberadamente separadas:
 *
 *   1. `confirm_running_cycle` — el CALENDARIO. Las fechas del ciclo en curso son
 *      hechos leídos del resumen de papel: valen aunque el pago falle. Por eso van
 *      antes y en su propia transacción. La DECISIÓN (confirmar, re-proyectar o
 *      rechazar) se toma acá con `planRunningCycleConfirmation`, que es pura y está
 *      testeada; la función SQL revalida los anclajes y ejecuta.
 *   2. `pay_card_period_legs` — el DINERO. Atómico: transacciones, imputaciones, sello,
 *      la verificación de que la operación salda el resumen y el barrido a `paid`, todo
 *      o nada. Reemplaza la cadena de rollbacks manuales que esto tenía.
 *
 * Lo único que queda acá del lado de la escritura es la alícuota de sellos: es un
 * APRENDIZAJE, no un hecho contable, y se deriva de la base que devuelve el RPC.
 *
 * `supabase`, `userId` y `today` se inyectan para que el package no dependa de la
 * plataforma; el texto de error es neutral (`messageKey`), nunca traducido acá.
 */
export async function payCardPeriod(args: {
  supabase: GranaSupabaseClient
  userId: string
  input: unknown
  today: Date
}): Promise<
  CardMutationResult<PayCardPeriodInput> & {
    /** Primer débito de la operación. Se conserva para las shells que esperan uno. */
    expenseId?: string
    /** TODOS los débitos, uno por cuenta. */
    expenseIds?: string[]
    paymentGroupId?: string
  }
> {
  const { supabase, userId, today } = args
  const validation = await validateActionInput(payCardPeriodSchema, args.input)
  if (!validation.ok) return { ok: false, fieldErrors: validation.fieldErrors }

  const data = validation.data

  // ── Verificaciones de lectura, para dar buenos mensajes ────────────────────
  // Los RPC vuelven a chequear todo esto: acá se hace para que el usuario reciba el
  // mensaje correcto sin depender de parsear una excepción.
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

  const { data: existingPayment } = await supabase
    .from('period_payments')
    .select('id')
    .eq('period_id', data.period_id)
    .limit(1)
    .maybeSingle()

  if (existingPayment) {
    return { ok: false, messageKey: 'cards.errors.period_already_paid' }
  }

  if (derivePeriodStatus(period, today, false) === 'open') {
    return { ok: false, messageKey: 'cards.errors.period_not_closed' }
  }

  // ── 1 · El calendario ──────────────────────────────────────────────────────
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

  // Proyección para el estimado siguiente: el ciclo pagado + el recién confirmado.
  const projected = suggestNextPeriodDates(
    [
      { end_date: period.end_date, due_date: period.due_date },
      { end_date: data.next_end_date, due_date: data.next_due_date },
    ],
    today,
  )

  const { error: calendarError } = await supabase.rpc('confirm_running_cycle', {
    p_period_id: data.period_id,
    p_next_end_date: data.next_end_date,
    p_next_due_date: data.next_due_date,
    p_plan: {
      create_confirmed_next: plan.createConfirmedNext,
      next_next_op: plan.nextNextOp,
      create_eager_estimated: plan.createEagerEstimated,
      reassign_shrunk_tail_to_eager: plan.reassignShrunkTailToEager,
    },
    p_projected_end: projected.suggestedEndDate,
    p_projected_due: projected.suggestedDueDate,
    // Los anclajes que el plan da por ciertos. Si algo cambió entre la lectura de
    // arriba y esta llamada, la función NO aplica el plan.
    p_expected: {
      paid_end_date: period.end_date,
      next_period_id: nextPeriodRow?.id ?? null,
      next_end_date: nextPeriodRow?.end_date ?? null,
      next_due_date: nextPeriodRow?.due_date ?? null,
      next_next_id: nextNextRow?.id ?? null,
      next_next_start_date: nextNextRow?.start_date ?? null,
      next_next_end_date: nextNextRow?.end_date ?? null,
      next_next_is_estimated: nextNextRow?.is_estimated ?? null,
      next_next_has_payments: nextNextRow ? laterPaidIds.has(nextNextRow.id) : null,
      next_next_has_transactions: nextNextRow ? nextNextHasTx : null,
    },
  })

  if (calendarError) {
    if ((calendarError.message ?? '').includes('running_cycle_state_changed')) {
      return { ok: false, messageKey: 'cards.errors.running_cycle_undetermined' }
    }
    return {
      ok: false,
      messageKey: 'cards.errors.running_cycle_invalid_dates',
      messageParams: { date: periodEndDisplay },
    }
  }

  // ── 2 · El dinero ──────────────────────────────────────────────────────────
  const { data: payResult, error: payError } = await supabase.rpc('pay_card_period_legs', {
    p_period_id: data.period_id,
    p_payments: data.payments,
    p_today: formatDateISO(today),
    p_stamp_tax_amount: data.stamp_tax_amount ?? 0,
  })

  if (payError) return mapPaymentError(payError)

  const result = payResult as unknown as PayLegsResult | null
  if (!result) return { ok: false, messageKey: 'cards.errors.payment_failed' }

  // ── 3 · La alícuota aprendida ──────────────────────────────────────────────
  // Primera vez para esta tarjeta: derivar y recordar la tasa para sugerirla sola en
  // los próximos resúmenes. Una corrección puntual del monto NO la reescribe (solo se
  // setea si era null). Es un aprendizaje, no un hecho contable: vive fuera de la
  // transacción del dinero a propósito.
  const stampTaxAmount = data.stamp_tax_amount ?? 0
  if (stampTaxAmount > 0 && account.stamp_tax_rate == null && result.stamp_tax_base_ars != null) {
    const derived = deriveStampTaxRate(Number(result.stamp_tax_base_ars), stampTaxAmount)
    if (derived != null) {
      await supabase
        .from('accounts')
        .update({ stamp_tax_rate: derived })
        .eq('id', period.account_id)
    }
  }

  return {
    ok: true,
    expenseId: result.transaction_ids[0],
    expenseIds: result.transaction_ids,
    paymentGroupId: result.payment_group_id,
  }
}

/** `today` como ISO local, que es lo que el RPC compara contra el cierre del resumen. */
function formatDateISO(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
