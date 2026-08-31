import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { PGlite } from '@electric-sql/pglite'
import { aggregateHero } from '@grana/dashboard'
import { createAvailableDb } from './support/available-sums-db'

/**
 * Migration 0057 — `get_available_sums` (stock) and `get_reserve_flow_sums` (flow).
 *
 * These two functions are NORMATIVE: the Hero, the drawer's cap and the write
 * path's validation all consume `available` already subtracted, instead of each
 * recomposing it. That decision is what these tests protect — 0051 shipped the
 * same lesson the hard way, with the "owned account" predicate copied into every
 * call site until two of them disagreed in production.
 *
 * The SQL runs on PGlite (real Postgres in WASM) with the function bodies and the
 * `create table` loaded verbatim from the migration file, so what is exercised is
 * the shipped SQL and not a transcription.
 */

const UID = '00000000-0000-0000-0000-0000000000a1'
const OTHER_UID = '00000000-0000-0000-0000-0000000000a2'
const BANK = '00000000-0000-0000-0000-0000000b0001'
const CARD = '00000000-0000-0000-0000-0000000cd001'
const CASH = '00000000-0000-0000-0000-00000000c001'
const ARCHIVED = '00000000-0000-0000-0000-00000000a001'

/** Pinned "today" so every run is deterministic, and a date past it. */
const TODAY = '2026-08-23'
const TOMORROW = '2026-08-24'

type Sums = {
  currency_code: string
  accounts_net: string
  reserved: string
  available: string
}

let db: PGlite

const available = async (today = TODAY) =>
  (await db.query<Sums>(`select * from public.get_available_sums('${today}') order by currency_code`))
    .rows

const flow = async (from: string, to: string, today = TODAY) =>
  (
    await db.query<{ currency_code: string; reserved_net: string }>(
      `select * from public.get_reserve_flow_sums('${from}', '${to}', '${today}') order by currency_code`,
    )
  ).rows

const reserve = (amount: number, opts: { currency?: string; date?: string; user?: string } = {}) =>
  db.exec(`
    insert into public.availability_reserve (user_id, currency_code, amount, date)
    values ('${opts.user ?? UID}', '${opts.currency ?? 'ARS'}', ${amount}, '${opts.date ?? TODAY}');
  `)

const income = (amount: number, currency = 'ARS') =>
  db.exec(`
    insert into public.transactions (user_id, account_id, currency_code, amount, type, date)
    values ('${UID}', '${BANK}', '${currency}', ${amount}, 'income', '${TODAY}');
  `)

// ONE Postgres for the file, not one per test. Booting PGlite is ~2s of WASM
// startup, so a `beforeEach` instance meant 15 boots and a suite that timed out
// under load — flaky in exactly the way that trains people to re-run CI instead
// of reading it. The schema is immutable across these tests; only the rows
// change, so truncating between them gives the same isolation for a fraction of
// the cost.
beforeAll(async () => {
  db = await createAvailableDb()
})

beforeEach(async () => {
  await db.exec(`
    truncate public.availability_reserve, public.transactions, public.accounts cascade;
    truncate auth.users cascade;
    insert into auth.users (id) values ('${UID}'), ('${OTHER_UID}');
    insert into public.accounts (id, user_id, type, is_active) values
      ('${BANK}',     '${UID}', 'bank',   true),
      ('${CARD}',     '${UID}', 'credit', true),
      ('${CASH}',     '${UID}', 'cash',   true),
      ('${ARCHIVED}', '${UID}', 'bank',   false);
  `)
})

/**
 * Un saldo inicial declarado. Sin filas de estas, `account_currencies` queda
 * vacía y la función se comporta igual que antes de 0060 — que es lo que hace
 * que los tests de arriba, escritos para 0057, sigan valiendo sin tocarlos.
 */
const declareInitial = (
  account: string,
  amount: number,
  opts: { currency?: string; date?: string; active?: boolean } = {},
) =>
  db.exec(`
    insert into public.account_currencies
      (account_id, currency_code, initial_balance, initial_balance_date, is_active)
    values ('${account}', '${opts.currency ?? 'ARS'}', ${amount},
            '${opts.date ?? '2020-01-01'}', ${opts.active ?? true});
  `)

const expense = (amount: number, currency = 'ARS', account = BANK) =>
  db.exec(`
    insert into public.transactions (user_id, account_id, currency_code, amount, type, date)
    values ('${UID}', '${account}', '${currency}', ${amount}, 'expense', '${TODAY}');
  `)

describe('get_available_sums — the disponible is one subtraction, done in SQL', () => {
  it('returns accounts net, reserved and the subtraction already made', async () => {
    await income(1_800_000)
    await reserve(200_000)

    expect(await available()).toEqual([
      { currency_code: 'ARS', accounts_net: '1800000.00', reserved: '200000.00', available: '1600000.00' },
    ])
  })

  it('nets each currency on its own — pesos saved never touch the dollar figure', async () => {
    await income(1_800_000, 'ARS')
    await income(850, 'USD')
    await reserve(200_000, { currency: 'ARS' })

    expect(await available()).toEqual([
      { currency_code: 'ARS', accounts_net: '1800000.00', reserved: '200000.00', available: '1600000.00' },
      { currency_code: 'USD', accounts_net: '850.00', reserved: '0.00', available: '850.00' },
    ])
  })

  it('reports zero reserved instead of omitting the row', async () => {
    await income(500_000)

    // A currency with a balance and no reserves must still come back, or every
    // consumer would have to invent the default.
    expect(await available()).toEqual([
      { currency_code: 'ARS', accounts_net: '500000.00', reserved: '0.00', available: '500000.00' },
    ])
  })

  it('sums the signed rows: releasing lowers the stock', async () => {
    await income(1_000_000)
    await reserve(200_000)
    await reserve(-50_000)

    const [ars] = await available()
    expect(ars.reserved).toBe('150000.00')
    expect(ars.available).toBe('850000.00')
  })

  it('shows a negative disponible instead of quietly shrinking the reserve', async () => {
    await income(150_000)
    await reserve(200_000)

    // Spending past what was set aside is a fact. Reducing the reserve so the
    // number closes would revoke a decision the user never revoked.
    expect(await available()).toEqual([
      { currency_code: 'ARS', accounts_net: '150000.00', reserved: '200000.00', available: '-50000.00' },
    ])
  })

  it('does not count a reserve dated after the cut', async () => {
    await income(1_000_000)
    await reserve(200_000, { date: TOMORROW })

    const [ars] = await available()
    expect(ars.reserved).toBe('0.00')
    expect(ars.available).toBe('1000000.00')
  })

  it('derives the account side from the owned set — a credit card never lands in it', async () => {
    await income(1_000_000)
    await db.exec(`
      insert into public.transactions (user_id, account_id, currency_code, amount, type, date)
      values ('${UID}', '${CARD}', 'ARS', 999_999, 'income', '${TODAY}');
    `)

    const [ars] = await available()
    expect(ars.accounts_net).toBe('1000000.00')
  })
})

describe('get_reserve_flow_sums — the month line is a flow, never the stock', () => {
  it('returns the net of the range, not the accumulated total', async () => {
    await reserve(200_000, { date: '2026-07-12' })
    await reserve(150_000, { date: '2026-08-05' })
    await reserve(-50_000, { date: '2026-08-18' })

    expect(await flow('2026-08-01', '2026-08-31')).toEqual([
      { currency_code: 'ARS', reserved_net: '100000.00' },
    ])
    // …while the stock carries July too.
    expect((await available())[0].reserved).toBe('300000.00')
  })

  it('returns a negative net when more was released than saved', async () => {
    await reserve(50_000, { date: '2026-08-05' })
    await reserve(-100_000, { date: '2026-08-18' })

    // The UI turns the verb around with the sign: "Volviste a usar este mes".
    expect(await flow('2026-08-01', '2026-08-31')).toEqual([
      { currency_code: 'ARS', reserved_net: '-50000.00' },
    ])
  })

  it('clamps the range to the temporal cut', async () => {
    await reserve(150_000, { date: TODAY })
    await reserve(999_999, { date: TOMORROW })

    // Asking for the whole current month must not pull in a reserve dated after
    // today just because `p_to` is the last day of the month.
    expect(await flow('2026-08-01', '2026-08-31')).toEqual([
      { currency_code: 'ARS', reserved_net: '150000.00' },
    ])
  })

  it('keeps each currency apart', async () => {
    await reserve(150_000, { currency: 'ARS', date: '2026-08-05' })
    await reserve(500, { currency: 'USD', date: '2026-08-06' })

    expect(await flow('2026-08-01', '2026-08-31')).toEqual([
      { currency_code: 'ARS', reserved_net: '150000.00' },
      { currency_code: 'USD', reserved_net: '500.00' },
    ])
  })

  it('reports nothing for a month with no activity', async () => {
    await reserve(200_000, { date: '2026-07-12' })

    expect(await flow('2026-08-01', '2026-08-31')).toEqual([])
  })
})

describe('availability_reserve — the shape of the decision', () => {
  it('rejects a zero amount', async () => {
    await expect(reserve(0)).rejects.toThrow(/chk_availability_reserve_amount_nonzero/)
  })

  it('accepts both directions: the cap and the floor live in the write path', async () => {
    // The table takes either sign on purpose. Whether the amount fits depends on
    // server state at the time of the operation, which a CHECK cannot see.
    await expect(reserve(200_000)).resolves.toBeDefined()
    await expect(reserve(-200_000)).resolves.toBeDefined()
  })

  it('has no account column: a reserve belongs to a currency, not to a place', async () => {
    const { rows } = await db.query<{ column_name: string }>(`
      select column_name from information_schema.columns
      where table_schema = 'public' and table_name = 'availability_reserve'
    `)
    expect(rows.map((r) => r.column_name)).not.toContain('account_id')
  })
})

/**
 * Migración 0060 — el saldo inicial faltaba en `accounts_net`.
 *
 * La 0057 componía el lado de las cuentas con el neto de
 * `get_account_balance_sums`, que devuelve **solo el neto de movimientos**. El
 * saldo inicial declarado nunca entraba, así que el disponible venía bajo por
 * exactamente esa suma — y como la card del dashboard deriva «Tenías» del
 * disponible, se corrían todos los términos juntos sin que la card dejara de
 * cerrar.
 *
 * El self-check de la 0057 verificaba que la función DERIVARA de la lectura
 * normativa y pasó en verde: comprobaba la composición, no la aritmética. Esa
 * es la brecha que cubre este bloque.
 */
describe('0060 — el saldo inicial es parte del saldo, no un extra', () => {
  it('una cuenta con saldo inicial y SIN movimientos no puede dar cero', async () => {
    await declareInitial(BANK, 500_000)

    // Antes de 0060 no había ni fila: la función solo miraba movimientos.
    expect(await available()).toEqual([
      { currency_code: 'ARS', accounts_net: '500000.00', reserved: '0.00', available: '500000.00' },
    ])
  })

  it('suma saldo inicial + ingresos − gastos', async () => {
    await declareInitial(BANK, 500_000)
    await income(200_000)
    await expense(50_000)

    expect((await available())[0].accounts_net).toBe('650000.00')
  })

  it('suma los iniciales de todas las cuentas propias', async () => {
    await declareInitial(CASH, 100_000)
    await declareInitial(BANK, 400_000)

    expect((await available())[0].accounts_net).toBe('500000.00')
  })

  it('acepta un saldo inicial negativo — una cuenta puede abrir en rojo', async () => {
    await declareInitial(BANK, -30_000)
    await income(100_000)

    expect((await available())[0].accounts_net).toBe('70000.00')
  })
})

describe('0060 — el inicial respeta el mismo corte temporal que todo lo demás', () => {
  it('un inicial declarado DESPUÉS del corte no cuenta', async () => {
    await declareInitial(BANK, 500_000, { date: TOMORROW })

    expect(await available()).toEqual([])
  })

  it('el mismo inicial cuenta cuando el corte ya lo alcanzó', async () => {
    await declareInitial(BANK, 500_000, { date: TOMORROW })

    expect((await available(TOMORROW))[0].accounts_net).toBe('500000.00')
  })

  it('un inicial fechado EL MISMO día del corte cuenta', async () => {
    await declareInitial(BANK, 500_000, { date: TODAY })

    expect((await available())[0].accounts_net).toBe('500000.00')
  })
})

describe('0060 — el inicial sale del mismo universo de cuentas propias', () => {
  it('una cuenta archivada no aporta su saldo inicial', async () => {
    await declareInitial(BANK, 100_000)
    await declareInitial(ARCHIVED, 900_000)

    expect((await available())[0].accounts_net).toBe('100000.00')
  })

  it('una tarjeta de crédito no aporta su saldo inicial', async () => {
    await declareInitial(BANK, 100_000)
    await declareInitial(CARD, 900_000)

    expect((await available())[0].accounts_net).toBe('100000.00')
  })

  it('una MONEDA desactivada SÍ aporta — el Hero tampoco la filtra', async () => {
    // Paridad al pie de la letra, incluida la omisión: `aggregateHero` recorre
    // todas las filas de `account_currencies` y ni siquiera selecciona
    // `is_active`. Si algún día hay que filtrarla, cambia en los dos lados a la
    // vez — un lado solo es cómo nació este bug.
    await declareInitial(BANK, 100_000, { active: false })

    expect((await available())[0].accounts_net).toBe('100000.00')
  })
})

describe('0060 — bimoneda: el inicial tampoco se mezcla', () => {
  it('cada moneda suma su propio inicial y sus propios movimientos', async () => {
    await declareInitial(BANK, 500_000)
    await declareInitial(BANK, 1_000, { currency: 'USD' })
    await income(100_000)
    await expense(250, 'USD')

    expect(await available()).toEqual([
      { currency_code: 'ARS', accounts_net: '600000.00', reserved: '0.00', available: '600000.00' },
      { currency_code: 'USD', accounts_net: '750.00', reserved: '0.00', available: '750.00' },
    ])
  })

  it('un inicial en USD sin ningún movimiento aparece con su saldo', async () => {
    await declareInitial(BANK, 500_000)
    await declareInitial(BANK, 1_000, { currency: 'USD' })
    await income(100_000)

    expect((await available())[1].accounts_net).toBe('1000.00')
  })

  it('available sigue siendo accounts_net − reserved, con el inicial adentro', async () => {
    await declareInitial(BANK, 500_000)
    await income(300_000)
    await reserve(200_000)

    expect(await available()).toEqual([
      { currency_code: 'ARS', accounts_net: '800000.00', reserved: '200000.00', available: '600000.00' },
    ])
  })
})

/**
 * Filas vacías — la decisión explícita de 0060.
 *
 * Sumar `account_currencies` sin cuidado haría aparecer ARS y USD en cero para
 * todo el mundo: la app provisiona las dos monedas a todos («bimoneda por
 * defecto»). Por eso el aporte del inicial entra al universo de monedas SOLO
 * cuando no es cero, y el contrato de hoy se conserva salvo donde el número
 * estaba mal.
 */
describe('0060 — filas vacías: lo que NO cambia', () => {
  it('una moneda provisionada en cero y sin nada no genera fila', async () => {
    await declareInitial(BANK, 300_000)
    await declareInitial(BANK, 0, { currency: 'USD' })

    expect(await available()).toEqual([
      { currency_code: 'ARS', accounts_net: '300000.00', reserved: '0.00', available: '300000.00' },
    ])
  })

  it('sin iniciales, sin movimientos y sin reservas no devuelve nada', async () => {
    expect(await available()).toEqual([])
  })
})

/**
 * Paridad con el Hero — las dos implementaciones del mismo saldo.
 *
 * El Hero compone `initial_balance + neto de movimientos` en TypeScript
 * (`aggregateHero`); `get_available_sums` lo hace en SQL. Son dos
 * implementaciones de la misma regla, y dos implementaciones derivan en
 * silencio: eso es exactamente lo que pasó cuando la 0057 se envió sin el
 * sumando del inicial.
 *
 * Se compara contra **`accounts_net`, nunca contra `available`**: `available` ya
 * restó lo guardado y el Hero no lo resta. Son dos lentes distintos del mismo
 * dinero, y apuntar al número equivocado daría una falla falsa cada vez que el
 * usuario aparta plata.
 */
describe('paridad: accounts_net === el total de cuentas del Hero', () => {
  /** `YYYY-MM-DD` venga como string o como `Date` — PGlite devuelve lo segundo. */
  const isoDate = (v: string | Date): string =>
    typeof v === 'string' ? v.slice(0, 10) : v.toISOString().slice(0, 10)

  /** Lee las mismas filas que `getDashboardHero` y las agrega con su función. */
  const heroTotals = async (asOfISO: string) => {
    const owned = await db.query<{ get_owned_account_ids: string }>(
      'select * from public.get_owned_account_ids()',
    )
    const currencies = await db.query<{
      account_id: string
      currency_code: string
      initial_balance: string
      initial_balance_date: string | Date
    }>(`select account_id, currency_code, initial_balance, initial_balance_date
        from public.account_currencies`)
    const nets = await db.query<{ account_id: string; currency_code: string; net: string }>(
      `select account_id, currency_code, net
       from public.get_account_balance_sums(null, '${asOfISO}')`,
    )

    const txSums = new Map<string, { ARS: number; USD: number }>()
    for (const r of nets.rows) {
      const entry = txSums.get(r.account_id) ?? { ARS: 0, USD: 0 }
      if (r.currency_code === 'ARS' || r.currency_code === 'USD') {
        entry[r.currency_code] = Number(r.net)
      }
      txSums.set(r.account_id, entry)
    }

    return aggregateHero(
      owned.rows.map((o) => ({
        id: o.get_owned_account_ids,
        name: o.get_owned_account_ids,
        type: 'bank' as const,
        color_key: null,
        icon_key: null,
        institution: null,
        currencies: currencies.rows
          .filter((c) => c.account_id === o.get_owned_account_ids)
          .map((c) => ({
            currency_code: c.currency_code,
            initial_balance: Number(c.initial_balance),
            initial_balance_date: isoDate(c.initial_balance_date),
          })),
      })),
      txSums,
      asOfISO,
    )
  }

  beforeEach(async () => {
    await declareInitial(CASH, 120_000)
    await declareInitial(BANK, 500_000)
    await declareInitial(BANK, 1_500, { currency: 'USD' })
    await declareInitial(ARCHIVED, 900_000) // fuera del universo
    await declareInitial(CARD, 700_000) // fuera del universo
    await expense(20_000, 'ARS', CASH)
    await income(300_000)
    await expense(45_500)
    await income(200, 'USD')
    await reserve(200_000)
  })

  it('los dos caminos dan el mismo total, por moneda', async () => {
    const sql = await available()
    const hero = await heroTotals(TODAY)

    expect(Number(sql[0].accounts_net)).toBe(hero.ars)
    expect(Number(sql[1].accounts_net)).toBe(hero.usd)
  })

  it('coinciden también en un corte anterior', async () => {
    // El corte mueve las dos lecturas juntas o ninguna: si una aplicara
    // `initial_balance_date` y la otra no, esto sería lo que lo delata.
    const asOf = '2019-12-31'
    const sql = await available(asOf)
    const hero = await heroTotals(asOf)

    expect(hero.ars).toBe(0)
    expect(sql).toEqual([])
  })

  it('y el Hero NO resta lo guardado: la diferencia es exactamente la reserva', async () => {
    const sql = await available()
    const hero = await heroTotals(TODAY)

    expect(Number(sql[0].reserved)).toBe(200_000)
    expect(hero.ars - Number(sql[0].reserved)).toBe(Number(sql[0].available))
  })
})
