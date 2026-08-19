import { describe, expect, it } from 'vitest'
import { getCurrentAccount, getHouseholdDebt, getSharedAccruedMovements } from '../src/queries'
import type { GranaSupabaseClient } from '@grana/supabase'

// ═══════════════════════════════════════════════════════════════════════════
// Regression coverage for the shared-debt read path (change
// `fix-shared-debt-read-completeness`).
//
// Every read feeding the household debt used to be an uncapped `.select()`:
// no `.range()`, no `.limit()`, no `.order()`. PostgREST's server-side
// `max-rows` truncates those in SILENCE — `error === null`, fewer rows than
// match, no signal — so the debt came out plausible and wrong, and without an
// ORDER BY it was non-deterministic WHICH rows went missing.
//
// The fake below models the DATABASE, not the query shape: it holds rows and
// applies whatever predicates the query asks for, so these tests pin the
// BEHAVIOUR and survive a refactor of how the reads are written. Its one
// deliberate feature is `maxRows`: a per-page ceiling that reproduces the
// server cap the production code must not depend on.
// ═══════════════════════════════════════════════════════════════════════════

const A = 'user-a'
const B = 'user-b'
const HH = 'hh-1'

type Row = Record<string, unknown>

type Db = {
  household: Row[]
  household_member: Row[]
  transactions: Row[]
  shared_expense_split: Row[]
  settlement: Row[]
  profiles: { id: string; full_name: string }[]
}

/** Per-table count of round-trips, so the tests can assert the walk actually pages. */
type Trips = Record<string, number>

function makeSupabase(
  db: Db,
  opts: { maxRows?: number; failTableOnPage?: { table: string; page: number } } = {},
) {
  const maxRows = opts.maxRows ?? Number.POSITIVE_INFINITY
  const trips: Trips = {}

  function builder(table: string) {
    const eq: Row = {}
    const inF: Record<string, unknown[]> = {}
    const gte: Row = {}
    const lt: Row = {}
    const isNull: string[] = []
    const notNull: string[] = []
    const orderBy: string[] = []
    let rangeFrom = 0
    let rangeTo = Number.POSITIVE_INFINITY
    let single = false

    const run = () => {
      const page = (trips[table] = (trips[table] ?? 0) + 1)
      if (opts.failTableOnPage && opts.failTableOnPage.table === table && opts.failTableOnPage.page === page) {
        // Exactly how PostgREST reports a failure: no rows, an error object.
        return { data: null, error: { message: 'simulated failure' } }
      }

      let rows = (db[table as keyof Db] as Row[]) ?? []
      rows = rows.filter((r) =>
        Object.entries(eq).every(([k, v]) => r[k] === v) &&
        Object.entries(inF).every(([k, vs]) => vs.includes(r[k])) &&
        Object.entries(gte).every(([k, v]) => (r[k] as string) >= (v as string)) &&
        Object.entries(lt).every(([k, v]) => (r[k] as string) < (v as string)) &&
        isNull.every((k) => r[k] == null) &&
        notNull.every((k) => r[k] != null),
      )

      // Deterministic order — the property that makes `.range()` paging stable.
      // Applied only when the query asked for it, so a read that forgot to
      // `.order()` gets the insertion order and its paging is provably fragile.
      if (orderBy.length) {
        rows = [...rows].sort((x, y) => {
          for (const col of orderBy) {
            const a = String(x[col] ?? '')
            const b = String(y[col] ?? '')
            if (a !== b) return a < b ? -1 : 1
          }
          return 0
        })
      }

      if (single) return { data: rows[0] ?? null, error: null }

      // The server cap: it hands back at most `maxRows` per request and says
      // NOTHING about the rows it withheld.
      const windowed = rows.slice(
        rangeFrom,
        rangeTo === Number.POSITIVE_INFINITY ? undefined : rangeTo + 1,
      )
      return { data: windowed.slice(0, maxRows), error: null }
    }

    const b: Record<string, unknown> = {
      select: () => b,
      eq: (k: string, v: unknown) => ((eq[k] = v), b),
      in: (k: string, v: unknown[]) => ((inF[k] = v), b),
      gte: (k: string, v: unknown) => ((gte[k] = v), b),
      lt: (k: string, v: unknown) => ((lt[k] = v), b),
      is: (k: string, _v: unknown) => (isNull.push(k), b),
      not: (k: string, _op: string, _v: unknown) => (notNull.push(k), b),
      order: (k: string) => (orderBy.push(k), b),
      range: (from: number, to: number) => ((rangeFrom = from), (rangeTo = to), b),
      maybeSingle: () => ((single = true), Promise.resolve(run())),
      then: (resolve: (v: unknown) => unknown) => Promise.resolve(run()).then(resolve),
    }
    return b
  }

  const client = {
    from: (table: string) => builder(table),
    auth: { getClaims: async () => ({ data: { claims: { sub: A } } }) },
    rpc: async (name: string) => {
      if (name === 'get_household_member_profiles') return { data: db.profiles, error: null }
      throw new Error(`unexpected rpc: ${name}`)
    },
  }
  return { supabase: client as unknown as GranaSupabaseClient, trips }
}

// ── Dataset builders ─────────────────────────────────────────────────────────
// Dates live in 2020 so every movement's impact month is safely in the past:
// the period gate (`countsByPeriod`) then counts them regardless of when the
// suite runs, which keeps these tests independent of the real clock.

const baseDb = (): Db => ({
  household: [{ id: HH, name: 'Casa', default_split: [], created_by: A, is_active: true }],
  household_member: [
    { household_id: HH, user_id: A },
    { household_id: HH, user_id: B },
  ],
  transactions: [],
  shared_expense_split: [],
  settlement: [],
  profiles: [
    { id: A, full_name: 'Ana Perez' },
    { id: B, full_name: 'Beto Diaz' },
  ],
})

/** A shared expense with a 50/50 split, paid by `payer`. */
function addExpense(
  db: Db,
  o: { id: string; payer: string; amount: number; date: string; currency?: string },
) {
  const half = o.amount / 2
  db.transactions.push({
    id: o.id,
    household_id: HH,
    user_id: o.payer,
    type: 'expense',
    is_shared: true,
    is_parent: false,
    currency_code: o.currency ?? 'ARS',
    date: o.date,
    due_date: null,
    received_at: null,
    cancelled_at: null,
    description: `gasto ${o.id}`,
    linked_transaction_id: null,
    installments_total: 1,
    amount: o.amount,
    category: null,
    subcategory: null,
  })
  db.shared_expense_split.push(
    { transaction_id: o.id, household_id: HH, user_id: A, amount_assigned: half },
    { transaction_id: o.id, household_id: HH, user_id: B, amount_assigned: half },
  )
}

describe('shared debt read path — completeness by construction', () => {
  // ── Baseline: the numbers this change must NOT move ────────────────────────
  it('derives the ledger from a dataset that fits under any ceiling', async () => {
    const db = baseDb()
    addExpense(db, { id: 'tx1', payer: A, amount: 1000, date: '2020-01-10' })
    addExpense(db, { id: 'tx2', payer: B, amount: 400, date: '2020-01-20' })

    const { supabase } = makeSupabase(db)
    const data = await getCurrentAccount(supabase)

    // A fronted B's 500; B fronted A's 200 → B owes A 300.
    expect(data?.byCurrency.ARS.equation.balanceForA).toBe(300)
    expect(data?.byCurrency.ARS.equation.otherSharesYouPaid).toBe(500)
    expect(data?.byCurrency.ARS.equation.yourSharesTheyPaid).toBe(-200)
    expect(data?.byCurrency.ARS.debt).toEqual({ kind: 'owes', from: B, to: A, amount: 300 })
    // Display order is most-recent-first.
    expect(data?.byCurrency.ARS.entries.map((e) => e.id)).toEqual(['tx2', 'tx1'])
  })

  // ── The defect this change exists to close ─────────────────────────────────
  it('gives the same debt when the server caps every page well below the dataset', async () => {
    const build = () => {
      const db = baseDb()
      for (let i = 0; i < 25; i++) {
        addExpense(db, {
          id: `tx${String(i).padStart(2, '0')}`,
          payer: i % 2 === 0 ? A : B,
          amount: 100,
          date: `2020-02-${String((i % 27) + 1).padStart(2, '0')}`,
        })
      }
      return db
    }

    const uncapped = await getCurrentAccount(makeSupabase(build()).supabase)
    const capped = await getCurrentAccount(makeSupabase(build(), { maxRows: 2 }).supabase)

    // 13 expenses paid by A (+50 each) and 12 by B (−50 each) → +50.
    expect(uncapped?.byCurrency.ARS.equation.balanceForA).toBe(50)
    expect(capped?.byCurrency.ARS.equation.balanceForA).toBe(
      uncapped?.byCurrency.ARS.equation.balanceForA,
    )
    expect(capped?.byCurrency.ARS.entries.map((e) => e.id)).toEqual(
      uncapped?.byCurrency.ARS.entries.map((e) => e.id),
    )
  })

  it('walks every page instead of trusting the first one', async () => {
    const db = baseDb()
    for (let i = 0; i < 7; i++) {
      addExpense(db, { id: `tx${i}`, payer: A, amount: 100, date: '2020-03-01' })
    }
    const { supabase, trips } = makeSupabase(db, { maxRows: 2 })
    await getHouseholdDebt(supabase)

    // 14 split rows at 2 per page → 7 full pages + 1 empty page to learn it ended.
    expect(trips.shared_expense_split).toBe(8)
    // And the result is still whole: 7 expenses of 100 paid by A → +350.
    const debt = await getHouseholdDebt(makeSupabase(db, { maxRows: 2 }).supabase)
    expect(debt?.ARS).toEqual({ kind: 'owes', from: B, to: A, amount: 350 })
  })

  it('does not end the walk on an errored page', async () => {
    const db = baseDb()
    for (let i = 0; i < 7; i++) {
      addExpense(db, { id: `tx${i}`, payer: A, amount: 100, date: '2020-03-01' })
    }
    // Page 2 of the split read fails. Silently treating `data: null` as "no more
    // rows" would return a partial set and a confidently wrong debt.
    const { supabase } = makeSupabase(db, {
      maxRows: 2,
      failTableOnPage: { table: 'shared_expense_split', page: 2 },
    })
    await expect(getHouseholdDebt(supabase)).rejects.toBeTruthy()
  })

  it('is stable across identical calls', async () => {
    const db = baseDb()
    for (let i = 0; i < 9; i++) {
      addExpense(db, { id: `tx${i}`, payer: i % 3 === 0 ? B : A, amount: 90, date: '2020-04-05' })
    }
    const first = await getCurrentAccount(makeSupabase(db, { maxRows: 3 }).supabase)
    const second = await getCurrentAccount(makeSupabase(db, { maxRows: 3 }).supabase)

    expect(second?.byCurrency.ARS.equation).toEqual(first?.byCurrency.ARS.equation)
    expect(second?.byCurrency.ARS.entries.map((e) => e.id)).toEqual(
      first?.byCurrency.ARS.entries.map((e) => e.id),
    )
  })

  // ── Guards on the predicate swap (D3) ──────────────────────────────────────
  it('ignores a split whose movement is no longer shared', async () => {
    const db = baseDb()
    addExpense(db, { id: 'tx1', payer: A, amount: 1000, date: '2020-01-10' })
    // A stray/legacy split: the movement was unshared but the row survived.
    addExpense(db, { id: 'tx-stray', payer: A, amount: 800, date: '2020-01-11' })
    const stray = db.transactions.find((t) => t.id === 'tx-stray')!
    stray.is_shared = false

    const { supabase } = makeSupabase(db)
    const data = await getCurrentAccount(supabase)

    expect(data?.byCurrency.ARS.equation.balanceForA).toBe(500)
    expect(data?.byCurrency.ARS.entries.map((e) => e.id)).toEqual(['tx1'])
  })

  it('is unmoved by shared movements that carry no splits of their own', async () => {
    const db = baseDb()
    addExpense(db, { id: 'tx1', payer: A, amount: 1000, date: '2020-01-10' })
    // The installment PARENT: shared, in the household, and split-less. The
    // predicate read brings it in; it must contribute nothing.
    db.transactions.push({
      id: 'tx-parent',
      household_id: HH,
      user_id: A,
      type: 'expense',
      is_shared: true,
      is_parent: true,
      currency_code: 'ARS',
      date: '2020-01-12',
      due_date: null,
      received_at: null,
      cancelled_at: null,
      description: 'compra en cuotas',
      linked_transaction_id: null,
      installments_total: 6,
      amount: 6000,
      category: null,
      subcategory: null,
    })

    const { supabase } = makeSupabase(db)
    const data = await getCurrentAccount(supabase)

    expect(data?.byCurrency.ARS.equation.balanceForA).toBe(500)
    expect(data?.byCurrency.ARS.entries.map((e) => e.id)).toEqual(['tx1'])
  })

  // ── Settlements ────────────────────────────────────────────────────────────
  it('reads settlements once and applies them to both the debt and the ledger', async () => {
    const db = baseDb()
    addExpense(db, { id: 'tx1', payer: A, amount: 1000, date: '2020-01-10' })
    db.settlement.push({
      id: 'st1',
      household_id: HH,
      payer_id: B,
      receiver_id: A,
      amount: 500,
      currency_code: 'ARS',
      status: 'completed',
      created_at: '2020-01-15T10:00:00Z',
      resolved_at: '2020-01-15T12:00:00Z',
    })

    const { supabase, trips } = makeSupabase(db)
    const data = await getCurrentAccount(supabase)

    // B owed 500 and paid it → settled.
    expect(data?.byCurrency.ARS.equation.balanceForA).toBe(0)
    expect(data?.byCurrency.ARS.debt).toEqual({ kind: 'settled' })
    const entry = data?.byCurrency.ARS.entries.find((e) => e.kind === 'settlement')
    expect(entry?.state).toBe('completed')

    // FOUR round-trips, not two: `getCurrentAccount` collects the debt inputs
    // once for the ledger and `getHouseholdOutlook` collects them AGAIN for the
    // projection, so the whole input set is fetched twice per page load. That
    // duplication predates this change and is left as found — deduplicating it
    // is an efficiency concern, an explicit non-goal here. The guarantee this
    // change does make is asserted below: ONE walk per collection.
    expect(trips.settlement).toBe(4)
  })

  it('reads the settlement table once per collection of the debt inputs', async () => {
    const db = baseDb()
    addExpense(db, { id: 'tx1', payer: A, amount: 1000, date: '2020-01-10' })
    db.settlement.push({
      id: 'st1',
      household_id: HH,
      payer_id: B,
      receiver_id: A,
      amount: 500,
      currency_code: 'ARS',
      status: 'completed',
      created_at: '2020-01-15T10:00:00Z',
      resolved_at: '2020-01-15T12:00:00Z',
    })

    // `getHouseholdDebt` collects exactly once, so this isolates the guarantee:
    // one full page plus the empty page that ends the walk. Before this change
    // the ledger path read `settlement` a second time with different columns and
    // no order — two unordered reads that could disagree about what they saw.
    const { supabase, trips } = makeSupabase(db)
    const debt = await getHouseholdDebt(supabase)

    expect(debt?.ARS).toEqual({ kind: 'settled' })
    expect(trips.settlement).toBe(2)
  })
})

describe('shared accrual read path — the month window narrows, it does not truncate', () => {
  it('sums every movement of the month past the page ceiling', async () => {
    const db = baseDb()
    for (let i = 0; i < 12; i++) {
      addExpense(db, {
        id: `e${String(i).padStart(2, '0')}`,
        payer: A,
        amount: 100,
        date: `2020-05-${String((i % 28) + 1).padStart(2, '0')}`,
      })
    }

    const { supabase } = makeSupabase(db, { maxRows: 3 })
    const items = await getSharedAccruedMovements(supabase, '2020-05')

    expect(items).toHaveLength(12)
    expect(items.reduce((acc, i) => acc + i.amount, 0)) .toBe(1200)
    // "Tu parte" comes from its own paginated read — it must be whole too.
    expect(items.reduce((acc, i) => acc + i.ownShare, 0)).toBe(600)
  })

  it('keeps movements of other months out of the window', async () => {
    const db = baseDb()
    addExpense(db, { id: 'in', payer: A, amount: 100, date: '2020-05-10' })
    addExpense(db, { id: 'out', payer: A, amount: 999, date: '2020-06-10' })

    const { supabase } = makeSupabase(db, { maxRows: 1 })
    const items = await getSharedAccruedMovements(supabase, '2020-05')

    expect(items.map((i) => i.id)).toEqual(['in'])
  })
})
