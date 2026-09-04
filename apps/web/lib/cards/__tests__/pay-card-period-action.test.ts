import { describe, expect, it } from 'vitest'
import { payCardPeriod, revertCardPeriodPayment } from '@grana/cards'
import { fakeCardsSupabase } from './support/fake-cards-supabase'

/**
 * `payCardPeriod` — el contrato con la base.
 *
 * Estos tests existen por una razón concreta: la action recibe `input: unknown`, así que
 * **el typecheck no protege el contrato**. Cuando el payload pasó de plano a anidado, el
 * formulario viejo siguió compilando y habría fallado recién al confirmar un pago, en
 * producción. Lo mismo con el shape de la reversión.
 *
 * Lo que se verifica es qué se le manda al RPC y cómo se traduce lo que devuelve, no la
 * contabilidad — esa vive en la base y está cubierta por los tests PGlite.
 */

const TODAY = new Date(2026, 7, 20) // 20-ago-2026, después del cierre
const PERIOD_ID = 'aaaaaaaa-0000-4000-8000-000000000001'
// Forma v4 real: yup exige la variante (el 4º grupo empieza en 8/9/a/b).
const ARS_ACCOUNT = '11111111-1111-4111-8111-111111111111'
const USD_ACCOUNT = '22222222-2222-4222-8222-222222222222'
const BASE = {
  period_id: PERIOD_ID,
  next_end_date: '2026-09-10',
  next_due_date: '2026-09-17',
}

const arsPayment = (amount: number) => ({
  payment_account_id: ARS_ACCOUNT,
  payment_date: '2026-08-20',
  allocations: [{ settles_currency: 'ARS' as const, settles_amount: amount }],
})

const run = async (input: unknown, fixture = {}) => {
  const { supabase, rpcCalls, updates } = fakeCardsSupabase(fixture)
  const result = await payCardPeriod({ supabase, userId: 'user-1', input, today: TODAY })
  return { result, rpcCalls, updates }
}

const payArgs = (rpcCalls: Array<{ name: string; args: Record<string, unknown> }>) =>
  rpcCalls.find((c) => c.name === 'pay_card_period_legs')?.args

describe('payCardPeriod — el payload', () => {
  it('RECHAZA el payload viejo, plano, que el typecheck dejaba pasar', async () => {
    const { result, rpcCalls } = await run({
      ...BASE,
      amount: 265805.42,
      payment_account_id: ARS_ACCOUNT,
      payment_date: '2026-08-20',
    })

    expect(result.ok).toBe(false)
    // Y sobre todo: no llegó a escribir NADA.
    expect(rpcCalls).toHaveLength(0)
  })

  it('manda un pago en pesos como un débito con una imputación', async () => {
    const { result, rpcCalls } = await run({ ...BASE, payments: [arsPayment(265805.42)] })

    expect(result.ok).toBe(true)
    const args = payArgs(rpcCalls)
    expect(args?.p_payments).toEqual([arsPayment(265805.42)])
    // El monto NO viaja: lo deriva la base de las imputaciones.
    expect(JSON.stringify(args?.p_payments)).not.toContain('"amount"')
  })

  it('manda un resumen mixto pesificado como UN débito con dos imputaciones', async () => {
    const payment = {
      payment_account_id: ARS_ACCOUNT,
      payment_date: '2026-08-20',
      allocations: [
        { settles_currency: 'ARS' as const, settles_amount: 265805.42 },
        { settles_currency: 'USD' as const, settles_amount: 1932.4, fx_rate_to_ars: 1230.5 },
      ],
    }
    const { result, rpcCalls } = await run({ ...BASE, payments: [payment] })

    expect(result.ok).toBe(true)
    const payments = payArgs(rpcCalls)?.p_payments as unknown[]
    expect(payments).toHaveLength(1)
    expect(payment.allocations).toHaveLength(2)
  })

  it('manda dos débitos cuando los dólares se pagan con dólares', async () => {
    const usdPayment = {
      payment_account_id: USD_ACCOUNT,
      payment_date: '2026-08-20',
      allocations: [{ settles_currency: 'USD' as const, settles_amount: 1932.4 }],
    }
    const { result, rpcCalls } = await run({
      ...BASE,
      payments: [arsPayment(265805.42), usdPayment],
    })

    expect(result.ok).toBe(true)
    const payments = payArgs(rpcCalls)?.p_payments as unknown[]
    expect(payments).toHaveLength(2)
    // La pata en dólares no lleva cotización: no hay conversión.
    expect(JSON.stringify(payments[1])).not.toContain('fx_rate_to_ars')
  })

  it('rechaza una cotización sobre una imputación en pesos', async () => {
    const { result, rpcCalls } = await run({
      ...BASE,
      payments: [
        {
          payment_account_id: ARS_ACCOUNT,
          payment_date: '2026-08-20',
          allocations: [
            { settles_currency: 'ARS' as const, settles_amount: 100, fx_rate_to_ars: 1230.5 },
          ],
        },
      ],
    })
    expect(result.ok).toBe(false)
    expect(rpcCalls).toHaveLength(0)
  })

  it('rechaza dos cotizaciones distintas dentro del mismo débito', async () => {
    const { result } = await run({
      ...BASE,
      payments: [
        {
          payment_account_id: ARS_ACCOUNT,
          payment_date: '2026-08-20',
          allocations: [
            { settles_currency: 'USD' as const, settles_amount: 100, fx_rate_to_ars: 1230.5 },
            { settles_currency: 'USD' as const, settles_amount: 50, fx_rate_to_ars: 1300 },
          ],
        },
      ],
    })
    expect(result.ok).toBe(false)
  })
})

describe('payCardPeriod — el sello y el orden de las operaciones', () => {
  it('el sello viaja al RPC y la alícuota se deriva de la base que devuelve', async () => {
    const { result, rpcCalls, updates } = await run(
      { ...BASE, payments: [arsPayment(101200)], stamp_tax_amount: 1200 },
      {
        payResult: {
          payment_group_id: 'group-1',
          transaction_ids: ['tx-1'],
          settled: true,
          pending_ars: 0,
          pending_usd: 0,
          stamp_tax_base_ars: 100000,
        },
      },
    )

    expect(result.ok).toBe(true)
    expect(payArgs(rpcCalls)?.p_stamp_tax_amount).toBe(1200)
    // 1200 / 100000 = 0,012 — la alícuota aprendida, derivada FUERA de la transacción.
    expect(updates).toEqual([{ table: 'accounts', values: { stamp_tax_rate: 0.012 } }])
  })

  it('el calendario corre ANTES que el dinero', async () => {
    const { rpcCalls } = await run({ ...BASE, payments: [arsPayment(100)] })
    expect(rpcCalls.map((c) => c.name)).toEqual([
      'confirm_running_cycle',
      'pay_card_period_legs',
    ])
  })

  it('si el calendario falla, el dinero NO se escribe', async () => {
    const { result, rpcCalls } = await run(
      { ...BASE, payments: [arsPayment(100)] },
      { calendarError: { message: 'running_cycle_state_changed' } },
    )

    expect(result.ok).toBe(false)
    expect(rpcCalls.map((c) => c.name)).toEqual(['confirm_running_cycle'])
  })
})

describe('payCardPeriod — los errores del RPC', () => {
  it('traduce el rechazo por operación que no salda, con lo que quedaría pendiente', async () => {
    const { result } = await run(
      { ...BASE, payments: [arsPayment(40000)] },
      {
        payError: {
          message: 'statement_not_settled: the operation leaves 225805.42 ARS and 0 USD pending',
          code: 'GRN04',
          details: '225805.42|0',
        },
      },
    )

    expect(result.ok).toBe(false)
    expect(result).toMatchObject({
      messageKey: 'cards.errors.statement_not_settled',
      messageParams: { ars: '225805.42', usd: '0' },
    })
  })

  it('traduce el exceso de una imputación, con lo que resta', async () => {
    const { result } = await run(
      { ...BASE, payments: [arsPayment(999999)] },
      { payError: { message: 'I-PAY-5: leg settles too much', code: 'GRN03', details: '40000' } },
    )
    expect(result).toMatchObject({
      messageKey: 'cards.errors.leg_exceeds_pending',
      messageParams: { pending: '40000' },
    })
  })

  it('traduce la cuenta sin la moneda habilitada', async () => {
    const { result } = await run(
      { ...BASE, payments: [arsPayment(100)] },
      { payError: { message: 'payment_account_currency_inactive' } },
    )
    expect(result).toMatchObject({ messageKey: 'cards.errors.payment_currency_inactive' })
  })

  it('no escribe nada si el resumen ya está pagado', async () => {
    const { result, rpcCalls } = await run(
      { ...BASE, payments: [arsPayment(100)] },
      { existingPayment: { id: 'pp-1' } },
    )
    expect(result).toMatchObject({ messageKey: 'cards.errors.period_already_paid' })
    expect(rpcCalls).toHaveLength(0)
  })
})

describe('revertCardPeriodPayment — el shape nuevo', () => {
  it('lee los débitos revertidos POR MONEDA, sin sumarlos', async () => {
    const { supabase } = fakeCardsSupabase({
      revertResult: {
        reverted: [
          { amount: '265805.42', currency_code: 'ARS', account_name: 'Santander' },
          { amount: '1932.40', currency_code: 'USD', account_name: 'Caja de ahorro USD' },
        ],
        movements_reverted: 4,
        stamp_tax: 'deleted',
        fully_reverted: true,
      },
    })

    const result = await revertCardPeriodPayment({ supabase, periodId: PERIOD_ID })

    expect(result.ok).toBe(true)
    expect(result.summary?.reverted).toEqual([
      { amount: 265805.42, currencyCode: 'ARS', accountName: 'Santander' },
      { amount: 1932.4, currencyCode: 'USD', accountName: 'Caja de ahorro USD' },
    ])
    expect(result.summary?.stampTax).toBe('deleted')
    expect(result.summary?.fullyReverted).toBe(true)
  })

  it('manda el grupo cuando se pide deshacer solo el último pago', async () => {
    const { supabase, rpcCalls } = fakeCardsSupabase({
      revertResult: { reverted: [], movements_reverted: 0, stamp_tax: 'none', fully_reverted: false },
    })
    await revertCardPeriodPayment({ supabase, periodId: PERIOD_ID, groupId: 'group-9' })
    expect(rpcCalls[0]?.args).toEqual({ p_period_id: PERIOD_ID, p_group_id: 'group-9' })
  })

  it('traduce el bloqueo por grupo que no es el más reciente', async () => {
    const { supabase } = fakeCardsSupabase({
      revertError: { message: 'not_latest_payment_group' },
    })
    const result = await revertCardPeriodPayment({ supabase, periodId: PERIOD_ID, groupId: 'g' })
    expect(result).toMatchObject({ messageKey: 'cards.errors.revert_not_latest_group' })
  })
})
