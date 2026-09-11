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
  /** Since when the current schedule rules — see `schedule_effective_from`. */
  schedule_effective_from?: string | null
  /** The occurrence the seed movement covers, which is not the anchor (#121). */
  seed_occurrence_date?: string | null
  /** Positions spent before the current schedule started ruling (#121). */
  schedule_positions_before?: number
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
function makeSupabase(db: Db, options: { maxRows?: number } = {}) {
  const rules = db.recurrences ?? []
  const maxRows = options.maxRows ?? 1000

  function builder(table: string) {
    const eq: Record<string, unknown> = {}
    const inFilters: Record<string, unknown[]> = {}
    const gte: Record<string, string> = {}
    const lte: Record<string, string> = {}
    const notNull: string[] = []
    let orGroups: string[][] | null = null
    let orderBy: string[] = []
    let window: { from: number; to: number } | null = null
    let selected: string | undefined

    // `and(due_date.gte.X,due_date.lte.Y)` — the slice of PostgREST's filter
    // grammar these reads use. A row passes the `or` if ANY group passes.
    const matchesTerm = (row: Record<string, unknown>, term: string): boolean => {
      const [column, operator, ...rest] = term.split('.')
      const value = rest.join('.')
      const cell = row[column]
      switch (operator) {
        case 'gte':
          return cell != null && String(cell) >= value
        case 'lte':
          return cell != null && String(cell) <= value
        case 'is':
          return value === 'null' ? cell == null : String(cell) === value
        case 'eq':
          return String(cell) === value
        default:
          throw new Error(`unexpected filter operator: ${operator}`)
      }
    }

    const keep = <T extends Record<string, unknown>>(rows: T[]): T[] => {
      let out = rows
        .filter((r) => Object.entries(eq).every(([c, v]) => r[c] === v))
        .filter((r) => Object.entries(inFilters).every(([c, v]) => v.includes(r[c])))
        .filter((r) => Object.entries(gte).every(([c, v]) => String(r[c]) >= v))
        .filter((r) => Object.entries(lte).every(([c, v]) => String(r[c]) <= v))
        .filter((r) => notNull.every((c) => r[c] != null))

      if (orGroups != null) {
        const groups = orGroups
        out = out.filter((r) => groups.some((terms) => terms.every((t) => matchesTerm(r, t))))
      }
      if (orderBy.length > 0) {
        out = [...out].sort((a, b) => {
          for (const column of orderBy) {
            const left = String(a[column] ?? '')
            const right = String(b[column] ?? '')
            if (left !== right) return left < right ? -1 : 1
          }
          return 0
        })
      }
      // PostgREST caps every response at `db-max-rows`, window or no window.
      const capped = Math.min(window == null ? maxRows : window.to - window.from + 1, maxRows)
      const offset = window?.from ?? 0
      return out.slice(offset, offset + capped)
    }

    // PostgREST answers with the columns the query ASKED FOR, and nothing else.
    // A fake that hands back every column it knows proves the mapper and never
    // the read: drop a column from a `.select()` in `src/queries.ts` and the
    // suite stays green while production gets `undefined`. So the column list
    // is honoured here, and an unknown column fails the way PostgREST does.
    const project = (rows: Record<string, unknown>[]) => {
      if (selected == null || selected.includes('*')) return rows
      const terms: string[] = []
      let depth = 0
      let current = ''
      for (const char of selected) {
        if (char === '(') depth += 1
        if (char === ')') depth -= 1
        if (char === ',' && depth === 0) {
          terms.push(current)
          current = ''
          continue
        }
        current += char
      }
      terms.push(current)

      const fields = terms
        .map((term) => term.trim())
        .filter(Boolean)
        .map((term) => {
          // `alias:table(cols)` and `table(cols)` are embeds: the fake already
          // builds the nested object, so only its key matters here.
          const embed = term.indexOf('(')
          const head = embed === -1 ? term : term.slice(0, embed)
          const [left, right] = head.split(':')
          return right == null ? { key: left, column: left } : { key: left, column: right }
        })

      return rows.map((row) => {
        const out: Record<string, unknown> = {}
        for (const { key, column } of fields) {
          const source = column in row ? column : key
          if (!(source in row)) {
            throw new Error(`${table}.${column} was selected but the fixture has no such column`)
          }
          out[key] = row[source]
        }
        return out
      })
    }

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
                created_from_transaction_id: null,
                // What the trigger writes at insert. NOT null: the column is NOT
                // NULL, so "this schedule has always ruled" is spelled as the
                // date the rule began — a fixture defaulting to null would be a
                // row the database cannot hold.
                schedule_effective_from: r.start_date,
                // Nothing spent before a rule's first (and usually only) schedule.
                schedule_positions_before: 0,
                seed_occurrence_date: null,
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
            data: keep(
              (db.recurrence_instances ?? []).map((i, index) => ({
                id: `i-${index}`,
                // The generator writes both: `due_date` is the identity and
                // `scheduled_date` mirrors it until an old client overwrites it
                // on confirm. A fixture that only sets one means the other.
                due_date: i.scheduled_date,
                ...i,
              })),
            ).map((i) => ({
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
      select: (columns?: string) => {
        selected = columns
        return b
      },
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
      or: (filter: string) => {
        // Split on commas that are not inside an `and(...)` group.
        const groups: string[][] = []
        let depth = 0
        let current = ''
        for (const char of filter) {
          if (char === '(') depth += 1
          if (char === ')') depth -= 1
          if (char === ',' && depth === 0) {
            groups.push(current)
            current = ''
            continue
          }
          current += char
        }
        groups.push(current)
        orGroups = groups.map((group) => {
          const inner = group.startsWith('and(') ? group.slice(4, -1) : group
          return inner.split(',').filter(Boolean)
        })
        return b
      },
      order: (c: string) => {
        orderBy = [...orderBy, c]
        return b
      },
      range: (from: number, to: number) => {
        window = { from, to }
        return b
      },
      not: (c: string, operator: string, value: unknown) => {
        if (operator !== 'is' || value !== null) {
          throw new Error(`unexpected not(${operator})`)
        }
        notNull.push(c)
        return b
      },
      then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) => {
        const { data, error } = run()
        const projected = data == null ? data : project(data as Record<string, unknown>[])
        return Promise.resolve({ data: projected, error }).then(resolve, reject)
      },
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

  it('#118: an UNRESOLVED occurrence is not counted twice', async () => {
    // The exact shape of #118, and the reason it survived: generating a pending
    // occurrence never advanced `last_generated_date` — only resolving one did.
    // So the cursor stayed at August while September sat unresolved, the
    // instances read counted it, and the projection walking from August emitted
    // it again. Half a million pesos of rent, twice, for precisely the user who
    // had not caught up.
    //
    // An earlier version of the test above hid this by setting the cursor to the
    // generated date, which the generator never did.
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

  it('places a cuota in the month it fell due, not in the month it was paid', async () => {
    // Window = August (snapshot lens, so a confirmed occurrence counts). The rent
    // fell due 2026-08-10 and was paid on 2026-09-15.
    //
    // Filtering the instance by `scheduled_date` — the PAYMENT date — dropped it
    // out of August, while its `due_date` still covered August's occurrence and
    // blocked the projection. August showed $0: the rent vanished from the month
    // it belonged to, and turned up in September on top of September's own.
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
          start_date: '2026-01-10',
        },
      ],
      recurrence_instances: [
        {
          recurrence_id: 'r-alquiler',
          account_id: 'bank',
          amount: 500_000,
          currency_code: 'ARS',
          description: 'Alquiler',
          due_date: '2026-08-10',
          scheduled_date: '2026-09-15',
          status: 'confirmed',
        },
      ],
    })

    const out = await getCommittedOutlookForMonth(supabase, PREVIOUS_MONTH)

    expect(out.ARS.recurringExpense).toBe(500_000)
    expect(out.ARS.topRecurring).toHaveLength(1)
  })

  it('places a legacy occurrence with no vencimiento by the only date it has', async () => {
    // Resolved before 0064: `due_date` is null and unrecoverable. The fallback is
    // stated rather than implied — `scheduled_date` is the only date there is, so
    // the row is placed by it instead of disappearing from every window.
    //
    // The rule itself ended in July, so this isolates PLACEMENT: the only thing
    // in the window is the historical payment. What such a row must NOT do —
    // cover a calendar date — is the next test.
    const supabase = makeSupabase({
      accounts: [bank],
      recurrences: [
        {
          id: 'r-legacy',
          movement_type: 'expense',
          account_id: 'bank',
          amount: 300_000,
          currency_code: 'ARS',
          description: 'Expensas',
          start_date: '2026-01-10',
          end_date: '2026-07-31',
        },
      ],
      recurrence_instances: [
        {
          recurrence_id: 'r-legacy',
          account_id: 'bank',
          amount: 300_000,
          currency_code: 'ARS',
          description: 'Expensas',
          due_date: null,
          scheduled_date: '2026-08-10',
          status: 'confirmed',
        },
      ],
    })

    const out = await getCommittedOutlookForMonth(supabase, PREVIOUS_MONTH)

    expect(out.ARS.recurringExpense).toBe(300_000)
  })

  it('reads every occurrence when the server truncates the response', async () => {
    // Window = August, and every occurrence is ALREADY DUE — the generator never
    // materializes a future date, so a fixture of future rows would be testing a
    // state the system cannot reach. Six rules of five days each get past a
    // server capped at 5 rows.
    //
    // They are `skipped`: money the user said is NOT owed, and each covers its
    // own date. Read unpaged, the ones past the cut stop covering theirs, so the
    // projection re-emits them and commitment appears out of nothing — #118
    // coming back through the read layer.
    const ruleIds = ['d1', 'd2', 'd3', 'd4', 'd5', 'd6']
    const skippedDaily = ruleIds.flatMap((ruleId, r) =>
      Array.from({ length: 5 }, (_, i) => ({
        recurrence_id: ruleId,
        account_id: 'bank',
        amount: 1_000,
        currency_code: 'ARS',
        description: 'Diario',
        scheduled_date: `2026-08-${String(r * 5 + i + 1).padStart(2, '0')}`,
        status: 'skipped' as const,
      })),
    )
    const supabase = makeSupabase(
      {
        accounts: [bank],
        recurrences: ruleIds.map((id, r) => ({
          id,
          movement_type: 'expense' as const,
          account_id: 'bank',
          amount: 1_000,
          currency_code: 'ARS',
          description: 'Diario',
          start_date: `2026-08-${String(r * 5 + 1).padStart(2, '0')}`,
          end_date: `2026-08-${String(r * 5 + 5).padStart(2, '0')}`,
          interval_count: 1,
          interval_unit: 'day',
        })),
        recurrence_instances: skippedDaily,
      },
      { maxRows: 5 },
    )

    const out = await getCommittedOutlookForMonth(supabase, PREVIOUS_MONTH)

    expect(out.ARS.recurringExpense).toBe(0)
  })

  it('a historical occurrence with an unknown vencimiento does not block a real one', async () => {
    // Window = August. A payment registered on 2026-08-10 for an occurrence whose
    // vencimiento was overwritten before 0064 — `due_date` is null and
    // unrecoverable — and the rule's REAL occurrence also falls on 2026-08-10.
    //
    // Placing the historical row by `scheduled_date` is right; letting that date
    // COVER the calendar is not. An uncertain date occupying a real one is the
    // shape of #96, and 0064 refuses to do it at the database level for exactly
    // this reason. Both belong in the window: the payment that happened, and the
    // occurrence that is still owed.
    const supabase = makeSupabase({
      accounts: [bank],
      recurrences: [
        {
          id: 'r-expensas',
          movement_type: 'expense',
          account_id: 'bank',
          amount: 300_000,
          currency_code: 'ARS',
          description: 'Expensas',
          start_date: '2026-08-10',
          end_date: '2026-08-31',
        },
      ],
      recurrence_instances: [
        {
          recurrence_id: 'r-expensas',
          account_id: 'bank',
          amount: 300_000,
          currency_code: 'ARS',
          description: 'Expensas',
          due_date: null,
          scheduled_date: '2026-08-10',
          status: 'confirmed',
        },
      ],
    })

    const out = await getCommittedOutlookForMonth(supabase, PREVIOUS_MONTH)

    // The historical payment (300.000) plus the occurrence the rule still owes
    // for 2026-08-10, which the unknown row must not have swallowed.
    expect(out.ARS.recurringExpense).toBe(600_000)
  })

  it('does not re-commit an occurrence the user said did not apply', async () => {
    // `skipped` means "this period does not correspond". It never counts as a
    // commitment — and it must not come back as a projected one either, which is
    // what happens the moment the projection stops looking at what exists.
    const supabase = makeSupabase({
      accounts: [bank],
      recurrences: [
        {
          id: 'r-gimnasio',
          movement_type: 'expense',
          account_id: 'bank',
          amount: 80_000,
          currency_code: 'ARS',
          description: 'Gimnasio',
          start_date: '2026-01-05',
        },
      ],
      recurrence_instances: [
        {
          recurrence_id: 'r-gimnasio',
          account_id: 'bank',
          amount: 80_000,
          currency_code: 'ARS',
          description: 'Gimnasio',
          scheduled_date: '2026-09-05',
          status: 'skipped',
        },
      ],
    })

    const out = await getCommittedOutlookForMonth(supabase, CURRENT_MONTH)

    expect(out.ARS.recurringExpense).toBe(0)
    expect(out.ARS.topRecurring).toHaveLength(0)
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

  it('counts an income occurrence that is already materialized and still pending', async () => {
    // Once the projection subtracts what already exists, a materialized income
    // has to be summed from the instances — otherwise "Ya entra" simply loses
    // it. The salary is there either way; which of the two sources reports it
    // must not change the number.
    const supabase = makeSupabase({
      accounts: [bank],
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
      recurrence_instances: [
        {
          recurrence_id: 'r-sueldo',
          account_id: 'bank',
          amount: 2_000_000,
          currency_code: 'ARS',
          description: 'Sueldo',
          scheduled_date: '2026-08-01',
          status: 'pending',
        },
      ],
    })

    // Window = August, and 2026-08-01 is already past: the generator only
    // materializes dates that have arrived, so a pending occurrence in the
    // future is a state the system cannot produce.
    const out = await getCommittedOutlookForMonth(supabase, PREVIOUS_MONTH)

    // Once — not twice, and not zero.
    expect(out.ARS.recurringIncome).toBe(2_000_000)
  })

  it('does not count a confirmed or skipped income as still coming', async () => {
    // A confirmed income is money already in the account; a skipped one is not
    // expected at all. Neither belongs in "Ya entra".
    const supabase = makeSupabase({
      accounts: [bank],
      recurrences: [
        {
          id: 'r-sueldo',
          movement_type: 'income',
          account_id: 'bank',
          amount: 2_000_000,
          currency_code: 'ARS',
          description: 'Sueldo',
          start_date: '2026-08-01',
          end_date: '2026-08-31',
        },
      ],
      recurrence_instances: [
        {
          recurrence_id: 'r-sueldo',
          account_id: 'bank',
          amount: 2_000_000,
          currency_code: 'ARS',
          description: 'Sueldo',
          scheduled_date: '2026-08-01',
          status: 'confirmed',
        },
      ],
    })

    const out = await getCommittedOutlookForMonth(supabase, PREVIOUS_MONTH)

    expect(out.ARS.recurringIncome).toBe(0)
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

// ═══════════════════════════════════════════════════════════════════════════
// A rule whose schedule does not rule yet — the gap a corrected reference date
// opens between the old calendar stopping and the new one starting (#121).
//
// The projection walks the rule's own columns, so it cannot see the schedule
// versions the generator reads. Without the floor it announces a commitment for
// a date the generator is never going to create, and the card shows money that
// will not move.
// ═══════════════════════════════════════════════════════════════════════════

describe('getCommittedOutlookForMonth — a schedule that has not started ruling', () => {
  const insideTheGap: FakeRule = {
    id: 'r-alquiler',
    movement_type: 'expense',
    account_id: 'bank',
    amount: 500_000,
    currency_code: 'ARS',
    description: 'Alquiler',
    start_date: '2026-01-10',
    // The window is September; the corrected schedule only starts ruling in
    // October, so the occurrence of 10/09 falls inside the gap.
    schedule_effective_from: '2026-10-10',
  }

  it('does not project an occurrence the generator will never create', async () => {
    const supabase = makeSupabase({ accounts: [bank], recurrences: [insideTheGap] })

    const out = await getCommittedOutlookForMonth(supabase, CURRENT_MONTH)
    expect(out.ARS.recurringExpense).toBe(0)
  })

  it('projects it again once the schedule rules', async () => {
    const supabase = makeSupabase({
      accounts: [bank],
      recurrences: [{ ...insideTheGap, schedule_effective_from: '2026-09-10' }],
    })

    const out = await getCommittedOutlookForMonth(supabase, CURRENT_MONTH)
    expect(out.ARS.recurringExpense).toBe(500_000)
  })
})
