import { beforeAll, describe, expect, it } from 'vitest'
import type { PGlite } from '@electric-sql/pglite'
import {
  balanceSumsFromRows,
  calculateTransactionSums,
  type AccountBalanceSumRow,
  type BalanceCurrency,
  type DatedBalanceTransactionRow,
} from '@grana/money-logic'
import { createBalanceDb, lit } from './support/balance-sums-db'

/**
 * Parity harness for migrations 0051 + 0052 (`get_account_balance_sums`).
 *
 * Design D3 of the change `fix-balance-read-path-defects`: moving the balance
 * aggregation to SQL creates a SECOND implementation of the per-type sign rules,
 * and two implementations drift in silence. `calculateTransactionSums` stays the
 * source of truth; this test feeds the SAME movement set to both and demands an
 * identical net per account and currency. If either side changes its rules
 * without the other, this fails.
 *
 * The repo is online-only (AGENTS.md: no local Supabase), so the SQL runs on
 * PGlite — a real Postgres in WASM — over a MINIMAL schema: just the columns the
 * function reads (see `support/balance-sums-db`). The function body is loaded
 * verbatim from the migration files, so what is exercised is the shipped SQL.
 *
 * 0052 adds the TEMPORAL CUT: rows with `date > p_today` (default: today in the
 * AR financial timezone) never reach a balance. The fixture plants future-dated
 * rows of several types; the expected nets below must NOT move because of them.
 */

// ── Fixture: every type and every state that gates a balance ─────────────────

const UID = '00000000-0000-0000-0000-0000000000a1'
const OTHER_UID = '00000000-0000-0000-0000-0000000000a2'

const CASH = '00000000-0000-0000-0000-00000000c001'
const BANK = '00000000-0000-0000-0000-0000000b0001'
const ARCHIVED = '00000000-0000-0000-0000-00000000a001'
const CARD = '00000000-0000-0000-0000-0000000cd001'
const OTHER_CASH = '00000000-0000-0000-0000-00000000c002'

const OWNED = [CASH, BANK]

// The pinned "today" for the parity runs (deterministic) and a far-future date
// so the default-p_today test stays stable regardless of when the suite runs.
const TODAY = '2026-07-31'
const FUTURE = '2099-01-01'

type FixtureRow = DatedBalanceTransactionRow & {
  user_id: string
  status: string | null
  is_parent?: boolean
}

const row = (over: Partial<FixtureRow> & Pick<FixtureRow, 'type' | 'amount'>): FixtureRow => ({
  user_id: UID,
  account_id: CASH,
  transfer_destination_account_id: null,
  currency_code: 'ARS',
  date: TODAY,
  status: null,
  ...over,
})

const FIXTURE: FixtureRow[] = [
  // ── income / expense, both currencies
  row({ type: 'income', amount: 850_000 }),
  row({ type: 'expense', amount: 254_461.25 }),
  row({ type: 'income', amount: 500, currency_code: 'USD', account_id: BANK }),
  row({ type: 'expense', amount: 120.55, currency_code: 'USD', account_id: BANK }),

  // ── adjustment: stored signed
  row({ type: 'adjustment', amount: -3_000 }),
  row({ type: 'adjustment', amount: 1_000, account_id: BANK }),

  // ── transfer: two owned legs (nets to zero), one owned leg each way
  row({ type: 'transfer', amount: 60_000, account_id: CASH, transfer_destination_account_id: BANK }),
  row({
    type: 'transfer',
    amount: 100_000,
    account_id: CASH,
    transfer_destination_account_id: ARCHIVED,
  }),
  row({
    type: 'transfer',
    amount: 25_000,
    account_id: ARCHIVED,
    transfer_destination_account_id: BANK,
  }),

  // ── exchange: cross-currency, across accounts and within one account
  row({
    type: 'exchange',
    amount: 120_000,
    account_id: CASH,
    transfer_destination_account_id: BANK,
    destination_amount: 100,
    destination_currency: 'USD',
  }),
  row({
    type: 'exchange',
    amount: 60_000,
    account_id: BANK,
    transfer_destination_account_id: BANK,
    destination_amount: 48.5,
    destination_currency: 'USD',
  }),

  // ── reimbursement, all four states (only the first one credits a balance)
  row({
    type: 'reimbursement',
    amount: 50_000,
    reimbursement_target: 'account',
    received_at: '2026-05-10T00:00:00Z',
  }),
  row({ type: 'reimbursement', amount: 99_999, reimbursement_target: 'account', received_at: null }),
  row({
    type: 'reimbursement',
    amount: 77_777,
    reimbursement_target: 'account',
    received_at: '2026-05-10T00:00:00Z',
    cancelled_at: '2026-05-11T00:00:00Z',
  }),
  row({
    type: 'reimbursement',
    amount: 33_333,
    reimbursement_target: 'statement',
    received_at: '2026-05-10T00:00:00Z',
  }),

  // ── settlement in / out
  row({ type: 'settlement', amount: 40_000, account_id: BANK, settlement_direction: 'in' }),
  row({ type: 'settlement', amount: 10_000, settlement_direction: 'out' }),

  // ── off-ledger: card children (status not null) and the installment parent
  row({ type: 'expense', amount: 419_840, account_id: CARD, status: 'pending' }),
  row({ type: 'expense', amount: 12_000, account_id: CARD, status: 'paid' }),
  row({ type: 'expense', amount: 999_999, account_id: null, status: null, is_parent: true }),
  // A hypothetical status-carrying row on an OWNED account: the `status IS NULL`
  // filter must drop it on both sides, or the balance double-counts card spend.
  row({ type: 'expense', amount: 55_555, account_id: CASH, status: 'pending' }),

  // ── another user's movement: RLS must keep it out (see the RLS test below)
  row({ type: 'income', amount: 7_000_000, account_id: OTHER_CASH, user_id: OTHER_UID }),

  // ── FUTURE-dated rows (temporal cut, 0052): none of these may reach a net.
  // Every leg shape is represented; the expected-nets test proves they are out.
  row({ type: 'expense', amount: 500_000, date: FUTURE }),
  row({ type: 'income', amount: 900_000, account_id: BANK, date: FUTURE }),
  row({
    type: 'transfer',
    amount: 70_000,
    account_id: CASH,
    transfer_destination_account_id: BANK,
    date: FUTURE,
  }),
  row({
    type: 'exchange',
    amount: 80_000,
    account_id: CASH,
    transfer_destination_account_id: BANK,
    destination_amount: 65,
    destination_currency: 'USD',
    date: FUTURE,
  }),
  row({ type: 'settlement', amount: 30_000, account_id: BANK, settlement_direction: 'in', date: FUTURE }),
  row({
    type: 'reimbursement',
    amount: 44_444,
    reimbursement_target: 'account',
    received_at: '2026-05-10T00:00:00Z',
    date: FUTURE,
  }),
]

/** What the client-side aggregation would have received: on-ledger rows only. */
const ON_LEDGER = FIXTURE.filter((r) => r.status === null && r.user_id === UID)

function insertSql(): string {
  const accounts = [
    `('${CASH}', '${UID}', 'cash', true)`,
    `('${BANK}', '${UID}', 'bank', true)`,
    `('${ARCHIVED}', '${UID}', 'bank', false)`,
    `('${CARD}', '${UID}', 'credit', true)`,
    `('${OTHER_CASH}', '${OTHER_UID}', 'cash', true)`,
  ].join(', ')

  const txs = FIXTURE.map(
    (r) =>
      `(${lit(r.user_id)}, ${lit(r.account_id)}, ${lit(r.transfer_destination_account_id)}, ` +
      `${lit(r.currency_code)}, ${r.amount}, ${lit(r.type)}::transaction_type, ${lit(r.date)}, ` +
      `${r.destination_amount == null ? 'null' : r.destination_amount}, ${lit(r.destination_currency)}, ` +
      `${lit(r.reimbursement_target)}, ${lit(r.received_at)}, ${lit(r.cancelled_at)}, ` +
      `${lit(r.settlement_direction)}, ${lit(r.status)}, ${r.is_parent ? 'true' : 'false'})`,
  ).join(',\n')

  return `
    insert into public.accounts (id, user_id, type, is_active) values ${accounts};
    insert into public.transactions (
      user_id, account_id, transfer_destination_account_id, currency_code, amount, type, date,
      destination_amount, destination_currency, reimbursement_target, received_at,
      cancelled_at, settlement_direction, status, is_parent
    ) values
    ${txs};
  `
}

// ── Comparison helpers ───────────────────────────────────────────────────────

const netsOver = (
  ids: string[],
  sums: Map<string, Record<BalanceCurrency, number>>,
): Record<string, Record<BalanceCurrency, number>> =>
  Object.fromEntries(ids.map((id) => [id, sums.get(id) ?? { ARS: 0, USD: 0 }]))

describe('migrations 0051+0052 — get_account_balance_sums parity with calculateTransactionSums', () => {
  let db: PGlite

  beforeAll(async () => {
    db = await createBalanceDb()
    await db.exec(insertSql())
  }, 60_000)

  const rpc = async (
    accountIds: string[] | null,
    today: string | null = TODAY,
  ): Promise<AccountBalanceSumRow[]> => {
    const arg = accountIds === null ? 'null' : `array[${accountIds.map((i) => `'${i}'`).join(',')}]::uuid[]`
    const todayArg = today === null ? 'null' : `date '${today}'`
    const result = await db.query<AccountBalanceSumRow>(
      `select account_id, currency_code, net from public.get_account_balance_sums(${arg}, ${todayArg})`,
    )
    return result.rows
  }

  it('resolves the owned universe from the normative definition (active cash/bank)', async () => {
    const result = await db.query<{ id: string }>(
      'select public.get_owned_account_ids() as id',
    )
    // No RLS in this block, so the predicate is what filters: the archived bank
    // and the credit card are out; the other user's cash account is still in
    // (RLS is what scopes by user — see the RLS describe below).
    expect(result.rows.map((r) => r.id).sort()).toEqual([CASH, BANK, OTHER_CASH].sort())
  })

  it('matches the TS aggregation over the owned accounts (p_account_ids = null)', async () => {
    const sql = balanceSumsFromRows(await rpc(null))
    const ts = calculateTransactionSums(ON_LEDGER as DatedBalanceTransactionRow[], OWNED, TODAY)

    expect(netsOver(OWNED, sql)).toEqual(netsOver(OWNED, ts))
  })

  it('matches the TS aggregation for an explicit set that includes an archived account', async () => {
    const scope = [...OWNED, ARCHIVED]
    const sql = balanceSumsFromRows(await rpc(scope))
    const ts = calculateTransactionSums(ON_LEDGER as DatedBalanceTransactionRow[], scope, TODAY)

    expect(netsOver(scope, sql)).toEqual(netsOver(scope, ts))
  })

  it('matches the TS aggregation for a single account (the detail view)', async () => {
    const sql = balanceSumsFromRows(await rpc([CASH]))
    const ts = calculateTransactionSums(ON_LEDGER as DatedBalanceTransactionRow[], [CASH], TODAY)

    expect(netsOver([CASH], sql)).toEqual(netsOver([CASH], ts))
  })

  // The numbers themselves, spelled out — so a change in BOTH implementations
  // (which parity alone would not catch) still has to face an explicit expectation.
  // The FUTURE-dated fixture rows exist and would move every one of these nets
  // if the temporal cut leaked — the unchanged numbers ARE the exclusion proof.
  it('produces the expected nets for the fixture', async () => {
    const sums = balanceSumsFromRows(await rpc(null))

    // CASH ARS: +850_000 −254_461.25 −3_000 −60_000 (transfer out, owned dest)
    //           −100_000 (transfer out, archived dest) −120_000 (exchange source)
    //           +50_000 (received reimbursement) −10_000 (settlement out)
    expect(sums.get(CASH)?.ARS).toBeCloseTo(352_538.75, 6)
    expect(sums.get(CASH)?.USD).toBeCloseTo(0, 6)

    // BANK ARS: +1_000 (adjustment) +60_000 (transfer in) +25_000 (transfer in
    //           from archived) −60_000 (exchange source) +40_000 (settlement in)
    expect(sums.get(BANK)?.ARS).toBeCloseTo(66_000, 6)
    // BANK USD: +500 −120.55 +100 (exchange dest) +48.5 (exchange dest, same account)
    expect(sums.get(BANK)?.USD).toBeCloseTo(527.95, 6)
  })

  it('excludes off-ledger rows (card children and the installment parent)', async () => {
    const sums = balanceSumsFromRows(await rpc([CASH, CARD]))

    // The card account never appears: its rows carry a status.
    expect(sums.get(CARD)).toBeUndefined()
    // And the status-carrying expense on the owned account did not lower it.
    expect(sums.get(CASH)?.ARS).toBeCloseTo(352_538.75, 6)
  })

  // ── Temporal cut (0052) ────────────────────────────────────────────────────

  it('the cut is what excludes the future rows: a later p_today lets them in, in both implementations', async () => {
    const sql = balanceSumsFromRows(await rpc(null, '2099-12-31'))
    const ts = calculateTransactionSums(
      ON_LEDGER as DatedBalanceTransactionRow[],
      OWNED,
      '2099-12-31',
    )

    expect(netsOver(OWNED, sql)).toEqual(netsOver(OWNED, ts))
    // The future expense (−500_000), transfer out (−70_000), exchange source
    // (−80_000) and received reimbursement (+44_444) now hit CASH.
    expect(sql.get(CASH)?.ARS).toBeCloseTo(352_538.75 - 500_000 - 70_000 - 80_000 + 44_444, 6)
  })

  it('defaults p_today to the AR financial date when omitted (future rows stay out)', async () => {
    // Single-arg call — the shape every pre-0052 caller used. The 2099 fixture
    // rows must stay out of the nets no matter when this suite runs.
    const result = await db.query<AccountBalanceSumRow>(
      `select account_id, currency_code, net
         from public.get_account_balance_sums(array['${CASH}']::uuid[])`,
    )
    const sums = balanceSumsFromRows(result.rows)
    expect(sums.get(CASH)?.ARS).toBeCloseTo(352_538.75, 6)
  })
})

// ── 4.5 — RLS: the function does not elevate privileges ──────────────────────

describe('migration 0051 — RLS is enforced inside the function', () => {
  let db: PGlite

  beforeAll(async () => {
    db = await createBalanceDb()
    await db.exec(insertSql())

    // Owner-only policies keyed on a session GUC, standing in for `auth.uid()`.
    await db.exec(`
      alter table public.accounts enable row level security;
      alter table public.transactions enable row level security;
      create policy own_accounts on public.accounts
        for select using (user_id = current_setting('app.uid', true)::uuid);
      create policy own_transactions on public.transactions
        for select using (user_id = current_setting('app.uid', true)::uuid);

      create role tester nologin;
      grant usage on schema public to tester;
      grant select on public.accounts, public.transactions to tester;
      grant execute on function public.get_owned_account_ids() to tester;
      grant execute on function public.get_account_balance_sums(uuid[], date) to tester;
    `)
  }, 60_000)

  it('returns only the caller-visible accounts, never another user rows', async () => {
    // `tester` is not the function owner, so SECURITY INVOKER means RLS applies.
    await db.exec(`set role tester; set app.uid = '${UID}';`)

    const owned = await db.query<{ id: string }>('select public.get_owned_account_ids() as id')
    expect(owned.rows.map((r) => r.id).sort()).toEqual([...OWNED].sort())

    const sums = await db.query<AccountBalanceSumRow>(
      'select account_id, currency_code, net from public.get_account_balance_sums(null)',
    )
    expect(sums.rows.map((r) => r.account_id)).not.toContain(OTHER_CASH)
  })

  it('ignores an explicit p_account_ids pointing at another user account', async () => {
    await db.exec(`set role tester; set app.uid = '${UID}';`)

    const sums = await db.query<AccountBalanceSumRow>(
      `select account_id, currency_code, net
         from public.get_account_balance_sums(array['${OTHER_CASH}']::uuid[])`,
    )
    expect(sums.rows).toHaveLength(0)
  })

  it('gives the other user their own rows and nothing of the first one', async () => {
    await db.exec(`set role tester; set app.uid = '${OTHER_UID}';`)

    const owned = await db.query<{ id: string }>('select public.get_owned_account_ids() as id')
    expect(owned.rows.map((r) => r.id)).toEqual([OTHER_CASH])

    const sums = await db.query<AccountBalanceSumRow>(
      'select account_id, currency_code, net from public.get_account_balance_sums(null)',
    )
    expect(sums.rows.map((r) => r.account_id)).toEqual([OTHER_CASH])
  })
})
