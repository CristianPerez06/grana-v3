import { describe, expect, it } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getCommittedOutlookForMonth } from '../src/queries'

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

const TODAY = '2026-08-20'

// Standing on the CURRENT month: window September 2026 [09-01, 09-30], lens
// 'live', snapshot = today. Identical to what the old single-argument signature
// produced, which is what makes the cases below a regression net rather than a
// rewrite: same inputs, same expectations, new signature.
const CURRENT_MONTH = { year: 2026, month: 8, todayISO: TODAY }
/** Standing on the PREVIOUS month: window August, snapshot 31/07, still running. */
const PREVIOUS_MONTH = { year: 2026, month: 7, todayISO: TODAY }
/** Standing further back: window July, snapshot 30/06, already elapsed. */
const ELAPSED_MONTH = { year: 2026, month: 6, todayISO: TODAY }

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
  /** `paid_on` is the payment movement's financial date; omit for 'no date'. */
  period_payments?: Array<{ period_id: string; paid_on?: string }>
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
          return {
            data: keep(db.period_payments ?? []).map((p) => ({
              period_id: p.period_id,
              transaction: { date: p.paid_on ?? null },
            })),
            error: null,
          }
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

describe('getCommittedOutlookForMonth — statements belong to the window by due date', () => {
  it('excludes a statement that closes inside the window but is due after it', async () => {
    const supabase = makeSupabase({
      accounts: [visa, bank],
      card_periods: [
        // Closes 28/09 (inside September) but is due 10/10 → paid in October.
        { id: 'p-oct', account_id: 'visa', start_date: '2026-08-29', end_date: '2026-09-28', due_date: '2026-10-10' },
      ],
      transactions: [consumo('p-oct', 100_000)],
    })

    const out = await getCommittedOutlookForMonth(supabase, CURRENT_MONTH)
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

    const out = await getCommittedOutlookForMonth(supabase, CURRENT_MONTH)
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

    const out = await getCommittedOutlookForMonth(supabase, CURRENT_MONTH)
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

    const out = await getCommittedOutlookForMonth(supabase, CURRENT_MONTH)
    expect(out.ARS.debt).toBe(70_000)
  })
})

// ── Overdue: carried apart, never inside the month's total ───────────────────

describe('getCommittedOutlookForMonth — overdue is disjoint from the window', () => {
  it('reports an overdue statement under `overdue` and keeps it out of `debt`', async () => {
    const supabase = makeSupabase({
      accounts: [visa],
      card_periods: [
        { id: 'p-late', account_id: 'visa', start_date: '2026-06-29', end_date: '2026-07-28', due_date: '2026-08-10' },
        { id: 'p-sep', account_id: 'visa', start_date: '2026-07-29', end_date: '2026-08-28', due_date: '2026-09-10' },
      ],
      transactions: [consumo('p-late', 40_000), consumo('p-sep', 100_000)],
    })

    const out = await getCommittedOutlookForMonth(supabase, CURRENT_MONTH)
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

    const out = await getCommittedOutlookForMonth(supabase, CURRENT_MONTH)
    expect(out.ARS.debt).toBe(0)
    expect(out.ARS.overdue).toBe(0)
  })
})

// ── Gastos fijos ─────────────────────────────────────────────────────────────

describe('getCommittedOutlookForMonth — fixed expenses in the window', () => {
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

    const out = await getCommittedOutlookForMonth(supabase, CURRENT_MONTH)
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

    const out = await getCommittedOutlookForMonth(supabase, CURRENT_MONTH)
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

    const out = await getCommittedOutlookForMonth(supabase, CURRENT_MONTH)
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

    const out = await getCommittedOutlookForMonth(supabase, CURRENT_MONTH)
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

    const out = await getCommittedOutlookForMonth(supabase, CURRENT_MONTH)
    expect(out.ARS.recurringExpense).toBe(500_000)
    expect(out.USD.recurringExpense).toBe(120)
  })
})

// ── Recurring income: context, never a commitment ────────────────────────────

describe('getCommittedOutlookForMonth — recurring income', () => {
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

    const out = await getCommittedOutlookForMonth(supabase, CURRENT_MONTH)
    expect(out.ARS.recurringIncome).toBe(2_000_000)
    // Income is context: it never enters the committed side.
    expect(out.ARS.recurringExpense).toBe(0)
    expect(out.ARS.debt).toBe(0)
  })
})

describe('getCommittedOutlookForMonth — nothing committed', () => {
  it('returns zeros for both currencies', async () => {
    const out = await getCommittedOutlookForMonth(makeSupabase({ accounts: [bank] }), CURRENT_MONTH)
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

// ═══════════════════════════════════════════════════════════════════════════
// The SNAPSHOT lens: the window is the month after a PAST selected month, and
// each commitment's state is evaluated at that month's close.
//
// Every case below reads zero under the old implementation — not by one rule but
// by four stacked ones (payment filtered by today's state, consumos summed only
// while `pending`, instances filtered to `pending`, projection cursor already
// past the window). That is the point: a past window needed a different lens,
// not a different date.
// ═══════════════════════════════════════════════════════════════════════════

/** A consumo on a statement that has since been paid: `payCardPeriod` flips these. */
const paidConsumo = (period: string, amount: number): FakeTx => ({
  card_period_id: period,
  type: 'expense',
  amount,
  currency_code: 'ARS',
  status: 'paid',
})

/** July's statement: closes 25/06, due 10/07 — inside the window, closed at the cut. */
const julyPeriod: FakePeriod = {
  id: 'p-jul',
  account_id: 'visa',
  start_date: '2026-05-26',
  end_date: '2026-06-25',
  due_date: '2026-07-10',
}

describe('getCommittedOutlookForMonth — payment is evaluated at the snapshot', () => {
  it('counts a statement of the window that was never paid', async () => {
    const out = await getCommittedOutlookForMonth(
      makeSupabase({
        accounts: [visa, bank],
        card_periods: [julyPeriod],
        transactions: [consumo('p-jul', 143000)],
      }),
      ELAPSED_MONTH,
    )
    expect(out.ARS.debt).toBe(143000)
  })

  it('counts a statement paid AFTER the cut: at the cut it was still owed', async () => {
    const out = await getCommittedOutlookForMonth(
      makeSupabase({
        accounts: [visa, bank],
        card_periods: [julyPeriod],
        // Paid on 12/07 — the consumos are 'paid' today, which is exactly the
        // state the status-based sum reads as zero.
        period_payments: [{ period_id: 'p-jul', paid_on: '2026-07-12' }],
        transactions: [paidConsumo('p-jul', 143000)],
      }),
      ELAPSED_MONTH,
    )
    expect(out.ARS.debt).toBe(143000)
  })

  it('excludes a statement paid BEFORE the cut: by then it was not a commitment', async () => {
    const out = await getCommittedOutlookForMonth(
      makeSupabase({
        accounts: [visa, bank],
        card_periods: [julyPeriod],
        // Closed 25/06, due 10/07, settled 25/06 — a supported flow.
        period_payments: [{ period_id: 'p-jul', paid_on: '2026-06-25' }],
        transactions: [paidConsumo('p-jul', 210000)],
      }),
      ELAPSED_MONTH,
    )
    expect(out.ARS.debt).toBe(0)
  })

  it('is stable: paying after the cut does not move the number', async () => {
    const base = {
      accounts: [visa, bank],
      card_periods: [julyPeriod],
    }
    const beforePaying = await getCommittedOutlookForMonth(
      makeSupabase({ ...base, transactions: [consumo('p-jul', 143000)] }),
      ELAPSED_MONTH,
    )
    const afterPaying = await getCommittedOutlookForMonth(
      makeSupabase({
        ...base,
        period_payments: [{ period_id: 'p-jul', paid_on: '2026-07-12' }],
        transactions: [paidConsumo('p-jul', 143000)],
      }),
      ELAPSED_MONTH,
    )
    expect(afterPaying.ARS.debt).toBe(beforePaying.ARS.debt)
  })
})

describe('getCommittedOutlookForMonth — consumos are never cut by date', () => {
  it('counts an installment dated inside the window but committed long before', async () => {
    // A May purchase in 12 instalments inserts every child at purchase time,
    // dated `fechaCompra + i meses`. The child below is dated 05/07 — AFTER the
    // 30/06 cut — and belongs to a statement due 28/07. Cutting consumos by
    // `transactions.date` would drop exactly this row, and these are the bulk of
    // a statement here.
    const out = await getCommittedOutlookForMonth(
      makeSupabase({
        accounts: [visa, bank],
        card_periods: [
          { id: 'p-amex', account_id: 'visa', start_date: '2026-06-13', end_date: '2026-07-12', due_date: '2026-07-28' },
        ],
        transactions: [{ ...consumo('p-amex', 50000), date: '2026-07-05' }],
      }),
      ELAPSED_MONTH,
    )
    expect(out.ARS.debt).toBe(50000)
  })

  it('a statement still open at the cut contributes its full content', async () => {
    // Closes 12/07, after the 30/06 cut: at the cut it held only part of this.
    // The card reports what had to be paid, not what the screen showed that day,
    // so the total does not change once the statement closes.
    const out = await getCommittedOutlookForMonth(
      makeSupabase({
        accounts: [visa, bank],
        card_periods: [
          { id: 'p-open', account_id: 'visa', start_date: '2026-06-13', end_date: '2026-07-12', due_date: '2026-07-28' },
        ],
        transactions: [
          { ...consumo('p-open', 85000), date: '2026-06-20' },
          { ...consumo('p-open', 50000), date: '2026-07-05' },
        ],
      }),
      ELAPSED_MONTH,
    )
    expect(out.ARS.debt).toBe(135000)
  })
})

describe('getCommittedOutlookForMonth — fixed expenses over an elapsed window', () => {
  const rule: FakeRule = {
    id: 'r-1',
    movement_type: 'expense',
    account_id: 'bank',
    amount: 400000,
    currency_code: 'ARS',
    description: 'Alquiler',
    start_date: '2026-01-05',
    last_generated_date: '2026-07-05',
  }

  it('counts confirmed and pending instances, never skipped', async () => {
    const out = await getCommittedOutlookForMonth(
      makeSupabase({
        accounts: [bank],
        recurrences: [rule],
        recurrence_instances: [
          { recurrence_id: 'r-1', account_id: 'bank', amount: 400000, currency_code: 'ARS', description: 'Alquiler', scheduled_date: '2026-07-05', status: 'confirmed' },
          { recurrence_id: 'r-1', account_id: 'bank', amount: 65000, currency_code: 'ARS', description: 'Expensas', scheduled_date: '2026-07-15', status: 'pending' },
          { recurrence_id: 'r-1', account_id: 'bank', amount: 30000, currency_code: 'ARS', description: 'Gimnasio', scheduled_date: '2026-07-10', status: 'skipped' },
        ],
      }),
      ELAPSED_MONTH,
    )
    // 400.000 confirmada + 65.000 pendiente; la salteada no ocurrió.
    expect(out.ARS.recurringExpense).toBe(465000)
  })

  it('does not project active rules over a window that already ended', async () => {
    const out = await getCommittedOutlookForMonth(
      makeSupabase({
        accounts: [bank],
        // Cursor before the window, so the projection WOULD emit July occurrences
        // — priced at today's amount, and blind to rules retired since.
        recurrences: [{ ...rule, last_generated_date: '2026-06-05' }],
      }),
      ELAPSED_MONTH,
    )
    expect(out.ARS.recurringExpense).toBe(0)
  })
})

describe('getCommittedOutlookForMonth — the previous month, whose window is still running', () => {
  // The position that broke a single `mode` field: on 20/08, looking at July,
  // the window is August — not elapsed — but the cut is still 31/07.
  const augustRule: FakeRule = {
    id: 'r-ago',
    movement_type: 'expense',
    account_id: 'bank',
    amount: 400000,
    currency_code: 'ARS',
    description: 'Alquiler',
    start_date: '2026-01-05',
    // Cursor already inside the window: the projection adds nothing, so these
    // cases isolate the instances.
    last_generated_date: '2026-08-05',
  }
  const instance = (status: string) => ({
    recurrence_id: 'r-ago',
    account_id: 'bank',
    amount: 400000,
    currency_code: 'ARS',
    description: 'Alquiler',
    scheduled_date: '2026-08-05',
    status,
  })

  it('evaluates payment at the previous month’s close, not at today', async () => {
    const out = await getCommittedOutlookForMonth(
      makeSupabase({
        accounts: [visa, bank],
        card_periods: [
          { id: 'p-ago', account_id: 'visa', start_date: '2026-07-01', end_date: '2026-07-25', due_date: '2026-08-10' },
        ],
        // Paid on 15/08 — after the 31/07 cut, so it was still owed then.
        period_payments: [{ period_id: 'p-ago', paid_on: '2026-08-15' }],
        transactions: [paidConsumo('p-ago', 95000)],
      }),
      PREVIOUS_MONTH,
    )
    expect(out.ARS.debt).toBe(95000)
  })

  it('does not shrink as the window’s instances get confirmed', async () => {
    const pending = await getCommittedOutlookForMonth(
      makeSupabase({ accounts: [bank], recurrences: [augustRule], recurrence_instances: [instance('pending')] }),
      PREVIOUS_MONTH,
    )
    const confirmed = await getCommittedOutlookForMonth(
      makeSupabase({ accounts: [bank], recurrences: [augustRule], recurrence_instances: [instance('confirmed')] }),
      PREVIOUS_MONTH,
    )
    expect(pending.ARS.recurringExpense).toBe(400000)
    expect(confirmed.ARS.recurringExpense).toBe(pending.ARS.recurringExpense)
  })

  it('still projects rules, because the window has not ended', async () => {
    const out = await getCommittedOutlookForMonth(
      makeSupabase({
        accounts: [bank],
        recurrences: [{ ...augustRule, last_generated_date: '2026-07-05' }],
      }),
      PREVIOUS_MONTH,
    )
    expect(out.ARS.recurringExpense).toBe(400000)
  })
})

describe('getCommittedOutlookForMonth — the reading describes itself', () => {
  it('carries its window, cut and lens so the UI never recomputes them', async () => {
    const db = { accounts: [bank] }
    const live = await getCommittedOutlookForMonth(makeSupabase(db), CURRENT_MONTH)
    expect(live).toMatchObject({
      window: { start: '2026-09-01', end: '2026-09-30' },
      snapshotDate: TODAY,
      lens: 'live',
      windowElapsed: false,
    })

    const previous = await getCommittedOutlookForMonth(makeSupabase(db), PREVIOUS_MONTH)
    expect(previous).toMatchObject({
      window: { start: '2026-08-01', end: '2026-08-31' },
      snapshotDate: '2026-07-31',
      lens: 'snapshot',
      windowElapsed: false,
    })

    const elapsed = await getCommittedOutlookForMonth(makeSupabase(db), ELAPSED_MONTH)
    expect(elapsed).toMatchObject({
      window: { start: '2026-07-01', end: '2026-07-31' },
      snapshotDate: '2026-06-30',
      lens: 'snapshot',
      windowElapsed: true,
    })
  })
})

describe('getCommittedOutlookForMonth — archiving a card is not retroactive', () => {
  const archived: FakeAccount = { id: 'old', name: 'Amex', type: 'credit', is_active: false }
  const db = {
    accounts: [archived, bank],
    card_periods: [
      { id: 'p-old', account_id: 'old', start_date: '2026-05-26', end_date: '2026-06-25', due_date: '2026-07-10' },
    ],
    transactions: [consumo('p-old', 77000)],
  }

  it('counts an archived card’s statement inside a past window', async () => {
    // The card was live through the window being read; putting it away later
    // cannot remove a commitment that existed then — and if it did, the total
    // would move on a day nothing was paid.
    const out = await getCommittedOutlookForMonth(makeSupabase(db), ELAPSED_MONTH)
    expect(out.ARS.debt).toBe(77000)
    expect(out.ARS.cards.map((c) => c.id)).toEqual(['old'])
  })

  it('still lists only active cards under the live lens', async () => {
    // Guard on the pre-existing behaviour: widening `live` would move
    // production numbers and is out of this change's scope.
    const out = await getCommittedOutlookForMonth(
      makeSupabase({
        ...db,
        card_periods: [
          { id: 'p-now', account_id: 'old', start_date: '2026-08-01', end_date: '2026-08-25', due_date: '2026-09-10' },
        ],
        transactions: [consumo('p-now', 77000)],
      }),
      CURRENT_MONTH,
    )
    expect(out.ARS.debt).toBe(0)
  })
})
