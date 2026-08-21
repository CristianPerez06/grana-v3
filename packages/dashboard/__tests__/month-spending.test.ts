import { describe, expect, it } from 'vitest'
import { aggregateMonthSpending, type MonthSpendingRow } from '../src/month-spending'

// Mis cuentas: caja/banco `mi-debito`, tarjeta `mi-visa`.
// Las de Juli: `su-debito`, `su-visa` (no estan en el set).
const MIS_CUENTAS = ['mi-debito', 'mi-visa']

const gasto = (over: Partial<MonthSpendingRow>): MonthSpendingRow => ({
  kind: 'expense',
  amount: 0,
  currency_code: 'ARS',
  account_id: 'mi-debito',
  card_period_id: null,
  ...over,
})

describe('aggregateMonthSpending', () => {
  // El ejemplo con el que se diseñó la card: cinco movimientos que cubren los
  // cuatro casos (mi cuenta / su cuenta / mi tarjeta / su tarjeta).
  const ejemplo: MonthSpendingRow[] = [
    gasto({ amount: 50_000, account_id: 'mi-visa', card_period_id: 'p1' }), // super
    gasto({ amount: 20_000, account_id: 'mi-debito' }), // nafta
    gasto({ amount: 6_000, account_id: 'mi-debito' }), // café
    gasto({ amount: 15_000, account_id: 'su-debito' }), // farmacia
    gasto({ amount: 5_000, account_id: 'su-visa', card_period_id: 'p2' }), // cine
  ]

  it('reparte los cuatro casos en su bucket', () => {
    const { ARS } = aggregateMonthSpending(ejemplo, MIS_CUENTAS)

    expect(ARS).toEqual({
      gastaste: 96_000,
      yaSePago: { total: 41_000, pusisteVos: 26_000, pusoElOtro: 15_000 },
      porPagar: { total: 55_000, enTusTarjetas: 50_000, leDebesAlOtro: 5_000 },
    })
  })

  it('mantiene la identidad de la card', () => {
    const { ARS } = aggregateMonthSpending(ejemplo, MIS_CUENTAS)

    expect(ARS.yaSePago.total + ARS.porPagar.total).toBe(ARS.gastaste)
  })

  it('un gasto que pagó el otro esta saldado pero no lo pusiste vos', () => {
    // El caso que rompia la version anterior: la plata salio, pero no de tu cuenta.
    const { ARS } = aggregateMonthSpending(
      [gasto({ amount: 15_000, account_id: 'su-debito' })],
      MIS_CUENTAS,
    )

    expect(ARS.yaSePago).toEqual({ total: 15_000, pusisteVos: 0, pusoElOtro: 15_000 })
    expect(ARS.porPagar.total).toBe(0)
  })

  it('un consumo en la tarjeta del otro no viene en tu resumen', () => {
    const { ARS } = aggregateMonthSpending(
      [gasto({ amount: 5_000, account_id: 'su-visa', card_period_id: 'p2' })],
      MIS_CUENTAS,
    )

    expect(ARS.porPagar).toEqual({ total: 5_000, enTusTarjetas: 0, leDebesAlOtro: 5_000 })
  })

  it('un reintegro a cuenta baja lo ya pagado', () => {
    const { ARS } = aggregateMonthSpending(
      [
        gasto({ amount: 20_000 }),
        gasto({ kind: 'reimbursement', amount: 8_000, reimbursement_target: 'account' }),
      ],
      MIS_CUENTAS,
    )

    expect(ARS.yaSePago.pusisteVos).toBe(12_000)
    expect(ARS.gastaste).toBe(12_000)
  })

  it('un reintegro al resumen baja lo que viene en la tarjeta', () => {
    const { ARS } = aggregateMonthSpending(
      [
        gasto({ amount: 50_000, account_id: 'mi-visa', card_period_id: 'p1' }),
        gasto({
          kind: 'reimbursement',
          amount: 12_000,
          account_id: 'mi-visa',
          card_period_id: 'p1',
          reimbursement_target: 'statement',
        }),
      ],
      MIS_CUENTAS,
    )

    expect(ARS.porPagar.enTusTarjetas).toBe(38_000)
  })

  it('un reintegro mayor al gasto de su bucket no deja el bucket en negativo', () => {
    // Es un credito, no un gasto negativo: un tile que dice "ya se pago -3.000"
    // no significa nada.
    const { ARS } = aggregateMonthSpending(
      [
        gasto({ amount: 5_000 }),
        gasto({ kind: 'reimbursement', amount: 8_000, reimbursement_target: 'account' }),
      ],
      MIS_CUENTAS,
    )

    expect(ARS.yaSePago.pusisteVos).toBe(0)
    expect(ARS.gastaste).toBe(0)
  })

  it('salta un movimiento sin cuenta en vez de adivinarle bucket', () => {
    // Adivinar moveria plata entre "ya esta saldado" y "todavia lo debes".
    const { ARS } = aggregateMonthSpending(
      [gasto({ amount: 9_000, account_id: null }), gasto({ amount: 1_000 })],
      MIS_CUENTAS,
    )

    expect(ARS.gastaste).toBe(1_000)
  })

  it('nunca cruza monedas', () => {
    const result = aggregateMonthSpending(
      [gasto({ amount: 100_000 }), gasto({ amount: 60, currency_code: 'USD' })],
      MIS_CUENTAS,
    )

    expect(result.ARS.gastaste).toBe(100_000)
    expect(result.USD.gastaste).toBe(60)
  })

  it('devuelve ceros para un mes sin movimientos', () => {
    const { ARS } = aggregateMonthSpending([], MIS_CUENTAS)

    expect(ARS).toEqual({
      gastaste: 0,
      yaSePago: { total: 0, pusisteVos: 0, pusoElOtro: 0 },
      porPagar: { total: 0, enTusTarjetas: 0, leDebesAlOtro: 0 },
    })
  })

  it('sin compartido, todo cae en los buckets propios', () => {
    const { ARS } = aggregateMonthSpending(
      [gasto({ amount: 30_000 }), gasto({ amount: 70_000, account_id: 'mi-visa', card_period_id: 'p1' })],
      MIS_CUENTAS,
    )

    expect(ARS.yaSePago).toEqual({ total: 30_000, pusisteVos: 30_000, pusoElOtro: 0 })
    expect(ARS.porPagar).toEqual({ total: 70_000, enTusTarjetas: 70_000, leDebesAlOtro: 0 })
  })
})
