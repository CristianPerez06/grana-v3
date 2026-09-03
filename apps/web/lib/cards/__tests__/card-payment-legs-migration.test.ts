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
    insert into public.transactions (id, user_id, account_id, type, amount, currency_code, status, card_period_id, received_at, cancelled_at)
    values ('${uuid()}', '${UID}', '${CARD}', 'reimbursement', ${amount}, '${opts.currency ?? 'ARS'}',
            null, '${PERIOD}',
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
