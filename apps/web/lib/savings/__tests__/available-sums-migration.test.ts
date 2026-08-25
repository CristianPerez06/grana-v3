import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { PGlite } from '@electric-sql/pglite'
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
      ('${BANK}', '${UID}', 'bank',   true),
      ('${CARD}', '${UID}', 'credit', true);
  `)
})

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
