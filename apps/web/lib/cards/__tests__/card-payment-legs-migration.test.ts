import { beforeEach, describe, expect, it } from 'vitest'
import type { PGlite } from '@electric-sql/pglite'
import { createLegsDb } from './support/card-payment-legs-db'

/**
 * Migration 0061 — patas de pago.
 *
 * What these tests protect is the guarantee the migration MOVES to the database:
 * once `period_id UNIQUE` is gone, nothing in the application can stop two writers
 * from settling the same debt twice. The floor, the currency crosses, the ownership
 * of a shared transaction and the amount identity all have to hold here, against
 * the shipped SQL, or they do not hold at all.
 */

const UID = '00000000-0000-0000-0000-0000000000a1'
const CARD = '00000000-0000-0000-0000-0000000c0001'
const BANK = '00000000-0000-0000-0000-0000000b0001'
const PERIOD = '00000000-0000-0000-0000-0000000d0001'
const PERIOD2 = '00000000-0000-0000-0000-0000000d0002'
const CAT = '00000000-0000-0000-0000-0000000f0001'
const SUBCAT = '00000000-0000-0000-0000-0000000f0002'
const OTHER_UID = '00000000-0000-0000-0000-0000000000a2'
const PERIOD3 = '00000000-0000-0000-0000-0000000d0003'

let db: PGlite
let seq = 0
const uuid = () => {
  seq += 1
  return `00000000-0000-0000-0000-${String(seq).padStart(12, '0')}`
}

const pending = async (period = PERIOD) =>
  Object.fromEntries(
    (
      await db.query<{ currency_code: string; total: string; paid: string; pending: string }>(
        `select * from public.card_period_pending('${period}')`,
      )
    ).rows.map((r) => [r.currency_code, { total: +r.total, paid: +r.paid, pending: +r.pending }]),
  )

/** A charge on the card, imputed to the statement. */
const consumo = async (
  amount: number,
  opts: { currency?: string; status?: string; period?: string } = {},
) =>
  db.exec(`
    insert into public.transactions (id, user_id, account_id, type, amount, currency_code, status, card_period_id)
    values ('${uuid()}', '${UID}', '${CARD}', 'expense', ${amount}, '${opts.currency ?? 'ARS'}',
            '${opts.status ?? 'pending'}', '${opts.period ?? PERIOD}');
  `)

const reintegro = async (
  amount: number,
  opts: { currency?: string; received?: boolean; cancelled?: boolean } = {},
) =>
  db.exec(`
    insert into public.transactions (id, user_id, account_id, type, amount, currency_code, status, card_period_id, reimbursement_target, received_at, cancelled_at)
    values ('${uuid()}', '${UID}', '${CARD}', 'reimbursement', ${amount}, '${opts.currency ?? 'ARS'}',
            null, '${PERIOD}', 'statement',
            ${opts.received === false ? 'null' : `'2026-09-01'`},
            ${opts.cancelled ? `'2026-09-02'` : 'null'});
  `)

/** The real debit: money leaving a cash/bank account. */
const debit = async (amount: number, opts: { currency?: string; fx?: number } = {}) => {
  const id = uuid()
  await db.exec(`
    insert into public.transactions (id, user_id, account_id, type, amount, currency_code, fx_rate_to_ars)
    values ('${id}', '${UID}', '${BANK}', 'expense', ${amount}, '${opts.currency ?? 'ARS'}',
            ${opts.fx ?? 'null'});
  `)
  return id
}

/** One allocation of a debit against the statement's debt in one currency. */
const leg = async (
  txId: string,
  settles: 'ARS' | 'USD',
  amount: number,
  opts: { fx?: number; group?: string; period?: string } = {},
) =>
  db.exec(`
    insert into public.period_payments (id, period_id, transaction_id, payment_group_id, settles_currency, settles_amount, fx_rate_to_ars)
    values ('${uuid()}', '${opts.period ?? PERIOD}', '${txId}', '${opts.group ?? uuid()}',
            '${settles}', ${amount}, ${opts.fx ?? 'null'});
  `)

beforeEach(async () => {
  db = await createLegsDb()
  seq = 0
  await db.exec(`
    insert into auth.users (id) values ('${UID}');
    insert into public.accounts (id, user_id, name, type) values
      ('${CARD}', '${UID}', 'Visa', 'credit'),
      ('${BANK}', '${UID}', 'Santander', 'bank');
    insert into public.card_periods (id, account_id, start_date, end_date, due_date) values
      ('${PERIOD}',  '${CARD}', '2026-07-08', '2026-08-07', '2026-08-14'),
      ('${PERIOD2}', '${CARD}', '2026-08-08', '2026-09-07', '2026-09-14');
    insert into public.account_currencies (account_id, currency_code) values
      ('${BANK}', 'ARS'), ('${BANK}', 'USD');
    insert into public.categories (id, user_id, canonical_name)
      values ('${CAT}', null, 'impuestos');
    insert into public.subcategories (id, user_id, canonical_name)
      values ('${SUBCAT}', null, 'impuesto-de-sellos');
    select set_config('request.jwt.claim.sub', '${UID}', false);
  `)
})

describe('card_period_pending — la deuda del resumen, por moneda', () => {
  it('suma los consumos y descuenta el reintegro recibido', async () => {
    await consumo(100_000)
    await consumo(65_805.42)
    await reintegro(3_155.55)
    expect((await pending()).ARS).toEqual({ total: 162_649.87, paid: 0, pending: 162_649.87 })
  })

  it('no descuenta un reintegro pendiente ni uno cancelado', async () => {
    await consumo(100_000)
    await reintegro(5_000, { received: false })
    await reintegro(7_000, { cancelled: true })
    expect((await pending()).ARS.pending).toBe(100_000)
  })

  it('separa las monedas y nunca las suma', async () => {
    await consumo(265_805.42)
    await consumo(1_932.4, { currency: 'USD' })
    const p = await pending()
    expect(p.ARS.pending).toBe(265_805.42)
    expect(p.USD.pending).toBe(1_932.4)
  })

  it('vale igual después del barrido: un consumo `paid` sigue siendo deuda del resumen', async () => {
    await consumo(50_000, { status: 'paid' })
    const tx = await debit(50_000)
    await leg(tx, 'ARS', 50_000)
    const p = await pending()
    // El total se lee de los consumos, no de su estado: mirando solo los `pending`
    // este resumen daría total 0 y pendiente −50.000.
    expect(p.ARS).toEqual({ total: 50_000, paid: 50_000, pending: 0 })
  })

  it('ignora los consumos de otro resumen', async () => {
    await consumo(100_000)
    await consumo(999_999, { period: PERIOD2 })
    expect((await pending()).ARS.pending).toBe(100_000)
  })
})

describe('compatibilidad — un pago anterior a la migración satura el resumen', () => {
  it('se lee como saldado, sin recalcular ni adivinar montos', async () => {
    await consumo(120_000)
    const tx = await debit(120_000)
    // Forma legacy: sin imputación declarada, tal como la escribía el código viejo.
    await db.exec(`
      insert into public.period_payments (id, period_id, transaction_id, payment_group_id, settlement_known)
      values ('${uuid()}', '${PERIOD}', '${tx}', '${uuid()}', false);
    `)
    expect((await pending()).ARS).toEqual({ total: 120_000, paid: 120_000, pending: 0 })
  })
})

describe('el piso: ninguna pata cancela más de lo que el resumen debe', () => {
  it('acepta la pata que cubre el pendiente exacto', async () => {
    await consumo(265_805.42)
    const tx = await debit(265_805.42)
    await expect(leg(tx, 'ARS', 265_805.42)).resolves.toBeDefined()
    expect((await pending()).ARS.pending).toBe(0)
  })

  it('rechaza la pata que excede, y dice cuánto restaba', async () => {
    await consumo(40_000)
    const tx = await debit(60_000)
    await expect(leg(tx, 'ARS', 60_000)).rejects.toThrow(/I-PAY-5/)
  })

  it('rechaza la SEGUNDA pata que, sumada, excede el pendiente', async () => {
    await consumo(100_000)
    const a = await debit(60_000)
    await leg(a, 'ARS', 60_000)
    const b = await debit(60_000)
    await expect(leg(b, 'ARS', 60_000)).rejects.toThrow(/I-PAY-5/)
  })

  it('un pago parcial deja el resto pendiente', async () => {
    await consumo(265_805.42)
    const tx = await debit(40_000)
    await leg(tx, 'ARS', 40_000)
    expect((await pending()).ARS).toEqual({ total: 265_805.42, paid: 40_000, pending: 225_805.42 })
  })

  it('el pendiente de una moneda no habilita pagar la otra', async () => {
    await consumo(100_000)
    const tx = await debit(500, { currency: 'USD' })
    await expect(leg(tx, 'USD', 500)).rejects.toThrow(/I-PAY-5/)
  })
})

describe('los cruces de moneda son una lista cerrada', () => {
  it('ARS que cancela ARS, sin cotización', async () => {
    await consumo(100_000)
    const tx = await debit(100_000)
    await expect(leg(tx, 'ARS', 100_000)).resolves.toBeDefined()
  })

  it('USD que cancela USD, sin cotización', async () => {
    await consumo(500, { currency: 'USD' })
    const tx = await debit(500, { currency: 'USD' })
    await expect(leg(tx, 'USD', 500)).resolves.toBeDefined()
  })

  it('ARS que cancela USD, con cotización', async () => {
    await consumo(1_932.4, { currency: 'USD' })
    const tx = await debit(2_377_818.2, { fx: 1230.5 })
    await expect(leg(tx, 'USD', 1_932.4, { fx: 1230.5 })).resolves.toBeDefined()
  })

  it('rechaza pagar deuda en pesos desde una cuenta en dólares: eso es un canje', async () => {
    await consumo(100_000)
    const tx = await debit(100, { currency: 'USD' })
    await expect(leg(tx, 'ARS', 100)).rejects.toThrow(/I-PAY-2/)
  })

  it('exige la cotización al pesificar', async () => {
    await consumo(500, { currency: 'USD' })
    const tx = await debit(615_250)
    await expect(leg(tx, 'USD', 500)).rejects.toThrow(/I-PAY-2/)
  })

  it('rechaza una cotización cuando no hay conversión', async () => {
    await consumo(100_000)
    const tx = await debit(100_000)
    await expect(leg(tx, 'ARS', 100_000, { fx: 1230.5 })).rejects.toThrow(/I-PAY-2/)
  })

  it('rechaza una pata cuya cotización difiere de la de su transacción', async () => {
    await consumo(500, { currency: 'USD' })
    const tx = await debit(615_250, { fx: 1230.5 })
    await expect(leg(tx, 'USD', 500, { fx: 1200 })).rejects.toThrow(/I-PAY-3/)
  })
})

describe('un gasto, un resumen, un grupo', () => {
  // Las dos patas van dentro de UNA transacción a propósito: la pertenencia se valida
  // en el BEFORE INSERT (inmediato) y la identidad monto = Σ patas al COMMIT. Sueltas,
  // la primera auto-commitea y el rechazo que llega es el de la identidad, no el que
  // estos casos quieren probar.
  it('rechaza imputar el mismo gasto a dos resúmenes', async () => {
    await consumo(100_000)
    await consumo(50_000, { period: PERIOD2 })
    const tx = await debit(150_000)
    const group = uuid()
    await db.exec('begin')
    await leg(tx, 'ARS', 100_000, { group })
    await expect(leg(tx, 'ARS', 50_000, { group, period: PERIOD2 })).rejects.toThrow(/I-PAY-4/)
    await db.exec('rollback')
  })

  it('rechaza dos patas del mismo gasto en grupos distintos', async () => {
    await consumo(100_000)
    await consumo(500, { currency: 'USD' })
    const tx = await debit(715_250, { fx: 1230.5 })
    await db.exec('begin')
    await leg(tx, 'ARS', 100_000, { group: uuid() })
    await expect(leg(tx, 'USD', 500, { fx: 1230.5, group: uuid() })).rejects.toThrow(/I-PAY-4/)
    await db.exec('rollback')
  })
})

describe('monto de la transacción = suma de sus imputaciones', () => {
  it('acepta un débito en pesos que cancela pesos y dólares pesificados', async () => {
    await consumo(265_805.42)
    await consumo(1_932.4, { currency: 'USD' })
    // 265.805,42 + round(1.932,40 × 1230,50) = 265.805,42 + 2.377.818,20
    const tx = await debit(2_643_623.62, { fx: 1230.5 })
    const group = uuid()
    await db.exec('begin')
    await leg(tx, 'ARS', 265_805.42, { group })
    await leg(tx, 'USD', 1_932.4, { fx: 1230.5, group })
    await expect(db.exec('commit')).resolves.toBeDefined()
    const p = await pending()
    expect(p.ARS.pending).toBe(0)
    expect(p.USD.pending).toBe(0)
  })

  it('rechaza al COMMIT un débito cuyo monto no cierra con sus imputaciones', async () => {
    await consumo(100_000)
    const tx = await debit(120_000)
    await db.exec('begin')
    await leg(tx, 'ARS', 100_000)
    await expect(db.exec('commit')).rejects.toThrow(/I-PAY-6/)
  })

  it('no rechaza la primera pata de un gasto de dos: la identidad es diferida', async () => {
    await consumo(265_805.42)
    await consumo(1_932.4, { currency: 'USD' })
    const tx = await debit(2_643_623.62, { fx: 1230.5 })
    const group = uuid()
    await db.exec('begin')
    // Fila por fila esta identidad es falsa acá, y rechazarla mataría un pago legítimo.
    await expect(leg(tx, 'ARS', 265_805.42, { group })).resolves.toBeDefined()
    await db.exec('rollback')
  })
})

// ─────────────────────────────────────────────────────────────────────────────

/** Un pago: un débito de una cuenta, con sus imputaciones. */
const payment = (
  accountId: string,
  allocations: Array<{ settles: 'ARS' | 'USD'; amount: number; fx?: number }>,
  date = '2026-09-02',
) => ({
  payment_account_id: accountId,
  payment_date: date,
  allocations: allocations.map((a) => ({
    settles_currency: a.settles,
    settles_amount: a.amount,
    ...(a.fx != null ? { fx_rate_to_ars: a.fx } : {}),
  })),
})

type PayResult = {
  payment_group_id: string
  transaction_ids: string[]
  settled: boolean
  pending_ars: string | number
  pending_usd: string | number
  stamp_tax_base_ars: string | number | null
}

const pay = async (
  payments: ReturnType<typeof payment>[],
  opts: { today?: string; stamp?: number; period?: string } = {},
): Promise<PayResult> => {
  const res = await db.query<{ pay_card_period_legs: PayResult }>(`
    select public.pay_card_period_legs(
      '${opts.period ?? PERIOD}'::uuid,
      '${JSON.stringify(payments)}'::jsonb,
      '${opts.today ?? '2026-08-20'}'::date,
      ${opts.stamp ?? 0}
    ) as pay_card_period_legs
  `)
  return res.rows[0].pay_card_period_legs
}

const statuses = async (period = PERIOD) =>
  (
    await db.query<{ status: string | null; n: string }>(
      `select status, count(*)::text as n from public.transactions
        where card_period_id = '${period}' group by status order by status`,
    )
  ).rows.map((r) => [r.status, +r.n] as const)

describe('pay_card_period_legs — el dinero, en una transacción', () => {
  it('paga el resumen entero en pesos: un débito, una pata, consumos barridos', async () => {
    await consumo(265_805.42)
    const r = await pay([payment(BANK, [{ settles: 'ARS', amount: 265_805.42 }])])

    expect(r.settled).toBe(true)
    expect(r.transaction_ids).toHaveLength(1)
    expect((await pending()).ARS.pending).toBe(0)
    expect(await statuses()).toEqual([['paid', 1]])
  })

  it('paga los pesos con pesos y los dólares con dólares: dos débitos reales', async () => {
    await consumo(265_805.42)
    await consumo(1_932.4, { currency: 'USD' })
    const r = await pay([
      payment(BANK, [{ settles: 'ARS', amount: 265_805.42 }]),
      payment(BANK, [{ settles: 'USD', amount: 1_932.4 }]),
    ])

    expect(r.settled).toBe(true)
    expect(r.transaction_ids).toHaveLength(2)
    const monedas = (
      await db.query<{ currency_code: string }>(
        `select currency_code from public.transactions where account_id = '${BANK}' order by currency_code`,
      )
    ).rows.map((x) => x.currency_code)
    expect(monedas).toEqual(['ARS', 'USD'])
  })

  it('paga todo en pesos un resumen mixto: UN débito con dos imputaciones', async () => {
    await consumo(265_805.42)
    await consumo(1_932.4, { currency: 'USD' })
    const r = await pay([
      payment(BANK, [
        { settles: 'ARS', amount: 265_805.42 },
        { settles: 'USD', amount: 1_932.4, fx: 1230.5 },
      ]),
    ])

    // Un solo débito bancario, como lo muestra el banco — no dos gastos inventados.
    expect(r.transaction_ids).toHaveLength(1)
    expect(r.settled).toBe(true)
    const tx = (
      await db.query<{ amount: string; currency_code: string; fx_rate_to_ars: string }>(
        `select amount, currency_code, fx_rate_to_ars from public.transactions where id = '${r.transaction_ids[0]}'`,
      )
    ).rows[0]
    // 265.805,42 + round(1.932,40 × 1230,50) = 265.805,42 + 2.377.818,20
    expect(+tx.amount).toBe(2_643_623.62)
    expect(tx.currency_code).toBe('ARS')
    expect(+tx.fx_rate_to_ars).toBe(1230.5)
  })

  it('rechaza una operación que NO salda el resumen', async () => {
    await consumo(265_805.42)
    // Sin esto, quedaría una fila en `period_payments` con deuda viva y `has_payment`
    // —que todo el módulo lee como "saldado"— pasaría a mentir.
    await expect(pay([payment(BANK, [{ settles: 'ARS', amount: 40_000 }])])).rejects.toThrow(
      /statement_not_settled/,
    )
    expect(await statuses()).toEqual([['pending', 1]])
    expect((await pending()).ARS.pending).toBe(265_805.42)
  })

  it('rechaza pagar solo los pesos de un resumen mixto', async () => {
    await consumo(265_805.42)
    await consumo(1_932.4, { currency: 'USD' })
    // Es el caso que hacía falta blindar: media moneda pagada no es un resumen saldado.
    await expect(
      pay([payment(BANK, [{ settles: 'ARS', amount: 265_805.42 }])]),
    ).rejects.toThrow(/statement_not_settled/)
    const p = await pending()
    expect(p.ARS.pending).toBe(265_805.42)
    expect(p.USD.pending).toBe(1_932.4)
  })

  it('rechaza pagar solo los dólares de un resumen mixto', async () => {
    await consumo(100_000)
    await consumo(500, { currency: 'USD' })
    await expect(pay([payment(BANK, [{ settles: 'USD', amount: 500 }])])).rejects.toThrow(
      /statement_not_settled/,
    )
  })

  it('todas las patas de una operación comparten grupo', async () => {
    await consumo(100_000)
    await consumo(500, { currency: 'USD' })
    const r = await pay([
      payment(BANK, [{ settles: 'ARS', amount: 100_000 }]),
      payment(BANK, [{ settles: 'USD', amount: 500 }]),
    ])
    const groups = (
      await db.query<{ payment_group_id: string }>(
        `select distinct payment_group_id from public.period_payments where period_id = '${PERIOD}'`,
      )
    ).rows
    expect(groups).toHaveLength(1)
    expect(groups[0].payment_group_id).toBe(r.payment_group_id)
  })
})

describe('pay_card_period_legs — el impuesto de sellos', () => {
  it('el sello entra antes que las patas, así que una pata puede pagar el total con sello', async () => {
    await consumo(100_000)
    // Si el sello se insertara DESPUÉS, esta pata sería rechazada por exceder un
    // pendiente calculado sin él. Es el orden que fija D16.
    const r = await pay([payment(BANK, [{ settles: 'ARS', amount: 101_200 }])], { stamp: 1_200 })

    expect(r.settled).toBe(true)
    // La base de la alícuota se congeló antes del sello: no se cobra a sí mismo.
    expect(+(r.stamp_tax_base_ars ?? 0)).toBe(100_000)
    expect((await pending()).ARS.total).toBe(101_200)
  })

  it('el sello queda como movimiento del resumen y se barre con el resto', async () => {
    await consumo(100_000)
    await pay([payment(BANK, [{ settles: 'ARS', amount: 101_200 }])], { stamp: 1_200 })
    const sello = (
      await db.query<{ description: string; status: string; date: string; currency_code: string }>(
        `select description, status, date::text, currency_code from public.transactions
          where card_period_id = '${PERIOD}' and description = 'Impuesto de sellos'`,
      )
    ).rows[0]
    expect(sello.status).toBe('paid')
    expect(sello.currency_code).toBe('ARS')
    expect(sello.date).toBe('2026-08-07') // el cierre del resumen
  })

  it('el sello entra en el total, así que un pago que lo ignora no salda', async () => {
    await consumo(100_000)
    await expect(
      pay([payment(BANK, [{ settles: 'ARS', amount: 100_000 }])], { stamp: 1_200 }),
    ).rejects.toThrow(/statement_not_settled/)
  })
})

describe('pay_card_period_legs — las guardas', () => {
  it('rechaza pagar un resumen todavía abierto', async () => {
    await consumo(100_000)
    await expect(
      pay([payment(BANK, [{ settles: 'ARS', amount: 100_000 }])], { today: '2026-08-01' }),
    ).rejects.toThrow(/period_not_closed/)
  })

  it('rechaza a quien no es dueño de la tarjeta', async () => {
    await consumo(100_000)
    await db.exec(`insert into auth.users (id) values ('${OTHER_UID}');`)
    await db.exec(`select set_config('request.jwt.claim.sub', '${OTHER_UID}', false);`)
    await expect(pay([payment(BANK, [{ settles: 'ARS', amount: 100_000 }])])).rejects.toThrow(
      /not_owner/,
    )
  })

  it('rechaza pagar una tarjeta con otra tarjeta', async () => {
    await consumo(100_000)
    await expect(pay([payment(CARD, [{ settles: 'ARS', amount: 100_000 }])])).rejects.toThrow(
      /payment_account_invalid/,
    )
  })

  it('rechaza una cuenta que no tiene activa la moneda del débito', async () => {
    await consumo(500, { currency: 'USD' })
    await db.exec(`delete from public.account_currencies where account_id = '${BANK}' and currency_code = 'USD';`)
    await expect(pay([payment(BANK, [{ settles: 'USD', amount: 500 }])])).rejects.toThrow(
      /payment_account_currency_inactive/,
    )
  })

  it('propaga el piso de cobertura del trigger', async () => {
    await consumo(40_000)
    await expect(pay([payment(BANK, [{ settles: 'ARS', amount: 60_000 }])])).rejects.toThrow(
      /I-PAY-5/,
    )
  })

  it('un pago fallido no deja NADA a medias', async () => {
    await consumo(100_000)
    await consumo(500, { currency: 'USD' })
    // El segundo pago excede: la operación entera tiene que caer, incluido el primero.
    await expect(
      pay([
        payment(BANK, [{ settles: 'ARS', amount: 100_000 }]),
        payment(BANK, [{ settles: 'USD', amount: 900 }]),
      ]),
    ).rejects.toThrow(/I-PAY-5/)

    const legs = (
      await db.query<{ n: string }>(
        `select count(*)::text as n from public.period_payments where period_id = '${PERIOD}'`,
      )
    ).rows[0]
    const debits = (
      await db.query<{ n: string }>(
        `select count(*)::text as n from public.transactions where account_id = '${BANK}'`,
      )
    ).rows[0]
    expect(+legs.n).toBe(0)
    expect(+debits.n).toBe(0)
    expect((await pending()).ARS.pending).toBe(100_000)
  })
})

// ─────────────────────────────────────────────────────────────────────────────

type RevertResult = {
  reverted: Array<{ amount: string | number; currency_code: string; account_name: string }>
  movements_reverted: number
  stamp_tax: string
  fully_reverted: boolean
}

const revert = async (opts: { group?: string; period?: string } = {}): Promise<RevertResult> => {
  const res = await db.query<{ revert_card_period_payment: RevertResult }>(`
    select public.revert_card_period_payment(
      '${opts.period ?? PERIOD}'::uuid,
      ${opts.group ? `'${opts.group}'::uuid` : 'null'}
    ) as revert_card_period_payment
  `)
  return res.rows[0].revert_card_period_payment
}

const debitCount = async () =>
  +(
    await db.query<{ n: string }>(
      `select count(*)::text as n from public.transactions where account_id = '${BANK}'`,
    )
  ).rows[0].n

describe('revert_card_period_payment — deshacer, por grupo', () => {
  it('deshacer todo devuelve el resumen a impago y la plata a la cuenta', async () => {
    await consumo(265_805.42)
    await pay([payment(BANK, [{ settles: 'ARS', amount: 265_805.42 }])])

    const r = await revert()
    expect(r.fully_reverted).toBe(true)
    expect(r.movements_reverted).toBe(1)
    expect(+r.reverted[0].amount).toBe(265_805.42)
    expect(r.reverted[0].account_name).toBe('Santander')
    expect(await debitCount()).toBe(0)
    expect((await pending()).ARS.pending).toBe(265_805.42)
    expect(await statuses()).toEqual([['pending', 1]])
  })

  it('deshacer un pago de dos monedas revierte las dos patas y los dos débitos', async () => {
    await consumo(100_000)
    await consumo(500, { currency: 'USD' })
    const r = await pay([
      payment(BANK, [{ settles: 'ARS', amount: 100_000 }]),
      payment(BANK, [{ settles: 'USD', amount: 500 }]),
    ])

    const rev = await revert({ group: r.payment_group_id })
    expect(rev.reverted).toHaveLength(2)
    expect(rev.reverted.map((x) => x.currency_code).sort()).toEqual(['ARS', 'USD'])
    expect(await debitCount()).toBe(0)
    const p = await pending()
    expect(p.ARS.pending).toBe(100_000)
    expect(p.USD.pending).toBe(500)
  })

  it('borra el sello cuando se revierte el grupo que lo trajo', async () => {
    await consumo(100_000)
    await pay([payment(BANK, [{ settles: 'ARS', amount: 101_200 }])], { stamp: 1_200 })

    const r = await revert()
    expect(r.stamp_tax).toBe('deleted')
    const sellos = (
      await db.query<{ n: string }>(
        `select count(*)::text as n from public.transactions
          where card_period_id = '${PERIOD}' and description = 'Impuesto de sellos'`,
      )
    ).rows[0]
    expect(+sellos.n).toBe(0)
    expect((await pending()).ARS.total).toBe(100_000)
  })

  it('rechaza revertir un grupo que no es el más reciente', async () => {
    // Con pago total, un resumen tiene un solo grupo; el caso se arma a nivel de datos,
    // que es donde el modelo ya admite varios (lo que el RPC todavía no permite).
    await consumo(100_000)
    const r = await pay([payment(BANK, [{ settles: 'ARS', amount: 100_000 }])])
    const viejo = uuid()
    await db.exec(`
      update public.period_payments set payment_group_id = '${viejo}', created_at = now() - interval '1 day'
       where period_id = '${PERIOD}';
      insert into public.period_payments (id, period_id, transaction_id, payment_group_id, settlement_known)
      select '${uuid()}', '${PERIOD}', transaction_id, '${r.payment_group_id}', false
        from public.period_payments where period_id = '${PERIOD}' limit 1;
    `)
    await expect(revert({ group: viejo })).rejects.toThrow(/not_latest_payment_group/)
  })

  it('bloquea si un resumen POSTERIOR tiene patas, aunque sea un parcial', async () => {
    await consumo(100_000)
    await pay([payment(BANK, [{ settles: 'ARS', amount: 100_000 }])])
    await consumo(50_000, { period: PERIOD2 })
    await pay([payment(BANK, [{ settles: 'ARS', amount: 50_000 }])], {
      period: PERIOD2,
      today: '2026-09-20',
    })

    await expect(revert()).rejects.toThrow(/GRN02|later period/)
  })

  it('rechaza deshacer un resumen sin pagos', async () => {
    await consumo(100_000)
    await expect(revert()).rejects.toThrow(/period_not_paid/)
  })

  it('rechaza a quien no es dueño', async () => {
    await consumo(100_000)
    await pay([payment(BANK, [{ settles: 'ARS', amount: 100_000 }])])
    await db.exec(`insert into auth.users (id) values ('${OTHER_UID}');`)
    await db.exec(`select set_config('request.jwt.claim.sub', '${OTHER_UID}', false);`)
    await expect(revert()).rejects.toThrow(/not_owner/)
  })

  it('un pago se puede rehacer después de deshacerlo', async () => {
    await consumo(100_000)
    await pay([payment(BANK, [{ settles: 'ARS', amount: 100_000 }])])
    await revert()
    await expect(pay([payment(BANK, [{ settles: 'ARS', amount: 100_000 }])])).resolves.toMatchObject(
      { settled: true },
    )
  })
})

describe('period_payments no se escribe directo', () => {
  it('no quedan policies de escritura', async () => {
    const rows = (
      await db.query<{ cmd: string }>(
        `select cmd from pg_policies where schemaname = 'public' and tablename = 'period_payments'`,
      )
    ).rows.map((r) => r.cmd)
    expect(rows).toEqual(['SELECT'])
  })

  it('los dos RPC son SECURITY DEFINER', async () => {
    const rows = (
      await db.query<{ proname: string; prosecdef: boolean }>(
        `select proname, prosecdef from pg_proc p join pg_namespace n on n.oid = p.pronamespace
          where n.nspname = 'public'
            and proname in ('pay_card_period_legs', 'revert_card_period_payment')
          order by proname`,
      )
    ).rows
    expect(rows).toEqual([
      { proname: 'pay_card_period_legs', prosecdef: true },
      { proname: 'revert_card_period_payment', prosecdef: true },
    ])
  })
})

// ─────────────────────────────────────────────────────────────────────────────

const PLAN_CONFIRM = {
  create_confirmed_next: false,
  next_next_op: 'none',
  create_eager_estimated: true,
  reassign_shrunk_tail_to_eager: false,
}

const EXPECTED = {
  paid_end_date: '2026-08-07',
  next_period_id: PERIOD2,
  next_end_date: '2026-09-07',
  next_due_date: '2026-09-14',
  next_next_id: null,
}

/** Anclajes completos de P(n+2), los que el plan TS mira para decidir qué hacer con él. */
const EXPECTED_WITH_NEXT_NEXT = {
  ...EXPECTED,
  next_next_id: PERIOD3,
  next_next_start_date: '2026-09-08',
  next_next_end_date: '2026-10-07',
  next_next_is_estimated: true,
  next_next_has_payments: false,
  next_next_has_transactions: false,
}

const confirmCycle = async (
  opts: { end?: string; due?: string; plan?: object; expected?: object } = {},
) => {
  const res = await db.query<{ confirm_running_cycle: { status: string; reason?: string } }>(`
    select public.confirm_running_cycle(
      '${PERIOD}'::uuid,
      '${opts.end ?? '2026-09-10'}'::date,
      '${opts.due ?? '2026-09-17'}'::date,
      '${JSON.stringify(opts.plan ?? PLAN_CONFIRM)}'::jsonb,
      '2026-10-10'::date,
      '2026-10-17'::date,
      '${JSON.stringify(opts.expected ?? EXPECTED)}'::jsonb
    ) as confirm_running_cycle
  `)
  return res.rows[0].confirm_running_cycle
}

const periods = async () =>
  (
    await db.query<{ start_date: string; end_date: string; due_date: string; is_estimated: boolean }>(
      `select start_date::text, end_date::text, due_date::text, is_estimated
         from public.card_periods where account_id = '${CARD}' order by start_date`,
    )
  ).rows

describe('confirm_running_cycle — el calendario, revalidado', () => {
  it('confirma las fechas del ciclo en curso y crea el estimado siguiente', async () => {
    const r = await confirmCycle()
    expect(r.status).toBe('applied')

    const rows = await periods()
    expect(rows).toHaveLength(3)
    // El ciclo en curso queda confirmado con las fechas del resumen en mano.
    expect(rows[1]).toMatchObject({
      start_date: '2026-08-08',
      end_date: '2026-09-10',
      due_date: '2026-09-17',
      is_estimated: false,
    })
    // Y siempre queda un estimado por delante, arrancando al día siguiente del cierre.
    expect(rows[2]).toMatchObject({ start_date: '2026-09-11', is_estimated: true })
  })

  it('no vuelve a confirmar si el resumen ya tiene patas', async () => {
    await consumo(100_000)
    await pay([payment(BANK, [{ settles: 'ARS', amount: 100_000 }])])

    const r = await confirmCycle()
    expect(r).toEqual({ status: 'noop', reason: 'already_has_payments' })
    // Las fechas del ciclo en curso quedan como estaban.
    expect((await periods())[1]).toMatchObject({ end_date: '2026-09-07' })
  })

  it('rechaza un plan calculado sobre fechas que ya cambiaron', async () => {
    // Alguien movió el cierre del ciclo en curso entre la lectura y la llamada.
    await db.exec(
      `update public.card_periods set end_date = '2026-09-20', due_date = '2026-09-27' where id = '${PERIOD2}';`,
    )
    await expect(confirmCycle()).rejects.toThrow(/running_cycle_state_changed/)
    // Y no pisó nada.
    expect((await periods())[1]).toMatchObject({ end_date: '2026-09-20' })
  })

  it('rechaza si cambió el cierre del propio resumen pagado', async () => {
    await expect(
      confirmCycle({ expected: { ...EXPECTED, paid_end_date: '2026-08-01' } }),
    ).rejects.toThrow(/running_cycle_state_changed/)
  })

  it('rechaza un período siguiente que ya no existe', async () => {
    await expect(
      confirmCycle({
        expected: { ...EXPECTED, next_period_id: '00000000-0000-0000-0000-0000000d0009' },
      }),
    ).rejects.toThrow(/running_cycle_state_changed/)
  })

  it('rechaza a quien no es dueño', async () => {
    await db.exec(`insert into auth.users (id) values ('${OTHER_UID}');`)
    await db.exec(`select set_config('request.jwt.claim.sub', '${OTHER_UID}', false);`)
    await expect(confirmCycle()).rejects.toThrow(/not_owner/)
  })
})

describe('confirm_running_cycle — los anclajes de P(n+2)', () => {
  const withNextNext = async () =>
    db.exec(`
      insert into public.card_periods (id, account_id, start_date, end_date, due_date, is_estimated)
      values ('${PERIOD3}', '${CARD}', '2026-09-08', '2026-10-07', '2026-10-14', true);
    `)

  const confirmWithNextNext = (expected?: object) =>
    db.query(`
      select public.confirm_running_cycle(
        '${PERIOD}'::uuid, '2026-09-10'::date, '2026-09-17'::date,
        '${JSON.stringify({ ...PLAN_CONFIRM, next_next_op: 'reproject', create_eager_estimated: false })}'::jsonb,
        '2026-10-10'::date, '2026-10-17'::date,
        '${JSON.stringify(expected ?? EXPECTED_WITH_NEXT_NEXT)}'::jsonb
      ) as r
    `)

  it('aplica el plan cuando P(n+2) sigue siendo el que el plan miró', async () => {
    await withNextNext()
    await expect(confirmWithNextNext()).resolves.toBeDefined()
    const rows = await periods()
    // Re-proyectado detrás del cierre confirmado.
    expect(rows[2]).toMatchObject({ start_date: '2026-09-11', end_date: '2026-10-10' })
  })

  it('rechaza si P(n+2) dejó de ser estimado', async () => {
    await withNextNext()
    await db.exec(`update public.card_periods set is_estimated = false where id = '${PERIOD3}';`)
    await expect(confirmWithNextNext()).rejects.toThrow(/running_cycle_state_changed/)
  })

  it('rechaza si a P(n+2) le entraron consumos entre la lectura y la llamada', async () => {
    await withNextNext()
    await consumo(50_000, { period: PERIOD3 })
    // El plan decía "estimado pelado y vacío": re-proyectarlo ahora movería consumos reales.
    await expect(confirmWithNextNext()).rejects.toThrow(/running_cycle_state_changed/)
  })

  it('rechaza si P(n+2) cambió de fechas', async () => {
    await withNextNext()
    // Adelantado, no atrasado: el cierre tiene que seguir siendo anterior al vencimiento
    // (chk_period_dates), así que mover la fecha "hacia adelante" rompe la tabla, no el test.
    await db.exec(`update public.card_periods set end_date = '2026-10-05' where id = '${PERIOD3}';`)
    await expect(confirmWithNextNext()).rejects.toThrow(/running_cycle_state_changed/)
  })
})

// ─────────────────────────────────────────────────────────────────────────────

/**
 * La equivalencia que sostiene TODO el recorte de alcance.
 *
 * Este alcance no introduce el estado `partial` ni vuelve partial-aware a
 * `derivePeriodStatus`, `computePeriodAmounts`, `classifyPeriodsLifecycle`, el hero de
 * `/cards`, el resumen del mes ni los compromisos del dashboard. Todos ellos leen
 * `has_payment` —"existe una fila de pago"— como **"el resumen está saldado"**.
 *
 * Eso es cierto por una sola razón: `pay_card_period_legs` rechaza (`GRN04`) cualquier
 * operación que no deje el pendiente en cero en las dos monedas. Si alguien relaja ese
 * rechazo —por ejemplo, al empezar a implementar pagos parciales— la equivalencia se
 * rompe en silencio y esas seis superficies pasan a mentir a la vez.
 *
 * Estos tests son la alarma: atan la propiedad, no la implementación. Deben ponerse en
 * rojo ANTES de que una pantalla muestre un resumen mixto como pagado debiendo dólares.
 *
 * OJO con qué es lo que atan: el invariante del **camino de escritura actual**, no una
 * verdad eterna del modelo. Hoy vale porque el RPC exige settlement total. Cuando entren
 * los pagos parciales, estos tests cambian A PROPÓSITO — ahí `has_payment` deja de ser
 * equivalente a "saldado" y se parte en `settlement` + `hasAnyPayment`. Verlos en rojo
 * en ese momento es la señal correcta; verlos en rojo antes, un bug.
 */
describe('INVARIANTE: existe un pago ⟺ el resumen está saldado', () => {
  /** La propiedad, verificada sobre el estado real de la base. */
  const expectInvariant = async () => {
    const legs = +(
      await db.query<{ n: string }>(
        `select count(*)::text as n from public.period_payments where period_id = '${PERIOD}'`,
      )
    ).rows[0].n
    const p = await pending()
    const settled = p.ARS.pending === 0 && p.USD.pending === 0
    // has_payment ⟺ saldado. Las dos direcciones.
    expect(legs > 0).toBe(settled)
    return { legs, settled }
  }

  it('se mantiene tras un pago total en una moneda', async () => {
    await consumo(265_805.42)
    await pay([payment(BANK, [{ settles: 'ARS', amount: 265_805.42 }])])
    const r = await expectInvariant()
    expect(r.legs).toBeGreaterThan(0)
  })

  it('se mantiene tras un pago total en dos monedas, con dos débitos', async () => {
    await consumo(265_805.42)
    await consumo(1_932.4, { currency: 'USD' })
    await pay([
      payment(BANK, [{ settles: 'ARS', amount: 265_805.42 }]),
      payment(BANK, [{ settles: 'USD', amount: 1_932.4 }]),
    ])
    const r = await expectInvariant()
    expect(r.settled).toBe(true)
  })

  it('se mantiene tras un pago total en dos monedas con UN solo débito', async () => {
    await consumo(265_805.42)
    await consumo(1_932.4, { currency: 'USD' })
    await pay([
      payment(BANK, [
        { settles: 'ARS', amount: 265_805.42 },
        { settles: 'USD', amount: 1_932.4, fx: 1230.5 },
      ]),
    ])
    await expectInvariant()
  })

  it('se mantiene cuando el pago se RECHAZA: no queda fila ni deuda saldada', async () => {
    await consumo(265_805.42)
    await consumo(1_932.4, { currency: 'USD' })
    await expect(
      pay([payment(BANK, [{ settles: 'ARS', amount: 265_805.42 }])]),
    ).rejects.toThrow(/statement_not_settled/)
    const r = await expectInvariant()
    // Ni una fila: si esto pasara a > 0, la equivalencia estaría rota.
    expect(r.legs).toBe(0)
  })

  it('se mantiene tras deshacer el pago', async () => {
    await consumo(100_000)
    await pay([payment(BANK, [{ settles: 'ARS', amount: 100_000 }])])
    await revert()
    const r = await expectInvariant()
    expect(r.legs).toBe(0)
  })

  it('se mantiene con un pago legacy, que satura el resumen', async () => {
    await consumo(120_000)
    const tx = await debit(120_000)
    await db.exec(`
      insert into public.period_payments (id, period_id, transaction_id, payment_group_id, settlement_known)
      values ('${uuid()}', '${PERIOD}', '${tx}', '${uuid()}', false);
    `)
    await expectInvariant()
  })

  it('el sello no puede romperla: entra en el total exigido', async () => {
    await consumo(100_000)
    await expect(
      pay([payment(BANK, [{ settles: 'ARS', amount: 100_000 }])], { stamp: 1_200 }),
    ).rejects.toThrow(/statement_not_settled/)
    const r = await expectInvariant()
    expect(r.legs).toBe(0)
  })
})
