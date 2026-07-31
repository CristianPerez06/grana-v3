import { describe, expect, it } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  buildMonthBalanceSeries,
  calculateTransactionSums,
  type BalanceTransactionRow,
  type MonthBalanceTxInput,
} from '../src/aggregations'
import { getDashboardHero, getMonthBalanceSeries } from '../src/queries'

// ═══════════════════════════════════════════════════════════════════════════
// Regression coverage for the balance read-path defects (change
// `fix-balance-read-path-defects`):
//
//   1. `getMonthBalanceSeries` resolved its owned accounts WITHOUT
//      `is_active = true`, so an archived account's movements moved the month
//      net but not the Disponible → the reconciliation the `dashboard` spec
//      demands broke.
//   3. `classifyCashContribution` discarded EVERY `transfer`, assuming both
//      legs are owned. With one leg outside the owned universe the Disponible
//      moves and the month net did not.
//
// Both are the same failure mode: a plausible-but-wrong money number, no error.
// ═══════════════════════════════════════════════════════════════════════════

// ── Minimal Supabase fake ────────────────────────────────────────────────────
// Models the DB honestly instead of the query shape: it holds accounts +
// transactions and applies whatever predicate the query asks for. That makes
// the test agnostic to HOW the owned set is resolved (a filtered `.select()` or
// the `get_owned_account_ids` RPC) — it only pins the BEHAVIOUR.

type FakeAccount = { id: string; type: 'cash' | 'bank' | 'credit'; is_active: boolean }
type FakeTx = MonthBalanceTxInput & { id: string; created_at: string; status?: string | null }

const isOwned = (a: FakeAccount) => (a.type === 'cash' || a.type === 'bank') && a.is_active

function makeSupabase(db: { accounts: FakeAccount[]; transactions: FakeTx[] }) {
  function builder(table: string) {
    const eq: Record<string, unknown> = {}
    const inFilters: Record<string, unknown[]> = {}
    let from: string | null = null
    let to: string | null = null
    let rangeFrom = 0
    let rangeTo = Number.POSITIVE_INFINITY

    const run = () => {
      if (table === 'accounts') {
        const rows = db.accounts
          .filter((a) => (inFilters.type ? (inFilters.type as string[]).includes(a.type) : true))
          .filter((a) => ('is_active' in eq ? a.is_active === eq.is_active : true))
        return { data: rows.map((a) => ({ id: a.id })), error: null }
      }
      if (table === 'transactions') {
        // The account `.or(...)` predicate is intentionally NOT modelled: the
        // pure aggregation scopes rows by `ownedAccountIds` anyway, so handing
        // it a superset is safe and keeps the fake small.
        const rows = db.transactions
          .filter((t) => (t.status ?? null) === null)
          .filter((t) => (from ? t.date >= from : true))
          .filter((t) => (to ? t.date <= to : true))
          .map((t) => ({ ...t, period_payments: t.is_card_payment ? [{ id: `pp-${t.id}` }] : [] }))
        // `.range()` is honoured so the caller's exhaustive paging terminates.
        return {
          data: rows.slice(
            rangeFrom,
            rangeTo === Number.POSITIVE_INFINITY ? undefined : rangeTo + 1,
          ),
          error: null,
        }
      }
      throw new Error(`unexpected table: ${table}`)
    }

    const b: Record<string, unknown> = {
      select: () => b,
      eq: (col: string, val: unknown) => {
        eq[col] = val
        return b
      },
      in: (col: string, vals: unknown[]) => {
        inFilters[col] = vals
        return b
      },
      is: () => b,
      or: () => b,
      order: () => b,
      gte: (col: string, val: string) => {
        if (col === 'date') from = val
        return b
      },
      lte: (col: string, val: string) => {
        if (col === 'date') to = val
        return b
      },
      range: (start: number, end: number) => {
        rangeFrom = start
        rangeTo = end
        return b
      },
      then: (
        resolve: (v: unknown) => unknown,
        reject?: (e: unknown) => unknown,
      ) => Promise.resolve(run()).then(resolve, reject),
    }
    return b
  }

  return {
    from: (table: string) => builder(table),
    // Normative owned-account definition, mirrored from the migration.
    rpc: async (fn: string) => {
      if (fn === 'get_owned_account_ids') {
        return { data: db.accounts.filter(isOwned).map((a) => a.id), error: null }
      }
      throw new Error(`unexpected rpc: ${fn}`)
    },
  } as unknown as SupabaseClient
}

const txRow = (
  over: Partial<FakeTx> & Pick<FakeTx, 'id' | 'date' | 'type' | 'amount' | 'account_id'>,
): FakeTx => ({
  currency_code: 'ARS',
  created_at: `${over.date}T10:00:00Z`,
  status: null,
  ...over,
})

// ── 2.1 — an archived account must not feed the month series ─────────────────

describe('getMonthBalanceSeries — owned-account scoping', () => {
  const accounts: FakeAccount[] = [
    { id: 'cash-1', type: 'cash', is_active: true },
    { id: 'bank-archived', type: 'bank', is_active: false },
  ]

  it('excludes an archived bank account with movements from every row and from finalBalance', async () => {
    const supabase = makeSupabase({
      accounts,
      transactions: [
        txRow({ id: 't1', date: '2026-05-04', type: 'expense', amount: 100_000, account_id: 'cash-1' }),
        txRow({
          id: 't2',
          date: '2026-05-05',
          type: 'expense',
          amount: 777_000,
          account_id: 'bank-archived',
        }),
        txRow({ id: 't3', date: '2026-05-06', type: 'income', amount: 55_000, account_id: 'bank-archived' }),
      ],
    })

    const series = await getMonthBalanceSeries(supabase, 2026, 5)

    expect(series.ARS.totalExpense).toBe(100_000) // NOT 877_000
    expect(series.ARS.totalIncome).toBe(0) // the archived income does not count
    expect(series.ARS.finalBalance).toBe(-100_000)
  })

  it('still counts an active account of the same type', async () => {
    const supabase = makeSupabase({
      accounts: [...accounts, { id: 'bank-1', type: 'bank', is_active: true }],
      transactions: [
        txRow({ id: 't1', date: '2026-05-04', type: 'income', amount: 300_000, account_id: 'bank-1' }),
      ],
    })

    const series = await getMonthBalanceSeries(supabase, 2026, 5)
    expect(series.ARS.totalIncome).toBe(300_000)
    expect(series.ARS.finalBalance).toBe(300_000)
  })
})

// ── 2.2 — each transfer leg is evaluated on its own ──────────────────────────

describe('buildMonthBalanceSeries — transfer legs', () => {
  const accIds = ['cash-1', 'bank-1']
  const tx = (
    over: Partial<MonthBalanceTxInput> &
      Pick<MonthBalanceTxInput, 'date' | 'type' | 'amount' | 'account_id'>,
  ): MonthBalanceTxInput => ({ currency_code: 'ARS', ...over })

  it('subtracts when only the ORIGIN is an owned account', () => {
    const rows = [
      tx({
        date: '2026-05-10',
        type: 'transfer',
        amount: 100_000,
        account_id: 'cash-1',
        transfer_destination_account_id: 'bank-archived',
      }),
    ]
    const series = buildMonthBalanceSeries(2026, 5, rows, accIds, 'ARS')

    expect(series.finalBalance).toBe(-100_000)
    expect(series.totalTransfer).toBe(-100_000)
    // It is not spending: the "Gastos" row must stay clean.
    expect(series.totalExpense).toBe(0)
  })

  it('adds when only the DESTINATION is an owned account', () => {
    const rows = [
      tx({
        date: '2026-05-10',
        type: 'transfer',
        amount: 100_000,
        account_id: 'bank-archived',
        transfer_destination_account_id: 'bank-1',
      }),
    ]
    const series = buildMonthBalanceSeries(2026, 5, rows, accIds, 'ARS')

    expect(series.finalBalance).toBe(100_000)
    expect(series.totalTransfer).toBe(100_000)
    expect(series.totalIncome).toBe(0)
  })

  it('still nets to zero when BOTH legs are owned (visible behaviour unchanged)', () => {
    const rows = [
      tx({
        date: '2026-05-10',
        type: 'transfer',
        amount: 100_000,
        account_id: 'cash-1',
        transfer_destination_account_id: 'bank-1',
      }),
    ]
    const series = buildMonthBalanceSeries(2026, 5, rows, accIds, 'ARS')

    expect(series.finalBalance).toBe(0)
    expect(series.totalTransfer).toBe(0)
  })

  it('ignores a transfer with neither leg owned', () => {
    const rows = [
      tx({
        date: '2026-05-10',
        type: 'transfer',
        amount: 100_000,
        account_id: 'someone-else',
        transfer_destination_account_id: 'someone-else-2',
      }),
    ]
    const series = buildMonthBalanceSeries(2026, 5, rows, accIds, 'ARS')

    expect(series.finalBalance).toBe(0)
    expect(series.totalTransfer).toBe(0)
  })
})

// ── 2.3 — finalBalance reconciles with the Disponible over the same set ──────

describe('month net reconciles with the Disponible (archived account + one-legged transfer)', () => {
  // `cash-1`/`bank-1` are the owned universe; `bank-archived` is NOT (it is
  // archived, so its balance is out of the Disponible too).
  const accIds = ['cash-1', 'bank-1']
  const tx = (
    over: Partial<MonthBalanceTxInput> &
      Pick<MonthBalanceTxInput, 'date' | 'type' | 'amount' | 'account_id'>,
  ): MonthBalanceTxInput => ({ currency_code: 'ARS', ...over })

  const rows: MonthBalanceTxInput[] = [
    tx({ date: '2026-05-02', type: 'income', amount: 800_000, account_id: 'bank-1' }),
    tx({ date: '2026-05-04', type: 'expense', amount: 254_461.25, account_id: 'cash-1' }),
    // Movements on the ARCHIVED account: outside the owned universe, they move
    // neither the month net nor the Disponible.
    tx({ date: '2026-05-05', type: 'expense', amount: 777_000, account_id: 'bank-archived' }),
    tx({ date: '2026-05-06', type: 'income', amount: 55_000, account_id: 'bank-archived' }),
    // One-legged transfer: money LEAVES the owned universe.
    tx({
      date: '2026-05-10',
      type: 'transfer',
      amount: 100_000,
      account_id: 'cash-1',
      transfer_destination_account_id: 'bank-archived',
    }),
    // Two-legged transfer: nets to zero on both lenses.
    tx({
      date: '2026-05-11',
      type: 'transfer',
      amount: 60_000,
      account_id: 'cash-1',
      transfer_destination_account_id: 'bank-1',
    }),
  ]

  const sums = calculateTransactionSums(rows as unknown as BalanceTransactionRow[], accIds)
  const disponible = (currency: 'ARS' | 'USD') =>
    accIds.reduce((acc, id) => acc + (sums.get(id)?.[currency] ?? 0), 0)

  it('ARS net equals the ARS change in disponible', () => {
    const series = buildMonthBalanceSeries(2026, 5, rows, accIds, 'ARS')

    expect(series.finalBalance).toBeCloseTo(disponible('ARS'), 6)
    expect(series.finalBalance).toBe(445_538.75) // 800_000 − 254_461.25 − 100_000
  })

  it('the bucket identity still holds with the transfer bucket', () => {
    const s = buildMonthBalanceSeries(2026, 5, rows, accIds, 'ARS')

    expect(
      s.totalIncome -
        s.totalExpense -
        s.totalCardPayment +
        s.totalAdjustment +
        s.totalReimbursement +
        s.totalSettlement +
        s.totalExchange +
        s.totalTransfer,
    ).toBeCloseTo(s.finalBalance, 6)
  })
})

// ── Temporal cut (0052) — the Hero pins p_today to the AR financial date ─────
//
// The exclusion itself lives in SQL (parity-tested against
// `calculateTransactionSums` in apps/web). What the dashboard read path owns is
// the WIRING: every `get_account_balance_sums` call must pass `p_today` so the
// balance "hoy" is the same "hoy" the UI renders, never the DB server clock.

describe('getDashboardHero — temporal cut wiring', () => {
  it('passes the AR financial date as p_today to get_account_balance_sums', async () => {
    let capturedArgs: { p_account_ids?: string[]; p_today?: string } | undefined

    const supabase = {
      rpc: async (fn: string, args?: Record<string, unknown>) => {
        if (fn === 'get_owned_account_ids') return { data: ['cash-1'], error: null }
        if (fn === 'get_account_balance_sums') {
          capturedArgs = args as typeof capturedArgs
          return {
            data: [{ account_id: 'cash-1', currency_code: 'ARS', net: 100 }],
            error: null,
          }
        }
        throw new Error(`unexpected rpc: ${fn}`)
      },
      from: () => ({
        select: () => ({
          in: async () => ({
            data: [
              {
                id: 'cash-1',
                name: 'Efectivo',
                type: 'cash',
                color_key: null,
                icon_key: null,
                institution: null,
                currencies: [{ currency_code: 'ARS', initial_balance: 50 }],
              },
            ],
            error: null,
          }),
        }),
      }),
    } as unknown as SupabaseClient

    const hero = await getDashboardHero(supabase)

    expect(capturedArgs?.p_account_ids).toEqual(['cash-1'])
    // ISO YYYY-MM-DD, and exactly today in America/Argentina/Buenos_Aires.
    expect(capturedArgs?.p_today).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    const arToday = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Argentina/Buenos_Aires',
    }).format(new Date())
    expect(capturedArgs?.p_today).toBe(arToday)

    // The hero composes initial_balance + the (already cut) SQL net.
    expect(hero.ars).toBe(150)
  })
})
