import { beforeAll, describe, expect, it } from 'vitest'
import type { PGlite } from '@electric-sql/pglite'
import type { GranaSupabaseClient } from '@grana/supabase'
import { getAccountMovementsAscending } from '@grana/transactions'
import {
  balanceSumsFromRows,
  computeRunningBalances,
  type AccountBalanceSumRow,
  type RunningBalanceRow,
} from '@grana/money-logic'
import { createBalanceDb } from './support/balance-sums-db'

/**
 * The account detail's running balance must not depend on the size of the
 * ledger (spec `web-data-access`).
 *
 * `getAccountMovementsAscending` feeds `computeRunningBalances`, so its product
 * is a balance. It used to be a plain `.select()`: PostgREST caps every response
 * at the server's `max-rows` and truncates in SILENCE — `error === null`, fewer
 * rows, no signal — so an account whose history crossed the ceiling rendered a
 * running balance missing movements. This pins the fix: with a ledger well over
 * the cap, the final running balance equals `initial_balance` + the net the
 * `get_account_balance_sums` RPC computes over the same rows.
 */

const ACCOUNT = '00000000-0000-0000-0000-00000000c001'
const UID = '00000000-0000-0000-0000-0000000000a1'
const INITIAL_BALANCE = 2_850_000

/** Server-side cap being simulated. The real Supabase default is 1000. */
const MAX_ROWS = 1000
/** Comfortably over 2 pages, so an off-by-one in the loop shows up. */
const LEDGER_SIZE = 2_500

type Row = {
  id: string
  account_id: string
  transfer_destination_account_id: string | null
  currency_code: string
  amount: number
  type: 'income' | 'expense'
  date: string
  created_at: string
  status: string | null
}

/** Deterministic ledger: an income every third row, an expense otherwise. */
const LEDGER: Row[] = Array.from({ length: LEDGER_SIZE }, (_, i) => ({
  // Ids are zero-padded so lexicographic order matches insertion order.
  id: `00000000-0000-0000-0000-${String(i).padStart(12, '0')}`,
  account_id: ACCOUNT,
  transfer_destination_account_id: null,
  currency_code: 'ARS',
  amount: i % 3 === 0 ? 1_000.33 : 250.11,
  type: i % 3 === 0 ? ('income' as const) : ('expense' as const),
  date: '2026-05-01',
  created_at: `2026-05-01T00:00:${String(i % 60).padStart(2, '0')}Z`,
  status: null,
}))

// ── Supabase fake that truncates like PostgREST does ─────────────────────────
// Honours `.range()` and caps every response at MAX_ROWS. A query with no range
// gets the first MAX_ROWS rows and NO error — exactly the silent truncation the
// change is about.

function makeCappedSupabase(rows: Row[]) {
  const calls = { requests: 0 }

  function builder() {
    let from = 0
    let to = Number.POSITIVE_INFINITY

    const run = () => {
      calls.requests += 1
      const window = rows.slice(from, to === Number.POSITIVE_INFINITY ? undefined : to + 1)
      return { data: window.slice(0, MAX_ROWS), error: null }
    }

    const b: Record<string, unknown> = {
      select: () => b,
      or: () => b,
      order: () => b,
      in: () => b,
      range: (start: number, end: number) => {
        from = start
        to = end
        return b
      },
      then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
        Promise.resolve(run()).then(resolve, reject),
    }
    return b
  }

  return {
    client: { from: () => builder() } as unknown as GranaSupabaseClient,
    calls,
  }
}

function insertSql(rows: Row[]): string {
  const values = rows
    .map(
      (r) =>
        `('${r.id}', '${UID}', '${r.account_id}', '${r.currency_code}', ${r.amount}, '${r.type}'::transaction_type, '${r.date}')`,
    )
    .join(',\n')

  return `
    insert into public.accounts (id, user_id, type, is_active)
    values ('${ACCOUNT}', '${UID}', 'bank', true);
    insert into public.transactions (id, user_id, account_id, currency_code, amount, type, date)
    values ${values};
  `
}

describe('getAccountMovementsAscending — completeness over the max-rows ceiling', () => {
  let db: PGlite

  beforeAll(async () => {
    db = await createBalanceDb()
    await db.exec(insertSql(LEDGER))
  }, 60_000)

  it('walks every page instead of stopping at the server cap', async () => {
    const { client, calls } = makeCappedSupabase(LEDGER)

    const rows = await getAccountMovementsAscending(client, ACCOUNT)

    expect(rows).toHaveLength(LEDGER_SIZE)
    // 3 full-ish pages + the empty page that proves exhaustion.
    expect(calls.requests).toBeGreaterThan(1)
  })

  it('the final running balance equals initial_balance + the RPC net', async () => {
    const { client } = makeCappedSupabase(LEDGER)
    const rows = await getAccountMovementsAscending(client, ACCOUNT)

    const snapshots = computeRunningBalances(
      rows as unknown as RunningBalanceRow[],
      ACCOUNT,
      { ARS: INITIAL_BALANCE, USD: 0 },
    )
    const last = snapshots.get(LEDGER[LEDGER_SIZE - 1].id)

    const sums = balanceSumsFromRows(
      (
        await db.query<AccountBalanceSumRow>(
          `select account_id, currency_code, net
             from public.get_account_balance_sums(array['${ACCOUNT}']::uuid[])`,
        )
      ).rows,
    )
    const net = sums.get(ACCOUNT)?.ARS ?? 0

    expect(last?.ARS).toBeCloseTo(INITIAL_BALANCE + net, 6)
  })

  it('a single uncapped select would have produced a WRONG balance (the defect)', async () => {
    // Reproduces the old read: one `.select()`, no range → the server hands back
    // MAX_ROWS rows and no error, and the running balance silently loses the rest.
    const { client } = makeCappedSupabase(LEDGER)
    const truncated = (await (
      client as unknown as {
        from: () => { select: () => { or: () => { order: () => unknown } } }
      }
    )
      .from()
      .select()
      .or()
      .order()) as { data: Row[] }

    expect(truncated.data).toHaveLength(MAX_ROWS) // fewer rows, no error

    const snapshots = computeRunningBalances(
      truncated.data as unknown as RunningBalanceRow[],
      ACCOUNT,
      { ARS: INITIAL_BALANCE, USD: 0 },
    )
    const wrong = snapshots.get(truncated.data[MAX_ROWS - 1].id)

    const sums = balanceSumsFromRows(
      (
        await db.query<AccountBalanceSumRow>(
          `select account_id, currency_code, net
             from public.get_account_balance_sums(array['${ACCOUNT}']::uuid[])`,
        )
      ).rows,
    )
    const net = sums.get(ACCOUNT)?.ARS ?? 0

    expect(wrong?.ARS).not.toBeCloseTo(INITIAL_BALANCE + net, 6)
  })
})
