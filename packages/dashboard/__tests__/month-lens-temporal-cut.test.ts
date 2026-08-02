import { describe, expect, it } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { buildMonthBalanceSeries, type MonthBalanceTxInput } from '../src/aggregations'
import { getMonthBalanceSeries, getMonthCategoryBreakdown } from '../src/queries'

// ═══════════════════════════════════════════════════════════════════════════
// Temporal cut on the MONTH lenses (change `cut-month-lenses-at-today`).
//
// Migration 0052 cut the BALANCE at today, but the month reads kept summing the
// whole calendar month. With every August expense dated after the 1st, "Balance
// del mes" showed −1.992.744 on a month where nothing had been spent yet: the
// unconfirmed recurrences were already counted as facts.
//
// The rule pinned here:
//   · CAJA (on-ledger, `status IS NULL`) → cut at today, inclusive.
//   · Card rows (`status` 'pending'/'paid') → NOT cut: the devengado lens
//     accrues a cuota in its MONTH, not on its day (spec `spending-by-category`).
//   · Past months are untouched; a month entirely ahead is empty.
// ═══════════════════════════════════════════════════════════════════════════

type FakeTx = MonthBalanceTxInput & {
  id: string
  created_at: string
  status?: string | null
  category_id?: string | null
  is_parent?: boolean
  is_shared?: boolean
}

/**
 * Supabase fake that models the PREDICATES honestly — including the PostgREST
 * `.or()` the cut relies on. It parses only the two shapes production sends:
 * the account `or` (ignored, the aggregation scopes by account anyway) and
 * `status.not.is.null,date.lte.<iso>`. Anything else throws, so a change in the
 * predicate cannot silently pass this test.
 */
function makeSupabase(db: { accounts: string[]; transactions: FakeTx[] }) {
  function builder(table: string) {
    const eq: Record<string, unknown> = {}
    const isNull: Record<string, boolean> = {}
    let from: string | null = null
    let to: string | null = null
    let cutToday: string | null = null
    let rangeFrom = 0
    let rangeTo = Number.POSITIVE_INFINITY

    const run = () => {
      if (table === 'transactions') {
        const rows = db.transactions
          .filter((t) => (eq.type ? t.type === eq.type : true))
          .filter((t) => ('status' in isNull ? (t.status ?? null) === null : true))
          .filter((t) => (from ? t.date >= from : true))
          .filter((t) => (to ? t.date <= to : true))
          // The cut, as PostgREST would apply it: card rows pass regardless.
          .filter((t) => (cutToday ? (t.status ?? null) !== null || t.date <= cutToday : true))
          .map((t) => ({
            ...t,
            period_payments: t.is_card_payment ? [{ id: `pp-${t.id}` }] : [],
          }))
        return {
          data: rows.slice(rangeFrom, rangeTo === Number.POSITIVE_INFINITY ? undefined : rangeTo + 1),
          error: null,
        }
      }
      if (table === 'categories') return { data: [], error: null }
      throw new Error(`unexpected table: ${table}`)
    }

    const b: Record<string, unknown> = {
      select: () => b,
      eq: (col: string, val: unknown) => {
        eq[col] = val
        return b
      },
      in: () => b,
      not: () => b,
      is: (col: string) => {
        isNull[col] = true
        return b
      },
      or: (filter: string) => {
        if (filter.startsWith('account_id.in.')) return b // account scoping, not the cut
        const m = /^status\.not\.is\.null,date\.lte\.(\d{4}-\d{2}-\d{2})$/.exec(filter)
        if (!m) throw new Error(`unrecognised or() filter: ${filter}`)
        cutToday = m[1]
        return b
      },
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
      then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
        Promise.resolve(run()).then(resolve, reject),
    }
    return b
  }

  return {
    from: (table: string) => builder(table),
    rpc: async (fn: string) => {
      if (fn === 'get_owned_account_ids') return { data: db.accounts, error: null }
      throw new Error(`unexpected rpc: ${fn}`)
    },
  } as unknown as SupabaseClient
}

const tx = (
  over: Partial<FakeTx> & Pick<FakeTx, 'id' | 'date' | 'type' | 'amount' | 'account_id'>,
): FakeTx => ({
  currency_code: 'ARS',
  created_at: `${over.date}T10:00:00Z`,
  status: null,
  is_parent: false,
  is_shared: false,
  ...over,
})

// ── Balance del mes ──────────────────────────────────────────────────────────

describe('getMonthBalanceSeries — temporal cut at today', () => {
  const accounts = ['cash-1']

  // The reported bug, reduced: today is the 1st and every expense of the month
  // is a future-dated recurrence.
  const augustRows = [
    tx({ id: 'rent', date: '2026-08-08', type: 'expense', amount: 1_505_723.93, account_id: 'cash-1' }),
    tx({ id: 'expensas', date: '2026-08-12', type: 'expense', amount: 386_330.26, account_id: 'cash-1' }),
    tx({ id: 'today-coffee', date: '2026-08-01', type: 'expense', amount: 4_000, account_id: 'cash-1' }),
  ]

  it('excludes future-dated rows from the totals and from finalBalance', async () => {
    const supabase = makeSupabase({ accounts, transactions: augustRows })

    const series = await getMonthBalanceSeries(supabase, 2026, 8, '2026-08-01')

    // Only the movement dated TODAY counts — not the 1.992.054,19 still ahead.
    expect(series.ARS.totalExpense).toBe(4_000)
    expect(series.ARS.finalBalance).toBe(-4_000)
  })

  it('draws days only up to today, not the whole month', async () => {
    const supabase = makeSupabase({ accounts, transactions: augustRows })

    const series = await getMonthBalanceSeries(supabase, 2026, 8, '2026-08-10')

    expect(series.ARS.days).toHaveLength(10)
    expect(series.ARS.days.at(-1)?.day).toBe(10)
    // The 8th already happened, the 12th has not.
    expect(series.ARS.totalExpense).toBe(1_509_723.93)
  })

  it('is inclusive on today and exclusive on tomorrow', async () => {
    const supabase = makeSupabase({
      accounts,
      transactions: [
        tx({ id: 'today', date: '2026-08-15', type: 'expense', amount: 100, account_id: 'cash-1' }),
        tx({ id: 'tomorrow', date: '2026-08-16', type: 'expense', amount: 999, account_id: 'cash-1' }),
      ],
    })

    const series = await getMonthBalanceSeries(supabase, 2026, 8, '2026-08-15')
    expect(series.ARS.totalExpense).toBe(100)
  })

  it('leaves a past month whole', async () => {
    const supabase = makeSupabase({
      accounts,
      transactions: [
        tx({ id: 'a', date: '2026-07-08', type: 'expense', amount: 1_000, account_id: 'cash-1' }),
        tx({ id: 'b', date: '2026-07-31', type: 'expense', amount: 2_000, account_id: 'cash-1' }),
      ],
    })

    const series = await getMonthBalanceSeries(supabase, 2026, 7, '2026-08-01')

    expect(series.ARS.totalExpense).toBe(3_000)
    expect(series.ARS.days).toHaveLength(31)
  })

  it('returns an empty series for a month that has not started', async () => {
    const supabase = makeSupabase({
      accounts,
      transactions: [
        tx({ id: 'sep', date: '2026-09-10', type: 'expense', amount: 115_542.97, account_id: 'cash-1' }),
      ],
    })

    const series = await getMonthBalanceSeries(supabase, 2026, 9, '2026-08-01')

    expect(series.ARS.days).toHaveLength(0)
    expect(series.ARS.totalExpense).toBe(0)
    expect(series.ARS.finalBalance).toBe(0)
  })
})

// ── buildMonthBalanceSeries — the cutoff is the aggregation's own guard ───────

describe('buildMonthBalanceSeries — cutoffDay', () => {
  const rows: MonthBalanceTxInput[] = [
    { date: '2026-08-05', type: 'expense', amount: 500, account_id: 'cash-1', currency_code: 'ARS' },
    { date: '2026-08-25', type: 'expense', amount: 700, account_id: 'cash-1', currency_code: 'ARS' },
  ]

  it('drops rows past the cutoff even if the caller hands them over', () => {
    const series = buildMonthBalanceSeries(2026, 8, rows, ['cash-1'], 'ARS', 10)

    expect(series.totalExpense).toBe(500)
    expect(series.days).toHaveLength(10)
  })

  it('covers the whole month when no cutoff is given', () => {
    const series = buildMonthBalanceSeries(2026, 8, rows, ['cash-1'], 'ARS')

    expect(series.totalExpense).toBe(1_200)
    expect(series.days).toHaveLength(31)
  })

  it('never stretches past the real end of the month', () => {
    const series = buildMonthBalanceSeries(2026, 2, [], ['cash-1'], 'ARS', 45)
    expect(series.days).toHaveLength(28)
  })
})

// ── ¿En qué gasté? — CAJA cut, devengado preserved for cards ─────────────────

describe('getMonthCategoryBreakdown — CAJA cut, card accrual preserved', () => {
  it('drops a future-dated cash expense but keeps a card cuota dated later in the month', async () => {
    const supabase = makeSupabase({
      accounts: ['cash-1'],
      transactions: [
        // CAJA, still ahead → not spent yet.
        tx({
          id: 'future-cash',
          date: '2026-08-20',
          type: 'expense',
          amount: 300_000,
          account_id: 'cash-1',
          category_id: 'hogar',
        }),
        // Card cuota dated the 20th: incurred, accrues in August from day 1.
        tx({
          id: 'cuota',
          date: '2026-08-20',
          type: 'expense',
          amount: 50_000,
          account_id: 'card-1',
          category_id: 'hogar',
          status: 'pending',
        }),
        // Cash expense already made.
        tx({
          id: 'past-cash',
          date: '2026-08-01',
          type: 'expense',
          amount: 4_000,
          account_id: 'cash-1',
          category_id: 'hogar',
        }),
      ],
    })

    const breakdown = await getMonthCategoryBreakdown(supabase, '2026-08', '2026-08-01')

    const hogar = breakdown.ARS.find((s) => s.categoryId === 'hogar')
    // 50.000 (cuota devengada) + 4.000 (gasto de hoy). NOT the 300.000 ahead.
    expect(hogar?.value).toBe(54_000)
  })
})
