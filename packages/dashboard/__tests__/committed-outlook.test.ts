import { describe, expect, it } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getCommittedOutlook } from '../src/queries'

// ═══════════════════════════════════════════════════════════════════════════
// "Compromisos del próximo mes" — the window is the NEXT CALENDAR MONTH.
//
// The card used to read "from today" (statements already STARTED, recurrence
// instances already PENDING) while its title promised the next month: the title
// said one thing and the amount showed another. These tests pin the four rules
// the spec now states, each of which is a different way to get the number wrong:
//
//   · a statement belongs to the window by its DUE date, not its close date
//   · a recurrence debited from a credit card is NOT a fixed expense (it is
//     already inside that card's statement — counting both is counting twice)
//   · generated instances and projected occurrences must not overlap
//   · overdue money is carried apart, never folded into the month's total
// ═══════════════════════════════════════════════════════════════════════════

const TODAY = '2026-08-20' // → window is September 2026 [09-01, 09-30]

type FakeAccount = { id: string; name: string; type: string; is_active: boolean }
type FakePeriod = {
  id: string
  account_id: string
  start_date: string
  end_date: string
  due_date: string
}
type FakeTx = {
  card_period_id: string
  type: string
  amount: number
  currency_code: string
  status: string | null
  received_at?: string | null
  cancelled_at?: string | null
  is_parent?: boolean
  description?: string | null
  date?: string
}
type FakeRule = {
  id: string
  movement_type: 'income' | 'expense' | 'transfer'
  account_id: string
  amount: number
  currency_code: string
  description: string | null
  start_date: string
  end_date?: string | null
  interval_count?: number
  interval_unit?: string
  max_occurrences?: number | null
  last_generated_date?: string | null
  status?: string
}
type FakeInstance = {
  recurrence_id: string
  account_id: string
  amount: number
  currency_code: string
  description: string | null
  scheduled_date: string
  status: string
}

type Db = {
  accounts?: FakeAccount[]
  card_periods?: FakePeriod[]
  period_payments?: Array<{ period_id: string }>
  transactions?: FakeTx[]
  recurrences?: FakeRule[]
  recurrence_instances?: FakeInstance[]
}

/**
 * Minimal Supabase fake that models the TABLES, not the query shape: it applies
 * whatever predicates the query asks for, so the test pins the behaviour and
 * not the particular set of filters the implementation happens to use today.
 */
function makeSupabase(db: Db) {
  const rules = db.recurrences ?? []

  function builder(table: string) {
    const eq: Record<string, unknown> = {}
    const inFilters: Record<string, unknown[]> = {}
    const gte: Record<string, string> = {}
    const lte: Record<string, string> = {}

    const keep = <T extends Record<string, unknown>>(rows: T[]): T[] =>
      rows
        .filter((r) => Object.entries(eq).every(([c, v]) => r[c] === v))
        .filter((r) => Object.entries(inFilters).every(([c, v]) => v.includes(r[c])))
        .filter((r) => Object.entries(gte).every(([c, v]) => String(r[c]) >= v))
        .filter((r) => Object.entries(lte).every(([c, v]) => String(r[c]) <= v))

    const run = () => {
      switch (table) {
        case 'accounts':
          return {
            data: keep(db.accounts ?? []).map((a) => ({
              id: a.id,
              name: a.name,
              is_active: a.is_active,
              institution: null,
            })),
            error: null,
          }
        case 'card_periods':
          return { data: keep(db.card_periods ?? []), error: null }
        case 'period_payments':
          return { data: keep(db.period_payments ?? []), error: null }
        case 'transactions':
          return {
            data: keep(
              (db.transactions ?? []).map((t) => ({
                is_parent: false,
                received_at: null,
                cancelled_at: null,
                description: null,
                date: TODAY,
                category: null,
                subcategory: null,
                ...t,
              })),
            ),
            error: null,
          }
        case 'recurrences':
          return {
            data: keep(
              rules.map((r) => ({
                end_date: null,
                interval_count: 1,
                interval_unit: 'month',
                max_occurrences: null,
                last_generated_date: null,
                status: 'active',
                category: null,
                subcategory: null,
                ...r,
              })),
            ),
            error: null,
          }
        case 'recurrence_instances':
          return {
            data: keep(db.recurrence_instances ?? []).map((i) => ({
              ...i,
              category: null,
              subcategory: null,
              // The query reads the rule's movement_type through the embed.
              recurrence: { movement_type: rules.find((r) => r.id === i.recurrence_id)?.movement_type },
            })),
            error: null,
          }
        default:
          throw new Error(`unexpected table: ${table}`)
      }
    }

    const b: Record<string, unknown> = {
      select: () => b,
      eq: (c: string, v: unknown) => {
        eq[c] = v
        return b
      },
      in: (c: string, v: unknown[]) => {
        inFilters[c] = v
        return b
      },
      gte: (c: string, v: string) => {
        gte[c] = v
        return b
      },
      lte: (c: string, v: string) => {
        lte[c] = v
        return b
      },
      then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
        Promise.resolve(run()).then(resolve, reject),
    }
    return b
  }

  return { from: (table: string) => builder(table) } as unknown as SupabaseClient
}

const visa: FakeAccount = { id: 'visa', name: 'Visa', type: 'credit', is_active: true }
const bank: FakeAccount = { id: 'bank', name: 'Banco', type: 'bank', is_active: true }

const consumo = (period: string, amount: number): FakeTx => ({
  card_period_id: period,
  type: 'expense',
  amount,
  currency_code: 'ARS',
  status: 'pending',
})

// ── Tarjetas: the window is decided by the DUE date ──────────────────────────

describe('getCommittedOutlook — statements belong to the window by due date', () => {
  it('excludes a statement that closes inside the window but is due after it', async () => {
    const supabase = makeSupabase({
      accounts: [visa, bank],
      card_periods: [
        // Closes 28/09 (inside September) but is due 10/10 → paid in October.
        { id: 'p-oct', account_id: 'visa', start_date: '2026-08-29', end_date: '2026-09-28', due_date: '2026-10-10' },
      ],
      transactions: [consumo('p-oct', 100_000)],
    })

    const out = await getCommittedOutlook(supabase, TODAY)
    expect(out.ARS.debt).toBe(0)
    expect(out.ARS.cards).toEqual([])
  })

  it('includes a statement due inside the window, whenever it closed', async () => {
    const supabase = makeSupabase({
      accounts: [visa, bank],
      card_periods: [
        { id: 'p-sep', account_id: 'visa', start_date: '2026-07-29', end_date: '2026-08-28', due_date: '2026-09-10' },
      ],
      transactions: [consumo('p-sep', 100_000)],
    })

    const out = await getCommittedOutlook(supabase, TODAY)
    expect(out.ARS.debt).toBe(100_000)
    expect(out.ARS.cards).toEqual([
      // Closes 28/08, still ahead of today → that is the next close.
      { id: 'visa', label: 'Visa', amount: 100_000, nextClose: '2026-08-28' },
    ])
  })

  it('drops a statement that is already paid', async () => {
    const supabase = makeSupabase({
      accounts: [visa],
      card_periods: [
        { id: 'p-sep', account_id: 'visa', start_date: '2026-07-29', end_date: '2026-08-28', due_date: '2026-09-10' },
      ],
      period_payments: [{ period_id: 'p-sep' }],
      transactions: [consumo('p-sep', 100_000)],
    })

    const out = await getCommittedOutlook(supabase, TODAY)
    expect(out.ARS.debt).toBe(0)
  })

  it('nets received statement reimbursements out of the debt', async () => {
    const supabase = makeSupabase({
      accounts: [visa],
      card_periods: [
        { id: 'p-sep', account_id: 'visa', start_date: '2026-07-29', end_date: '2026-08-28', due_date: '2026-09-10' },
      ],
      transactions: [
        consumo('p-sep', 100_000),
        {
          card_period_id: 'p-sep',
          type: 'reimbursement',
          amount: 30_000,
          currency_code: 'ARS',
          status: null,
          received_at: '2026-08-15',
        },
      ],
    })

    const out = await getCommittedOutlook(supabase, TODAY)
    expect(out.ARS.debt).toBe(70_000)
  })
})

// ── Overdue: carried apart, never inside the month's total ───────────────────

describe('getCommittedOutlook — overdue is disjoint from the window', () => {
  it('reports an overdue statement under `overdue` and keeps it out of `debt`', async () => {
    const supabase = makeSupabase({
      accounts: [visa],
      card_periods: [
        { id: 'p-late', account_id: 'visa', start_date: '2026-06-29', end_date: '2026-07-28', due_date: '2026-08-10' },
        { id: 'p-sep', account_id: 'visa', start_date: '2026-07-29', end_date: '2026-08-28', due_date: '2026-09-10' },
      ],
      transactions: [consumo('p-late', 40_000), consumo('p-sep', 100_000)],
    })

    const out = await getCommittedOutlook(supabase, TODAY)
    expect(out.ARS.overdue).toBe(40_000)
    expect(out.ARS.debt).toBe(100_000)
    // The by-card rows add up to `debt`: the late money has its own line.
    expect(out.ARS.cards.reduce((acc, c) => acc + c.amount, 0)).toBe(100_000)
  })

  it('leaves a statement due later THIS month out of both sets', async () => {
    const supabase = makeSupabase({
      accounts: [visa],
      card_periods: [
        { id: 'p-aug', account_id: 'visa', start_date: '2026-06-29', end_date: '2026-07-28', due_date: '2026-08-25' },
      ],
      transactions: [consumo('p-aug', 55_000)],
    })

    const out = await getCommittedOutlook(supabase, TODAY)
    expect(out.ARS.debt).toBe(0)
    expect(out.ARS.overdue).toBe(0)
  })
})

// ── Gastos fijos ─────────────────────────────────────────────────────────────

describe('getCommittedOutlook — fixed expenses in the window', () => {
  it('excludes a recurrence debited from a credit card', async () => {
    const supabase = makeSupabase({
      accounts: [visa, bank],
      recurrences: [
        {
          id: 'r-netflix',
          movement_type: 'expense',
          account_id: 'visa', // debited from the card → lands in its statement
          amount: 9_000,
          currency_code: 'ARS',
          description: 'Netflix',
          start_date: '2026-01-05',
        },
        {
          id: 'r-alquiler',
          movement_type: 'expense',
          account_id: 'bank',
          amount: 500_000,
          currency_code: 'ARS',
          description: 'Alquiler',
          start_date: '2026-01-05',
        },
      ],
    })

    const out = await getCommittedOutlook(supabase, TODAY)
    expect(out.ARS.recurringExpense).toBe(500_000)
    expect(out.ARS.topRecurring.map((i) => i.description)).toEqual(['Alquiler'])
  })

  it('counts a generated instance once and does not re-project it', async () => {
    const supabase = makeSupabase({
      accounts: [bank],
      recurrences: [
        {
          id: 'r-alquiler',
          movement_type: 'expense',
          account_id: 'bank',
          amount: 500_000,
          currency_code: 'ARS',
          description: 'Alquiler',
          start_date: '2026-01-05',
          // The generator already produced September's occurrence.
          last_generated_date: '2026-09-05',
        },
      ],
      recurrence_instances: [
        {
          recurrence_id: 'r-alquiler',
          account_id: 'bank',
          amount: 500_000,
          currency_code: 'ARS',
          description: 'Alquiler',
          scheduled_date: '2026-09-05',
          status: 'pending',
        },
      ],
    })

    const out = await getCommittedOutlook(supabase, TODAY)
    expect(out.ARS.recurringExpense).toBe(500_000)
    expect(out.ARS.topRecurring).toHaveLength(1)
  })

  it('ignores a recurrence whose occurrence falls outside the window', async () => {
    const supabase = makeSupabase({
      accounts: [bank],
      recurrences: [
        {
          id: 'r-annual',
          movement_type: 'expense',
          account_id: 'bank',
          amount: 300_000,
          currency_code: 'ARS',
          description: 'Seguro anual',
          start_date: '2026-03-10',
          interval_count: 1,
          interval_unit: 'year',
        },
      ],
    })

    const out = await getCommittedOutlook(supabase, TODAY)
    expect(out.ARS.recurringExpense).toBe(0)
  })

  it('ignores an instance of the window that somebody already resolved', async () => {
    const supabase = makeSupabase({
      accounts: [bank],
      recurrences: [
        {
          id: 'r-alquiler',
          movement_type: 'expense',
          account_id: 'bank',
          amount: 500_000,
          currency_code: 'ARS',
          description: 'Alquiler',
          start_date: '2026-01-05',
          last_generated_date: '2026-09-05',
        },
      ],
      recurrence_instances: [
        {
          recurrence_id: 'r-alquiler',
          account_id: 'bank',
          amount: 500_000,
          currency_code: 'ARS',
          description: 'Alquiler',
          scheduled_date: '2026-09-05',
          status: 'confirmed',
        },
      ],
    })

    const out = await getCommittedOutlook(supabase, TODAY)
    expect(out.ARS.recurringExpense).toBe(0)
  })

  it('keeps ARS and USD apart', async () => {
    const supabase = makeSupabase({
      accounts: [bank],
      recurrences: [
        {
          id: 'r-ars',
          movement_type: 'expense',
          account_id: 'bank',
          amount: 500_000,
          currency_code: 'ARS',
          description: 'Alquiler',
          start_date: '2026-01-05',
        },
        {
          id: 'r-usd',
          movement_type: 'expense',
          account_id: 'bank',
          amount: 120,
          currency_code: 'USD',
          description: 'Hosting',
          start_date: '2026-01-12',
        },
      ],
    })

    const out = await getCommittedOutlook(supabase, TODAY)
    expect(out.ARS.recurringExpense).toBe(500_000)
    expect(out.USD.recurringExpense).toBe(120)
  })
})

// ── Recurring income: context, never a commitment ────────────────────────────

describe('getCommittedOutlook — recurring income', () => {
  it('projects income into the window without the credit-card exclusion', async () => {
    const supabase = makeSupabase({
      accounts: [visa, bank],
      recurrences: [
        {
          id: 'r-sueldo',
          movement_type: 'income',
          account_id: 'bank',
          amount: 2_000_000,
          currency_code: 'ARS',
          description: 'Sueldo',
          start_date: '2026-01-01',
        },
      ],
    })

    const out = await getCommittedOutlook(supabase, TODAY)
    expect(out.ARS.recurringIncome).toBe(2_000_000)
    // Income is context: it never enters the committed side.
    expect(out.ARS.recurringExpense).toBe(0)
    expect(out.ARS.debt).toBe(0)
  })
})

describe('getCommittedOutlook — nothing committed', () => {
  it('returns zeros for both currencies', async () => {
    const out = await getCommittedOutlook(makeSupabase({ accounts: [bank] }), TODAY)
    for (const cur of ['ARS', 'USD'] as const) {
      expect(out[cur]).toEqual({
        debt: 0,
        overdue: 0,
        recurringExpense: 0,
        recurringIncome: 0,
        cards: [],
        topRecurring: [],
      })
    }
  })
})
