import { describe, it, expect } from 'vitest'
import type { GranaSupabaseClient } from '@grana/supabase'
import { revertCardPeriodPayment } from '../revert-card-period-payment'

// The mutation is a thin wrapper over one RPC (all the work happens in a single
// transaction server-side), so the fake only needs `rpc`.

type RpcResult = { data: unknown; error: unknown }

function makeSupabase(result: RpcResult) {
  const calls: Array<{ fn: string; args: unknown }> = []
  const supabase = {
    rpc: (fn: string, args: unknown) => {
      calls.push({ fn, args })
      return Promise.resolve(result)
    },
  } as unknown as GranaSupabaseClient
  return { supabase, calls }
}

const PERIOD = 'period-1'

describe('revertCardPeriodPayment', () => {
  it('calls the RPC with the period and maps the summary', async () => {
    const { supabase, calls } = makeSupabase({
      data: {
        reverted: [{ amount: '120000.00', currency_code: 'ARS', account_name: 'Banco Galicia' }],
        movements_reverted: 4,
        stamp_tax: 'deleted',
        fully_reverted: true,
      },
      error: null,
    })

    const result = await revertCardPeriodPayment({ supabase, periodId: PERIOD })

    expect(calls).toEqual([{ fn: 'revert_card_period_payment', args: { p_period_id: PERIOD } }])
    expect(result).toEqual({
      ok: true,
      summary: {
        reverted: [{ amount: 120000, currencyCode: 'ARS', accountName: 'Banco Galicia' }],
        movementsReverted: 4,
        stampTax: 'deleted',
        fullyReverted: true,
      },
    })
  })

  it('devuelve un débito por cuenta y moneda — nunca los suma', async () => {
    // Es la razón por la que el summary dejó de ser un monto: un resumen mixto se
    // paga con dos débitos, y sumar pesos con dólares da un número que no es plata
    // de nadie. `fullyReverted: false` dice que el resumen conserva otro pago.
    const { supabase } = makeSupabase({
      data: {
        reverted: [
          { amount: 120000, currency_code: 'ARS', account_name: 'Banco Galicia' },
          { amount: 50, currency_code: 'USD', account_name: 'Caja de ahorro USD' },
        ],
        movements_reverted: 6,
        stamp_tax: 'none',
        fully_reverted: false,
      },
      error: null,
    })

    const result = await revertCardPeriodPayment({ supabase, periodId: PERIOD })

    expect(result.ok === true && result.summary?.reverted).toEqual([
      { amount: 120000, currencyCode: 'ARS', accountName: 'Banco Galicia' },
      { amount: 50, currencyCode: 'USD', accountName: 'Caja de ahorro USD' },
    ])
    expect(result.ok === true && result.summary?.fullyReverted).toBe(false)
  })

  it('surfaces an ambiguous sello so the consumer can warn the user', async () => {
    const { supabase } = makeSupabase({
      data: {
        reverted: [{ amount: 5000, currency_code: 'ARS', account_name: 'Efectivo' }],
        movements_reverted: 2,
        stamp_tax: 'ambiguous',
        fully_reverted: true,
      },
      error: null,
    })

    const result = await revertCardPeriodPayment({ supabase, periodId: PERIOD })

    expect(result.ok).toBe(true)
    expect(result.ok === true && result.summary?.stampTax).toBe('ambiguous')
  })

  it('maps GRN02 to the chronological-order message, formatting the blocking date', async () => {
    const { supabase } = makeSupabase({
      data: null,
      error: {
        code: 'GRN02',
        details: '2026-04-30',
        message: 'cannot revert payment of period ... while a later period is already paid',
      },
    })

    const result = await revertCardPeriodPayment({ supabase, periodId: PERIOD })

    expect(result).toEqual({
      ok: false,
      messageKey: 'cards.errors.revert_later_period_paid',
      messageParams: { date: '30/04/2026' },
    })
  })

  it('falls back to a param-less message when GRN02 carries no detail', async () => {
    const { supabase } = makeSupabase({
      data: null,
      error: { code: 'GRN02', details: '', message: 'blocked' },
    })

    const result = await revertCardPeriodPayment({ supabase, periodId: PERIOD })

    expect(result).toEqual({
      ok: false,
      messageKey: 'cards.errors.revert_later_period_paid',
      messageParams: undefined,
    })
  })

  it('maps a foreign card to the no-access message', async () => {
    const { supabase } = makeSupabase({
      data: null,
      error: { code: 'P0001', message: 'not_owner' },
    })

    const result = await revertCardPeriodPayment({ supabase, periodId: PERIOD })

    expect(result).toEqual({ ok: false, messageKey: 'cards.errors.period_no_access' })
  })

  it('maps a statement with no payment', async () => {
    const { supabase } = makeSupabase({
      data: null,
      error: { code: 'P0001', message: 'period_not_paid' },
    })

    const result = await revertCardPeriodPayment({ supabase, periodId: PERIOD })

    expect(result).toEqual({ ok: false, messageKey: 'cards.errors.period_not_paid' })
  })

  it('maps an unknown database error to a neutral failure that says nothing changed', async () => {
    const { supabase } = makeSupabase({
      data: null,
      error: { code: '40001', message: 'serialization failure' },
    })

    const result = await revertCardPeriodPayment({ supabase, periodId: PERIOD })

    expect(result).toEqual({
      ok: false,
      errorCode: '40001',
      messageKey: 'cards.errors.revert_failed',
    })
  })

  it('treats a null RPC payload as a failure rather than a silent success', async () => {
    const { supabase } = makeSupabase({ data: null, error: null })

    const result = await revertCardPeriodPayment({ supabase, periodId: PERIOD })

    expect(result).toEqual({ ok: false, messageKey: 'cards.errors.revert_failed' })
  })
})
