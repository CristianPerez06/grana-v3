import type { SupabaseClient } from '@supabase/supabase-js'
import type { GranaSupabaseClient } from '@grana/supabase'
import { Money } from '@grana/validation'
import { resolveCommittedWindow } from './committed-window'
import {
  balanceSumsFromRows,
  cajaCutOrFilter,
  categoryOwnPortion,
  computeCategoryNet,
  countsAsCategorySpend,
  earlierISO,
  financialTodayISO,
  getTodayAR,
  type AccountBalanceSumRow,
  type CategoryAggRow,
  type CategorySliceInput,
  type SubcategorySliceInput,
} from '@grana/money-logic'
import {
  aggregateCardDebt,
  aggregateCardDebtAsOf,
  aggregateCardDebtByCard,
  aggregateHero,
  buildMonthBalanceSeries,
  projectRecurrenceItems,
  sumByCurrency,
  topCommittedItems,
  type CardDebtRow,
  type CommittedItemRow,
  type CommittedRecurrenceRule,
  type HeroAccountRow,
  type MonthBalanceTxInput,
} from './aggregations'
import {
  aggregateMonthSpending,
  type MonthSpendingByCurrency,
  type MonthSpendingRow,
} from './month-spending'
import type {
  CommittedCurrency,
  CommittedOutlook,
  DashboardHero,
  MonthBalanceByCurrency,
} from './types'

function formatDateISO(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/** A Supabase to-one embed typed (incorrectly) as an array — read `.name` safely. */
type NameEmbed = { name: string | null } | { name: string | null }[] | null
const embedName = (e: NameEmbed): string => {
  const obj = Array.isArray(e) ? e[0] : e
  return obj?.name ?? ''
}

/** First/last accounting date of a `YYYY-MM` month, as ISO `YYYY-MM-DD`. */
export function resolveMonthRange(month: string): { from: string; to: string } {
  const [year, m] = month.split('-').map(Number)
  return {
    from: formatDateISO(new Date(year, m - 1, 1)),
    to: formatDateISO(new Date(year, m, 0)),
  }
}

/**
 * Available balance and its per-account breakdown, AS OF a date.
 *
 * `asOfISO` defaults to the financial today. The dashboard passes the last day
 * of the month being viewed (clamped at today), so navigating months moves the
 * balance with the rest of the card instead of leaving today's number sitting
 * on top of another month's flows.
 */
export async function getDashboardHero(
  supabase: SupabaseClient,
  asOfISO: string = formatDateISO(getTodayAR()),
): Promise<DashboardHero> {
  // Which accounts are "propias" is resolved by the normative SQL definition
  // (`get_owned_account_ids`, migration 0051), not by rebuilding the predicate
  // here. The Hero needs the account METADATA too, so it fetches the rows by id
  // — same two sequential steps as before, the metadata read and the balance
  // aggregate now run in parallel.
  const { data: ownedIds, error: ownedErr } = await supabase.rpc('get_owned_account_ids')
  if (ownedErr) throw ownedErr

  const accountIds = (ownedIds ?? []) as string[]
  if (accountIds.length === 0) return aggregateHero([], new Map(), asOfISO)

  const [{ data: accounts, error }, txSums] = await Promise.all([
    supabase
      .from('accounts')
      .select(
        'id, name, type, color_key, icon_key, institution:institutions(name, brand_color, icon_type), currencies:account_currencies(currency_code, initial_balance, initial_balance_date)',
      )
      .in('id', accountIds),
    getTransactionSums(supabase, accountIds, asOfISO),
  ])

  if (error) throw error

  return aggregateHero((accounts ?? []) as unknown as HeroAccountRow[], txSums, asOfISO)
}

// Net per account and currency, aggregated in Postgres by the
// `get_account_balance_sums` RPC (migration 0051) — the same read
// `@grana/accounts` uses for account balances. It used to be a `.select()` of
// the whole ledger summed in JS: no `.range()`, no `.limit()`, no `.order()`, so
// PostgREST's `max-rows` truncated it in silence past the ceiling and the
// Disponible came out plausible and wrong. The shared piece is the pure row →
// map shaping in `@grana/money-logic`; the round-trip stays per package because
// the dependency graph (`@grana/accounts → … → @grana/dashboard`) forbids
// dashboard importing accounts.
async function getTransactionSums(
  supabase: SupabaseClient,
  accountIds: string[],
  asOfISO: string,
): Promise<Map<string, { ARS: number; USD: number }>> {
  if (accountIds.length === 0) return new Map()

  // `p_today` is the temporal cut (migration 0052). Passing the month's closing
  // date instead of today is what makes the balance historical: the RPC already
  // took the parameter, so no SQL changed for this.
  const { data, error } = await supabase.rpc('get_account_balance_sums', {
    p_account_ids: accountIds,
    p_today: asOfISO,
  })

  if (error) throw error

  return balanceSumsFromRows((data ?? []) as AccountBalanceSumRow[])
}

// ── El disponible real y el flujo reservado ───────────────────────────────────
//
// Both come from the NORMATIVE reads of migration 0057 and neither is recomposed
// here. The Hero could subtract `reserved` from the account total it already
// holds and save a round-trip — and that is exactly the shortcut that must not be
// taken. `get_available_sums` has three consumers (this Hero, the drawer's cap
// and the write path's validation); the day one of them subtracts on its own is
// the day the screen shows two different "disponibles". Migration 0051 shipped
// that lesson the hard way: the "owned account" predicate had been copied into
// every call site until two of them disagreed in production.
//
// Same shape as `getTransactionSums` above, and for the same reason: the wrapper
// only reshapes rows, the arithmetic lives in SQL.

export type CurrencyTotals = { ARS: number; USD: number }

const emptyTotals = (): CurrencyTotals => ({ ARS: 0, USD: 0 })

const foldByCurrency = (
  rows: { currency_code: string }[],
  pick: (row: never) => number | string | null,
): CurrencyTotals => {
  const totals = emptyTotals()
  for (const row of rows) {
    if (row.currency_code !== 'ARS' && row.currency_code !== 'USD') continue
    const value = pick(row as never)
    totals[row.currency_code] = value == null ? 0 : Number(value)
  }
  return totals
}

/**
 * The disponible real per currency — accounts net MINUS what is set aside — plus
 * the reserved stock that produced it.
 *
 * `reserved` travels alongside so the UI can EXPLAIN the subtraction (the row
 * shows the stock when the month had no activity), never so a consumer can redo
 * it: `available` is already the answer.
 */
export async function getAvailableTotals(
  supabase: SupabaseClient,
  asOfISO: string = financialTodayISO(),
): Promise<{ available: CurrencyTotals; reserved: CurrencyTotals }> {
  const { data, error } = await supabase.rpc('get_available_sums', { p_today: asOfISO })
  if (error) throw error

  const rows = (data ?? []) as { currency_code: string; available: number; reserved: number }[]
  return {
    available: foldByCurrency(rows, (r: { available: number }) => r.available),
    reserved: foldByCurrency(rows, (r: { reserved: number }) => r.reserved),
  }
}

/** Rows per round-trip of the month fetch. Independent of the server's
 *  `max-rows`: the loop advances by what came back and stops on an empty page. */
const MONTH_ROWS_PAGE_SIZE = 1000

export async function getMonthBalanceSeries(
  supabase: SupabaseClient,
  year: number,
  month: number,
  todayISO: string = financialTodayISO(),
): Promise<MonthBalanceByCurrency> {
  const firstDay = new Date(year, month - 1, 1)
  const lastDay = new Date(year, month, 0)
  const fromISO = formatDateISO(firstDay)
  const monthEndISO = formatDateISO(lastDay)

  // Temporal cut (same rule as migration 0052, here for the month lens): this
  // series is CAJA — every row it reads is on-ledger (`status is null`) — so the
  // cut is unconditional. A movement dated after today has not moved any money
  // yet: it must not appear in "Balance del mes", which answers what ALREADY
  // happened. Past months are untouched (their end is before today); the current
  // month stops at today; a future month is empty.
  //
  // `todayISO` is a parameter so the boundary is injectable and tests are
  // deterministic; the default is the AR financial date the rest of the UI uses.
  const toISO = earlierISO(monthEndISO, todayISO)

  // The whole month is still ahead: nothing has happened in it. Short-circuit —
  // the query would return rows only to have every one of them discarded.
  if (todayISO < fromISO) {
    return {
      year,
      month,
      ARS: buildMonthBalanceSeries(year, month, [], [], 'ARS', 0),
      USD: buildMonthBalanceSeries(year, month, [], [], 'USD', 0),
    }
  }

  // The last day the series draws: today for the current month, the full month
  // for a past one. Days after it are not rendered at all — an empty future day
  // and a day with no movements are different facts and must not look alike.
  const cutoffDay = toISO === monthEndISO ? lastDay.getDate() : Number(toISO.slice(8, 10))

  // The owned universe comes from its NORMATIVE definition in SQL
  // (`get_owned_account_ids`, migration 0051) instead of rebuilding
  // `type IN ('cash','bank') AND is_active = true` by hand. Rebuilding it here is
  // what had already diverged: this query omitted `is_active` while the Hero
  // applied it, so an archived account's movements moved the month net while its
  // balance stayed out of the Disponible and the reconciliation the `dashboard`
  // spec requires broke.
  const { data: accs, error: accsErr } = await supabase.rpc('get_owned_account_ids')

  if (accsErr) throw accsErr
  const accIds = (accs ?? []) as string[]
  if (accIds.length === 0) {
    return {
      year,
      month,
      ARS: buildMonthBalanceSeries(year, month, [], [], 'ARS', cutoffDay),
      USD: buildMonthBalanceSeries(year, month, [], [], 'USD', cutoffDay),
    }
  }

  // Fetch every cash movement of the month on owned accounts. We do NOT
  // pre-partition by currency_code: an `exchange` row's destination leg lives in
  // `destination_currency` (the other currency), so each currency series must
  // see all rows and pick the leg(s) relevant to it (see buildMonthBalanceSeries).
  // The extra fields + `period_payments(id)` feed the per-type sign rules and the
  // card-payment detection (same embed `getMonthCategoryBreakdown` uses).
  //
  // This one cannot become an aggregate — the section needs the per-day series,
  // so its product is rows. It takes the other form the `web-data-access` spec
  // allows: exhaustive `.range()` over a deterministic order. A month is a small
  // window, but "small" is not a guarantee: `finalBalance` is a money number and
  // it must not depend on the month staying under PostgREST's `max-rows`.
  const raw: Array<
    Omit<MonthBalanceTxInput, 'is_card_payment'> & { period_payments: { id: string }[] | null }
  > = []

  for (let offset = 0; ; ) {
    const { data: txs, error: txsErr } = await supabase
      .from('transactions')
      .select(
        'id, date, type, amount, currency_code, account_id, transfer_destination_account_id, destination_amount, destination_currency, reimbursement_target, received_at, cancelled_at, settlement_direction, created_at, period_payments!period_payments_transaction_id_fkey(id)',
      )
      .gte('date', fromISO)
      .lte('date', toISO)
      .is('status', null)
      .or(
        `account_id.in.(${accIds.join(',')}),transfer_destination_account_id.in.(${accIds.join(',')})`,
      )
      .order('date', { ascending: true })
      .order('created_at', { ascending: true })
      .order('id', { ascending: true })
      .range(offset, offset + MONTH_ROWS_PAGE_SIZE - 1)

    if (txsErr) throw txsErr

    const batch = (txs ?? []) as unknown as typeof raw
    if (batch.length === 0) break

    raw.push(...batch)
    offset += batch.length
  }

  const rows: MonthBalanceTxInput[] = raw.map((t) => ({
    ...t,
    is_card_payment: (t.period_payments?.length ?? 0) > 0,
  }))

  return {
    year,
    month,
    ARS: buildMonthBalanceSeries(year, month, rows, accIds, 'ARS', cutoffDay),
    USD: buildMonthBalanceSeries(year, month, rows, accIds, 'USD', cutoffDay),
  }
}

// ── getMonthCategoryBreakdown ──────────────────────────────────────────────────
// Spending by category for a month: expenses (cash/debit + card consumos + the
// installment cuota that accrues in the month) minus received reimbursements,
// net per category and currency. Excludes installment parents (off-ledger) and
// statement payments (the spend already counted as the consumos). Uncategorized
// spend is bucketed under the `uncategorized` sentinel (the UI labels it).
//
// KNOWN GAP: the two `.select()` below have no `.range()`. They are bounded by
// the month, which is not a guarantee — the balance reads carried the same
// assumption until it became a defect. Their product IS a monetary aggregate, so
// the `web-data-access` requirement ("reads that feed a money number are complete
// by construction") reaches them. Left out of `fix-balance-read-path-defects`
// (2026-07-30) to keep that change scoped to the balance path; fixing them means
// the same exhaustive `.range()` loop `getMonthBalanceSeries` now uses.

export const UNCATEGORIZED_ID = 'uncategorized'

export type MonthCategoryBreakdown = {
  ARS: CategorySliceInput[]
  USD: CategorySliceInput[]
  /**
   * Categories whose month net is a CREDIT (received reimbursements exceed the
   * month's spend → negative net). Their `value` is the credit magnitude
   * (positive). Shown apart from the donut ("te devolvieron"), never as a slice.
   */
  credits: {
    ARS: CategorySliceInput[]
    USD: CategorySliceInput[]
  }
}

export async function getMonthCategoryBreakdown(
  supabase: SupabaseClient,
  month: string,
  todayISO: string = financialTodayISO(),
): Promise<MonthCategoryBreakdown> {
  const { from, to } = resolveMonthRange(month)

  // Temporal cut, CAJA-scoped (`cajaCutOrFilter`): a cash/debit expense dated
  // after today has not been spent yet and must not weigh in the donut, while
  // card rows keep the DEVENGADO lens — a cuota accrues in its month from day 1,
  // whatever day of the month it is dated (spec `spending-by-category`). Cutting
  // those too would empty the donut at the start of every month even though the
  // cuotas are already incurred.
  const cut = cajaCutOrFilter(todayISO)

  const [expensesResult, reimbursementsResult] = await Promise.all([
    supabase
      .from('transactions')
      .select('id, category_id, currency_code, amount, is_parent, is_shared, period_payments!period_payments_transaction_id_fkey(id)')
      .eq('type', 'expense')
      // DEVENGADO (accrual): spending by category counts an expense in the
      // month it is INCURRED, regardless of how/when it is paid — so card
      // consumos and each installment cuota DO count here, by their own date
      // (see spec `spending-by-category`). We intentionally do NOT filter
      // `card_period_id IS NULL` anymore. The off-ledger invariant only governs
      // `disponible`/CAJA (the Hero + Balance del mes), not categorization.
      // Still excluded in the loop below: the installment PARENT (`is_parent`,
      // off-ledger) and the statement PAYMENT (`period_payments` — it cancels
      // debt, it is not new spending; the consumos it covers already counted in
      // their own month).
      .gte('date', from)
      .lte('date', to)
      .or(cut),
    supabase
      .from('transactions')
      .select('id, amount, currency_code, linked_transaction_id, received_at, cancelled_at, is_shared')
      .eq('type', 'reimbursement')
      .not('received_at', 'is', null)
      .is('cancelled_at', null)
      .gte('date', from)
      .lte('date', to)
      .or(cut),
  ])
  if (expensesResult.error) throw expensesResult.error
  if (reimbursementsResult.error) throw reimbursementsResult.error

  const expenseRows = (expensesResult.data ?? []) as unknown as Array<{
    id: string
    category_id: string | null
    currency_code: string
    amount: number
    is_parent: boolean
    is_shared: boolean
    period_payments: { id: string }[] | null
  }>
  const reimbRows = (reimbursementsResult.data ?? []) as unknown as Array<{
    id: string
    amount: number
    currency_code: string
    linked_transaction_id: string | null
    received_at: string | null
    cancelled_at: string | null
    is_shared: boolean
  }>

  // Reimbursements derive their category from the linked expense. PostgREST
  // can't reliably embed a self-referential FK, so stitch with a second query.
  const linkedIds = [
    ...new Set(
      reimbRows.map((r) => r.linked_transaction_id).filter((id): id is string => Boolean(id)),
    ),
  ]
  const linkedCategoryById = new Map<string, string | null>()
  if (linkedIds.length > 0) {
    const { data: linked } = await supabase
      .from('transactions')
      .select('id, category_id')
      .in('id', linkedIds)
    for (const e of linked ?? []) linkedCategoryById.set(e.id, e.category_id)
  }

  // Shared movements count only the USER's portion (household "cuenta
  // corriente"): a shared expense/reimbursement contributes
  // `shared_expense_split.amount_assigned` for her user_id, not its total. The
  // split RLS exposes BOTH members' rows, so we filter by her uid explicitly.
  const sharedIds = [
    ...new Set([
      ...expenseRows.filter((e) => e.is_shared).map((e) => e.id),
      ...reimbRows.filter((r) => r.is_shared).map((r) => r.id),
    ]),
  ]
  const mySplitByTx = new Map<string, number>()
  if (sharedIds.length > 0) {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (user) {
      const { data: splits } = await supabase
        .from('shared_expense_split')
        .select('transaction_id, amount_assigned')
        .eq('user_id', user.id)
        .in('transaction_id', sharedIds)
      for (const s of splits ?? [])
        mySplitByTx.set(s.transaction_id as string, Number(s.amount_assigned))
    }
  }

  // Shared/own attribution and the category-spend inclusion rule are the
  // devengado lens — shared with `getMonthCategoryLines` via `@grana/money-logic`
  // so the donut's weights and the drilled list's rows stay reconciled.
  const aggRows: CategoryAggRow[] = []
  for (const e of expenseRows) {
    if (!countsAsCategorySpend({
      is_parent: e.is_parent,
      hasStatementPayment: (e.period_payments?.length ?? 0) > 0,
    })) continue // installment parent (off-ledger) or statement payment → not spend
    const amount = categoryOwnPortion(e, mySplitByTx)
    if (amount === null) continue // shared with no own split → not ours
    aggRows.push({
      categoryId: e.category_id ?? UNCATEGORIZED_ID,
      kind: 'expense',
      currency_code: e.currency_code,
      amount,
    })
  }
  for (const r of reimbRows) {
    const amount = categoryOwnPortion(r, mySplitByTx)
    if (amount === null) continue // shared reimbursement with no own split → not ours
    const derived = r.linked_transaction_id
      ? linkedCategoryById.get(r.linked_transaction_id)
      : null
    aggRows.push({
      categoryId: derived ?? UNCATEGORIZED_ID,
      kind: 'reimbursement',
      currency_code: r.currency_code,
      amount,
      received_at: r.received_at,
      cancelled_at: r.cancelled_at,
    })
  }

  const netByCategory = computeCategoryNet(aggRows)

  const realIds = [...netByCategory.keys()].filter((id) => id !== UNCATEGORIZED_ID)
  const categoryById = new Map<
    string,
    {
      name: string
      color: string | null
      icon: string | null
      canonical_name: string
      user_id: string | null
    }
  >()
  if (realIds.length > 0) {
    const { data: cats } = await supabase
      .from('categories')
      .select('id, name, color, icon, canonical_name, user_id')
      .in('id', realIds)
    for (const c of cats ?? []) {
      categoryById.set(c.id, {
        name: c.name,
        color: c.color,
        icon: c.icon,
        canonical_name: c.canonical_name,
        user_id: c.user_id,
      })
    }
  }

  // Split each currency's per-category nets into spend (positive → donut) and
  // credits (negative → "te devolvieron", shown apart). A net of exactly zero
  // is dropped (fully reimbursed, nothing to show).
  const build = (
    currency: 'ARS' | 'USD',
  ): { spend: CategorySliceInput[]; credits: CategorySliceInput[] } => {
    const spend: CategorySliceInput[] = []
    const credits: CategorySliceInput[] = []
    for (const [id, perCurrency] of netByCategory.entries()) {
      const value = perCurrency[currency].neto
      if (value === 0) continue
      const display = id === UNCATEGORIZED_ID ? null : categoryById.get(id)
      // Uncategorized label is left empty; the UI fills it (i18n). System
      // categories carry translation handles so consumers relabel via i18n.
      const slice: CategorySliceInput = {
        categoryId: id,
        label: display?.name ?? '',
        color: display?.color ?? null,
        icon: display?.icon ?? null,
        value: Math.abs(value), // credits carry the magnitude, positive
        canonicalName: display?.canonical_name ?? null,
        isSystem: display != null && display.user_id === null,
      }
      if (value > 0) spend.push(slice)
      else credits.push(slice)
    }
    return { spend, credits }
  }

  const ars = build('ARS')
  const usd = build('USD')
  return {
    ARS: ars.spend,
    USD: usd.spend,
    credits: { ARS: ars.credits, USD: usd.credits },
  }
}

// ── getCommittedOutlookForMonth (COMPROMISO lens) ─────────────────────────────
// "Cuánta plata ya se sabe que hay que pagar el mes siguiente al que estoy
// mirando."
//
// The window is the calendar month AFTER the SELECTED one, day 1 to last day —
// not "from today", not "the next 30 days". Standing on the current month it is
// next month, exactly as before; standing on June it is July. That offset is
// what keeps this card and the balance card above it comparable: the balance
// cuts at the selected month's last day and this window opens the next, so in
// every navigator position the two amounts on screen are disjoint and
// contiguous. See `committed-window.ts` for the three positions.
//
// Two dates, two roles. `snapshotDate` says WHEN each commitment's state is
// evaluated; the window says WHAT is counted. `lens` follows the first,
// `windowElapsed` the second, and neither is derived from the other.
//
// Two sources, per currency, never combined across currencies:
//
//  · Tarjetas — statements whose DUE DATE falls in the window. The criterion is
//    the due date, not the close date: a statement that closes 28/09 but is due
//    10/10 is paid in October and is not a September commitment.
//
//    Whether it was still owed is evaluated AT THE SNAPSHOT, by the payment
//    movement's financial date (`period_payments → transactions.date`), never by
//    today's state and never by `period_payments.created_at` (which is when the
//    payment was entered in the app, not when the money left). Paying a closed
//    statement before it comes due is a supported flow, so a statement due in
//    the window can legitimately have been settled before the cut.
//
//    Consumos are NOT cut by date. Installment children are inserted at purchase
//    time dated months ahead, so a May purchase already carries a July-dated row
//    inside July's statement — money the user knew about at the June cut. A cut
//    by `transactions.date` would drop exactly those, and they are the bulk of a
//    statement here. The statement contributes its full content; the snapshot
//    only decides whether it was still owed.
//
//  · Gastos fijos — recurrences falling in the window that are NOT paid by a
//    credit card. One debited from a card does not take money out of the account
//    that month: it lands in that card's statement and is paid when the
//    statement comes due, which is another window. Counting it here AND inside
//    its statement would count it twice.
//
//    Under `live` the set is the still-`pending` instances plus the projection of
//    active rules. Under `snapshot` it is the materialized instances, `confirmed`
//    and `pending` both — at the cut none of them was resolved, and filtering to
//    `pending` would make a past window SHRINK as the user confirms. `skipped` is
//    never counted: that is the user saying the expense did not happen.
//
//    A past window is a RECONSTRUCTED RECORD, not a replay. The generator
//    materializes one pending instance per rule and only once its date arrives,
//    so at the cut the window's fixed expenses were unpersisted projection, and
//    rules carry no history to rebuild it from. Re-projecting today's rules over
//    an elapsed window would use today's amounts, lose the rules since retired
//    and invent the ones created after — worse than not reconstructing.
//
// Overdue statements are carried with their OWN label under BOTH lenses, by one
// rule: due before the snapshot and unpaid as of it. Under `live` the snapshot
// is today, so that is the current behaviour with no special case. The carryover
// is never about the window's own statements — those all fall due after the cut
// — but about the ones BEFORE it, which is why it survives navigating back: a
// statement due 28/07 and still unpaid on 31/08 was overdue that day.
//
// KNOWN GAP (accepted, unchanged by this read): a statement due after the
// snapshot but before the window opens is in neither set. Under `live` that is
// the rest of the current month; under `snapshot` it narrows to statements due
// exactly ON the cut, since the window opens the next day. The threshold stays
// strictly `<` because that is `derivePeriodStatus`'s definition of overdue —
// softening it here would have this card call a statement overdue while the
// cards module calls the same one "closed, awaiting payment".
//
// KNOWN GAP: the materialized record has holes. `recurrence_instances` allows
// one pending instance per rule and the generator produces none while one is
// open, so a rule left unresolved in July generated nothing for August or
// September, and those windows read $0 for it.
//
// KNOWN GAP: same as getMonthCategoryBreakdown — the reads below have no
// `.range()`. They are bounded by the window, which is an observation about the
// data, not a property of the code, and their product is a money number. Out of
// scope of `fix-balance-read-path-defects` (2026-07-30); same fix applies.

/** Rows the "Gastos fijos" group lists; the panel scrolls internally past that. */
const COMMITTED_RECURRING_ROWS = 10

function emptyCommittedCurrency(): CommittedCurrency {
  return {
    debt: 0,
    overdue: 0,
    recurringExpense: 0,
    recurringIncome: 0,
    cards: [],
    topRecurring: [],
  }
}

export async function getCommittedOutlookForMonth(
  supabase: SupabaseClient,
  {
    year,
    month,
    todayISO = formatDateISO(getTodayAR()),
  }: { year: number; month: number; todayISO?: string },
): Promise<CommittedOutlook> {
  const { window, snapshotDate, lens, windowElapsed } = resolveCommittedWindow({
    year,
    month,
    todayISO,
  })
  const windowStart = window.start
  const windowEnd = window.end

  const result: CommittedOutlook = {
    ARS: emptyCommittedCurrency(),
    USD: emptyCommittedCurrency(),
    window,
    snapshotDate,
    lens,
    windowElapsed,
  }

  // Every credit account, archived ones included. The full set is what the "paid
  // by card" exclusion below tests against — a recurrence pointing at a card that
  // was archived is still not money leaving an account this month — and, under a
  // snapshot lens, it is also the set whose statements the outlook lists.
  const { data: creditAccounts, error: cardsErr } = await supabase
    .from('accounts')
    .select('id, name, is_active, institution:institutions(name)')
    .eq('type', 'credit')
  if (cardsErr) throw cardsErr
  type CardAccountRow = {
    id: string
    name: string
    is_active: boolean
    institution: NameEmbed
  }
  const creditRows = (creditAccounts ?? []) as unknown as CardAccountRow[]
  const creditAccountIds = new Set(creditRows.map((c) => c.id))
  // WHICH cards the outlook lists depends on the lens. Under `live` it is the
  // active ones: an archived card is one the user has put away, and that is the
  // current behaviour. Under `snapshot` archiving is not retroactive — a card
  // archived in August was live through June's window, and its statement was a
  // real commitment then. Filtering it out would silently drop part of a past
  // window's total, and the number would change on a day nothing was paid,
  // breaking the stability the snapshot lens is for.
  //
  // KNOWN GAP (pre-existing, unchanged here): under `live` an archived card with
  // a still-unpaid statement due inside the window is money owed that the card
  // does not name. Widening `live` would move production numbers and belongs to
  // its own change.
  const cardRows = lens === 'snapshot' ? creditRows : creditRows.filter((c) => c.is_active)
  const cardIds = cardRows.map((c) => c.id)

  if (cardIds.length > 0) {
    // Everything due on or before the window's end: that is the window's own
    // statements plus anything already overdue. Statements due after the window
    // are somebody else's month.
    const { data: periods, error: periodsErr } = await supabase
      .from('card_periods')
      .select('id, due_date, end_date, account_id')
      .in('account_id', cardIds)
      .lte('due_date', windowEnd)
    if (periodsErr) throw periodsErr
    const candidates = periods ?? []
    const candidateIds = candidates.map((p) => p.id)

    if (candidateIds.length > 0) {
      // The payment's FINANCIAL date, not merely that a payment row exists and
      // not `period_payments.created_at` (which records when it was entered in
      // the app). A statement settled AFTER the snapshot was still owed at the
      // snapshot and belongs in that reading.
      const { data: payments, error: payErr } = await supabase
        .from('period_payments')
        .select('period_id, transaction:transactions!period_payments_transaction_id_fkey(date)')
        .in('period_id', candidateIds)
      if (payErr) throw payErr
      type PaymentRow = {
        period_id: string
        transaction: { date: string | null } | { date: string | null }[] | null
      }
      const paymentDateOf = (t: PaymentRow['transaction']): string | null =>
        Array.isArray(t) ? (t[0]?.date ?? null) : (t?.date ?? null)
      // Paid as of the snapshot — and a statement is settled only when EVERY debit of
      // its payment has left. A mixed statement is paid with one debit per currency,
      // and those can carry different dates: if the pesos left on the 5th and the
      // dollars on the 20th, at a cut on the 10th that statement was still owed. Asking
      // it row by row would have dropped it from the commitments on the strength of the
      // first debit alone. A payment with no readable date is treated as paid — the
      // conservative reading, and the shape today's behaviour has.
      const debitsByPeriod = new Map<string, boolean[]>()
      for (const row of (payments ?? []) as unknown as PaymentRow[]) {
        const date = paymentDateOf(row.transaction)
        const settledAtCut = date == null || date <= snapshotDate
        debitsByPeriod.set(row.period_id, [
          ...(debitsByPeriod.get(row.period_id) ?? []),
          settledAtCut,
        ])
      }
      const paidAtSnapshot = new Set(
        [...debitsByPeriod.entries()]
          .filter(([, debits]) => debits.every(Boolean))
          .map(([periodId]) => periodId),
      )
      const unpaid = candidates.filter((p) => !paidAtSnapshot.has(p.id))

      // Disjoint by construction: the window opens the day after the snapshot,
      // so nothing due before the snapshot can also fall inside it.
      const windowPeriods = unpaid.filter(
        (p) => p.due_date >= windowStart && p.due_date <= windowEnd,
      )
      const overduePeriodIds = new Set(
        unpaid.filter((p) => p.due_date < snapshotDate).map((p) => p.id),
      )
      const windowPeriodIds = new Set(windowPeriods.map((p) => p.id))
      const readIds = [...windowPeriodIds, ...overduePeriodIds]

      if (readIds.length > 0) {
        const { data: txData, error: txErr } = await supabase
          .from('transactions')
          .select(
            'type, amount, currency_code, status, received_at, cancelled_at, card_period_id, description, date, category:categories(name), subcategory:subcategories(name)',
          )
          .in('card_period_id', readIds)
          .eq('is_parent', false)
        if (txErr) throw txErr
        type CardTxRow = CardDebtRow & {
          description: string | null
          category: NameEmbed
          subcategory: NameEmbed
        }
        const txs = (txData ?? []) as unknown as CardTxRow[]
        const inSet = (set: Set<string>) => (t: CardTxRow) =>
          t.card_period_id != null && set.has(t.card_period_id)

        // Under `live` a statement still owed has all its consumos `pending`, so
        // the status-based sum is exact. Under `snapshot` a statement paid after
        // the cut has flipped them all to `paid`, and summing only `pending`
        // would read zero — hence the as-of aggregation.
        const totalFor = lens === 'live' ? aggregateCardDebt : aggregateCardDebtAsOf
        const toPay = totalFor(txs.filter(inSet(windowPeriodIds)))
        const overdue = totalFor(txs.filter(inSet(overduePeriodIds)))
        result.ARS.debt = toPay.ARS
        result.USD.debt = toPay.USD
        result.ARS.overdue = overdue.ARS
        result.USD.overdue = overdue.USD

        // Debt grouped BY CARD for the "Compromisos" list — the window's
        // statements only, so the rows add up to the headline. Overdue money
        // has its own line and does not hide inside a card's row.
        //
        // The next close is the earliest end_date still ahead of the SNAPSHOT
        // among the statements we read; null once every one of them had closed
        // by then. Reading it against today would date a past window's card rows
        // with a close that had not happened yet at the cut.
        const periodToCard = new Map(windowPeriods.map((p) => [p.id, p.account_id]))
        const nextCloseByCard = new Map<string, string>()
        for (const period of unpaid) {
          if (period.end_date < snapshotDate) continue
          const current = nextCloseByCard.get(period.account_id)
          if (current === undefined || period.end_date < current) {
            nextCloseByCard.set(period.account_id, period.end_date)
          }
        }
        const byCard = aggregateCardDebtByCard(
          txs,
          periodToCard,
          cardRows.map((card) => ({
            id: card.id,
            label: embedName(card.institution) || card.name,
            nextClose: nextCloseByCard.get(card.id) ?? null,
          })),
          lens === 'snapshot',
        )
        result.ARS.cards = byCard.ARS
        result.USD.cards = byCard.USD
      }
    }
  }

  // ── Gastos fijos: the window's recurrence occurrences, from both sources.
  //
  //  · Instances the generator has ALREADY created for the window. Which of them
  //    count depends on the LENS, not on whether the window ended. Under `live`
  //    only the still-`pending` ones are a commitment — a confirmed one is money
  //    already spent. Under `snapshot` the `confirmed` ones count too: at the cut
  //    none of them was resolved yet, and filtering to `pending` would make the
  //    total SHRINK day by day as the user works through them, which is the
  //    opposite of the stability a past reading owes. `skipped` never counts
  //    under either lens.
  //
  //  · Occurrences of the active rules PROJECTED over the window, which depends
  //    on `windowElapsed` and NOT on the lens. While the window has not ended the
  //    `last_generated_date` cursor has not passed it, so the projection still
  //    returns what has not materialized — true for the current month AND for the
  //    previous one, whose window is the month now running. Once the window has
  //    ended the projection is dropped: it would price occurrences at the rules'
  //    CURRENT amounts (confirm propagates a corrected amount back to the rule),
  //    lose the rules retired since, and invent the ones created after.
  //
  // The two never overlap: the projection advances from `last_generated_date`, so
  // it never returns an occurrence already generated — including one already
  // confirmed, which moved the cursor past itself.
  const instanceStatuses = lens === 'live' ? ['pending'] : ['pending', 'confirmed']
  const [instancesResult, rulesResult] = await Promise.all([
    supabase
      .from('recurrence_instances')
      .select(
        'amount, currency_code, description, scheduled_date, account_id, recurrence:recurrences(movement_type), category:categories(name), subcategory:subcategories(name)',
      )
      .in('status', instanceStatuses)
      .gte('scheduled_date', windowStart)
      .lte('scheduled_date', windowEnd),
    supabase
      .from('recurrences')
      .select(
        'id, start_date, end_date, interval_count, interval_unit, max_occurrences, last_generated_date, amount, currency_code, movement_type, description, account_id, category:categories(name), subcategory:subcategories(name)',
      )
      .eq('status', 'active'),
  ])
  if (instancesResult.error) throw instancesResult.error
  if (rulesResult.error) throw rulesResult.error

  type MovementTypeEmbed = { movement_type: string }
  type PendingInstanceRow = {
    amount: number | string
    currency_code: string
    description: string | null
    scheduled_date: string | null
    account_id: string | null
    // PostgREST returns the to-one embeds as objects, but the generated types
    // widen them to arrays — tolerate both.
    recurrence: MovementTypeEmbed | MovementTypeEmbed[] | null
    category: NameEmbed
    subcategory: NameEmbed
  }
  const movementTypeOf = (r: PendingInstanceRow['recurrence']): string | undefined =>
    Array.isArray(r) ? r[0]?.movement_type : (r?.movement_type ?? undefined)

  // Paid by credit card → excluded from "Gastos fijos": it is already inside
  // that card's statement and will be paid when the statement comes due.
  const paidByCard = (accountId: string | null): boolean =>
    accountId != null && creditAccountIds.has(accountId)

  const generatedExpenses: CommittedItemRow[] = (
    (instancesResult.data ?? []) as unknown as PendingInstanceRow[]
  )
    .filter((i) => movementTypeOf(i.recurrence) === 'expense' && !paidByCard(i.account_id))
    .map((i) => ({
      amount: i.amount,
      currency_code: i.currency_code,
      description: i.description || embedName(i.subcategory) || embedName(i.category),
      date: i.scheduled_date,
    }))

  type RecurrenceRuleRow = CommittedRecurrenceRule & {
    account_id: string | null
    category: NameEmbed
    subcategory: NameEmbed
  }
  const ruleRows = (rulesResult.data ?? []) as unknown as RecurrenceRuleRow[]
  const labelled = (r: RecurrenceRuleRow): CommittedRecurrenceRule => ({
    ...r,
    description: r.description || embedName(r.subcategory) || embedName(r.category),
  })

  const projectedExpenses = windowElapsed
    ? []
    : projectRecurrenceItems(
        ruleRows
          .filter((r) => r.movement_type === 'expense' && !paidByCard(r.account_id))
          .map(labelled),
        windowStart,
        windowEnd,
      )

  const fixedExpenses: CommittedItemRow[] = [...generatedExpenses, ...projectedExpenses]
  const fixedTotals = sumByCurrency(fixedExpenses)
  result.ARS.recurringExpense = fixedTotals.ARS
  result.USD.recurringExpense = fixedTotals.USD
  result.ARS.topRecurring = topCommittedItems(fixedExpenses, 'ARS', COMMITTED_RECURRING_ROWS)
  result.USD.topRecurring = topCommittedItems(fixedExpenses, 'USD', COMMITTED_RECURRING_ROWS)

  // ── Recurring INCOME projected into the same window → "Ya entra" context
  //    band. Income is never summed into the committed total. Card-paid rules
  //    are NOT excluded here: the exclusion is about double-counting an outflow,
  //    and an income does not land in a statement.
  // Same gate as the expenses: over an elapsed window the projection would price
  // income at the rules' current amounts.
  const income = sumByCurrency(
    windowElapsed
      ? []
      : projectRecurrenceItems(
          ruleRows.filter((r) => r.movement_type === 'income').map(labelled),
          windowStart,
          windowEnd,
        ),
  )
  result.ARS.recurringIncome = income.ARS
  result.USD.recurringIncome = income.USD

  return result
}

// ── getMonthSpending ("Cuánto gastaste") ──────────────────────────────────────
// The month's OWN spending split by settlement state, per currency.
//
// Same DEVENGADO lens as `getMonthCategoryBreakdown` — same temporal cut, same
// `countsAsCategorySpend` exclusions, same `categoryOwnPortion` share resolution
// — so the two agree on WHAT counts as your spending; they only group it
// differently (by payment state here, by category there). Reusing the shared
// helpers is what keeps them from drifting.
//
// This read exists instead of deriving the card from `accrued − totalExpense`:
// that subtraction mixed lenses (`totalExpense` is the FULL amount of a shared
// expense, the accrual is YOUR share) and understated the card debt by the
// partner's share of everything you fronted.
export async function getMonthSpending(
  supabase: SupabaseClient,
  month: string,
  todayISO: string = financialTodayISO(),
): Promise<MonthSpendingByCurrency> {
  const { from, to } = resolveMonthRange(month)
  const cut = cajaCutOrFilter(todayISO)

  const [accountsResult, expensesResult, reimbursementsResult] = await Promise.all([
    // Every account of MINE, credit cards included: whose account paid is what
    // separates "lo pusiste vos" from "lo puso el otro". RLS scopes this to me.
    supabase.from('accounts').select('id'),
    supabase
      .from('transactions')
      .select(
        'id, amount, currency_code, account_id, card_period_id, is_parent, is_shared, period_payments!period_payments_transaction_id_fkey(id)',
      )
      .eq('type', 'expense')
      .gte('date', from)
      .lte('date', to)
      .or(cut),
    supabase
      .from('transactions')
      .select(
        'id, amount, currency_code, account_id, card_period_id, reimbursement_target, is_shared',
      )
      .eq('type', 'reimbursement')
      .not('received_at', 'is', null)
      .is('cancelled_at', null)
      .gte('date', from)
      .lte('date', to)
      .or(cut),
  ])
  if (accountsResult.error) throw accountsResult.error
  if (expensesResult.error) throw expensesResult.error
  if (reimbursementsResult.error) throw reimbursementsResult.error

  type ExpenseRow = {
    id: string
    amount: number
    currency_code: string
    account_id: string | null
    card_period_id: string | null
    is_parent: boolean
    is_shared: boolean
    period_payments: { id: string }[] | null
  }
  type ReimbRow = {
    id: string
    amount: number
    currency_code: string
    account_id: string | null
    card_period_id: string | null
    reimbursement_target: string | null
    is_shared: boolean
  }

  const myAccountIds = ((accountsResult.data ?? []) as Array<{ id: string }>).map((a) => a.id)
  const expenseRows = (expensesResult.data ?? []) as unknown as ExpenseRow[]
  const reimbRows = (reimbursementsResult.data ?? []) as unknown as ReimbRow[]

  // Shared movements contribute only the user's assigned portion. The split RLS
  // exposes BOTH members' rows, so filter by her uid explicitly.
  const sharedIds = [
    ...new Set([
      ...expenseRows.filter((e) => e.is_shared).map((e) => e.id),
      ...reimbRows.filter((r) => r.is_shared).map((r) => r.id),
    ]),
  ]
  const mySplitByTx = new Map<string, number>()
  if (sharedIds.length > 0) {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (user) {
      const { data: splits } = await supabase
        .from('shared_expense_split')
        .select('transaction_id, amount_assigned')
        .eq('user_id', user.id)
        .in('transaction_id', sharedIds)
      for (const s of splits ?? [])
        mySplitByTx.set(s.transaction_id as string, Number(s.amount_assigned))
    }
  }

  const rows: MonthSpendingRow[] = []
  for (const e of expenseRows) {
    // Installment parent (off-ledger) and statement payment (cancels debt, not
    // new spending) — the same exclusions the category lens applies.
    if (
      !countsAsCategorySpend({
        is_parent: e.is_parent,
        hasStatementPayment: (e.period_payments?.length ?? 0) > 0,
      })
    ) {
      continue
    }
    const amount = categoryOwnPortion(e, mySplitByTx)
    if (amount === null) continue // shared with no own split → not ours
    rows.push({
      kind: 'expense',
      amount,
      currency_code: e.currency_code,
      account_id: e.account_id,
      card_period_id: e.card_period_id,
    })
  }
  for (const r of reimbRows) {
    const amount = categoryOwnPortion(r, mySplitByTx)
    if (amount === null) continue
    rows.push({
      kind: 'reimbursement',
      amount,
      currency_code: r.currency_code,
      account_id: r.account_id,
      card_period_id: r.card_period_id,
      reimbursement_target: r.reimbursement_target,
    })
  }

  return aggregateMonthSpending(rows, myAccountIds)
}

// ── Spending-overview reads (shared with mobile) ──────────────────────────────
// `hasUsdAccount`, `getMonthIncomeBreakdown` and `getMonthSubcategoryBreakdown`
// were extracted from `apps/web/lib/transactions/queries.ts` so the native
// "En qué se fue" card can reuse them. They land HERE (and not in
// `@grana/transactions`) because they only need `@grana/money-logic` + Supabase,
// and they sit next to their twin `getMonthCategoryBreakdown`. The drilled list
// (`getMonthCategoryLines`) could NOT come along: it needs the movement
// machinery, and `transactions` already depends on this package — see the
// `repo-architecture` rule on picking a package by the dependency graph.
// Whether the user operates in USD at all — i.e. has at least one account with a
// USD currency row (bimoneda). Drives the ARS/USD toggle in the spending
// overview so it shows on every month for bimoneda users, not only on months
// that happen to have USD movements. User-level, month-independent; a single
// lightweight count query (head: true), RLS-scoped to the user's accounts.
export async function hasUsdAccount(supabase: GranaSupabaseClient): Promise<boolean> {
  const { count, error } = await supabase
    .from('account_currencies')
    .select('account_id', { count: 'exact', head: true })
    .eq('currency_code', 'USD')
  if (error) throw error
  return (count ?? 0) > 0
}

// ── getMonthIncomeBreakdown ────────────────────────────────────────────────────
// Income by category for a month: the twin of getMonthCategoryBreakdown but for
// the "De dónde vino" (Ingresos) mode of the spending overview. Aggregates
// `type='income'` rows by category and currency. Deliberately does NOT include
// reimbursements: per the domain rules a reimbursement is `type='reimbursement'`
// and is never income (it derives an expense's category and only reduces spend),
// so mixing it here would double-count money already netted out of the egresos
// donut. Uncategorized income is bucketed under the `uncategorized` sentinel
// (the UI labels it via i18n).

export async function getMonthIncomeBreakdown(
  supabase: GranaSupabaseClient,
  month: string,
  todayISO: string = financialTodayISO(),
): Promise<MonthCategoryBreakdown> {
  const { from, to } = resolveMonthRange(month)

  const { data, error } = await supabase
    .from('transactions')
    .select('category_id, currency_code, amount')
    .eq('type', 'income')
    .gte('date', from ?? '')
    .lte('date', to ?? '')
    // Temporal cut: income is always on-ledger (a card never receives income),
    // so the CAJA rule applies unconditionally — money you expect to receive
    // later this month has not arrived and is not part of "De dónde vino".
    .or(cajaCutOrFilter(todayISO))
  if (error) throw error

  const rows = (data ?? []) as unknown as Array<{
    category_id: string | null
    currency_code: string
    amount: number
  }>

  // Net per category and currency (income amounts are positive; Money keeps the
  // arithmetic exact instead of raw JS addition).
  const byCategory = new Map<string, { ARS: number; USD: number }>()
  for (const r of rows) {
    const id = r.category_id ?? UNCATEGORIZED_ID
    const currency = r.currency_code === 'USD' ? 'USD' : 'ARS'
    const entry = byCategory.get(id) ?? { ARS: 0, USD: 0 }
    entry[currency] = Money.toNumber(Money.add(Money.from(entry[currency]), Money.from(r.amount)))
    byCategory.set(id, entry)
  }

  const realIds = [...byCategory.keys()].filter((id) => id !== UNCATEGORIZED_ID)
  const categoryById = new Map<
    string,
    {
      name: string
      color: string | null
      icon: string | null
      canonical_name: string
      user_id: string | null
    }
  >()
  if (realIds.length > 0) {
    const { data: cats } = await supabase
      .from('categories')
      .select('id, name, color, icon, canonical_name, user_id')
      .in('id', realIds)
    for (const c of cats ?? []) {
      categoryById.set(c.id, {
        name: c.name,
        color: c.color,
        icon: c.icon,
        canonical_name: c.canonical_name,
        user_id: c.user_id,
      })
    }
  }

  const build = (currency: 'ARS' | 'USD'): CategorySliceInput[] => {
    const out: CategorySliceInput[] = []
    for (const [id, perCurrency] of byCategory.entries()) {
      const value = perCurrency[currency]
      if (value <= 0) continue
      const display = id === UNCATEGORIZED_ID ? null : categoryById.get(id)
      // Uncategorized label is left empty; the UI fills it (i18n). System
      // categories carry translation handles so consumers relabel via i18n.
      out.push({
        categoryId: id,
        label: display?.name ?? '',
        color: display?.color ?? null,
        icon: display?.icon ?? null,
        value,
        canonicalName: display?.canonical_name ?? null,
        isSystem: display != null && display.user_id === null,
      })
    }
    return out
  }

  // Income is always positive, so it never produces credits (those only arise
  // from reimbursements netting against spend). The field is empty by construction.
  return { ARS: build('ARS'), USD: build('USD'), credits: { ARS: [], USD: [] } }
}

// ── getMonthSubcategoryBreakdown ───────────────────────────────────────────────
// Same logic as `getMonthCategoryBreakdown`, but scoped to one category and
// keyed by subcategory. Used when the user filters by a single category — the
// donut switches to show the in-category composition. Transactions without a
// subcategory aggregate under `SUBCATEGORY_UNCATEGORIZED_ID`; the UI labels
// it via i18n.

/** Marker used as the aggregation key for "no subcategory assigned" rows.
 *  Distinct from the URL marker SUBCATEGORY_NONE_MARKER to avoid collisions in
 *  the aggregation; the UI translates this to the URL marker for drill-down. */
export const SUBCATEGORY_UNCATEGORIZED_ID = '__no_subcategory__'

export type MonthSubcategoryBreakdown = {
  ARS: SubcategorySliceInput[]
  USD: SubcategorySliceInput[]
}

export async function getMonthSubcategoryBreakdown(
  supabase: GranaSupabaseClient,
  month: string,
  categoryId: string,
  todayISO: string = financialTodayISO(),
): Promise<MonthSubcategoryBreakdown> {
  const { from, to } = resolveMonthRange(month)
  // Same CAJA cut as the parent donut: the subcategory slices must add up to the
  // category weight they decompose.
  const cut = cajaCutOrFilter(todayISO)

  const [expensesResult, reimbursementsResult, categoryResult] = await Promise.all([
    supabase
      .from('transactions')
      .select('id, subcategory_id, currency_code, amount, is_parent, is_shared, period_payments!period_payments_transaction_id_fkey(id)')
      .eq('type', 'expense')
      .eq('category_id', categoryId)
      // Devengado: include card consumos/cuotas by their date (consistent with
      // the category breakdown). The loop still skips the installment parent
      // (is_parent) and statement payments (period_payments).
      .gte('date', from ?? '')
      .lte('date', to ?? '')
      .or(cut),
    supabase
      .from('transactions')
      .select('id, amount, currency_code, linked_transaction_id, received_at, cancelled_at, is_shared')
      .eq('type', 'reimbursement')
      .not('received_at', 'is', null)
      .is('cancelled_at', null)
      .gte('date', from ?? '')
      .lte('date', to ?? '')
      .or(cut),
    supabase.from('categories').select('color').eq('id', categoryId).single(),
  ])
  if (expensesResult.error) throw expensesResult.error
  if (reimbursementsResult.error) throw reimbursementsResult.error
  // categoryResult error tolerated: a missing category just leaves the slice
  // color null and the UI falls back to a neutral palette.

  const parentCategoryColor = (categoryResult.data?.color as string | null) ?? null

  const expenseRows = (expensesResult.data ?? []) as unknown as Array<{
    id: string
    subcategory_id: string | null
    currency_code: string
    amount: number
    is_parent: boolean
    is_shared: boolean
    period_payments: { id: string }[] | null
  }>
  const reimbRows = (reimbursementsResult.data ?? []) as unknown as Array<{
    id: string
    amount: number
    currency_code: string
    linked_transaction_id: string | null
    received_at: string | null
    cancelled_at: string | null
    is_shared: boolean
  }>

  // Reimbursements net against their linked expense's subcategory. Filter to
  // only those linked to expenses in the active category — others belong to a
  // different category breakdown.
  const linkedIds = [
    ...new Set(reimbRows.map((r) => r.linked_transaction_id).filter((id): id is string => Boolean(id))),
  ]
  const linkedSubcategoryById = new Map<string, { subcategoryId: string | null; categoryId: string | null }>()
  if (linkedIds.length > 0) {
    const { data: linked } = await supabase
      .from('transactions')
      .select('id, category_id, subcategory_id')
      .in('id', linkedIds)
    for (const e of linked ?? []) {
      linkedSubcategoryById.set(e.id, {
        subcategoryId: e.subcategory_id,
        categoryId: e.category_id,
      })
    }
  }

  // Reuse computeCategoryNet by feeding subcategoryId as the key (with a
  // sentinel for nulls). The function is agnostic to what the key means.
  // Shared movements count only the user's portion (household "cuenta
  // corriente"), same rule as getMonthCategoryBreakdown. The split RLS exposes
  // both members' rows, so filter by her uid explicitly.
  const sharedIds = [
    ...new Set([
      ...expenseRows.filter((e) => e.is_shared).map((e) => e.id),
      ...reimbRows.filter((r) => r.is_shared).map((r) => r.id),
    ]),
  ]
  const mySplitByTx = new Map<string, number>()
  if (sharedIds.length > 0) {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (user) {
      const { data: splits } = await supabase
        .from('shared_expense_split')
        .select('transaction_id, amount_assigned')
        .eq('user_id', user.id)
        .in('transaction_id', sharedIds)
      for (const s of splits ?? [])
        mySplitByTx.set(s.transaction_id as string, Number(s.amount_assigned))
    }
  }
  const aggRows: CategoryAggRow[] = []
  for (const e of expenseRows) {
    if (!countsAsCategorySpend({
      is_parent: e.is_parent,
      hasStatementPayment: (e.period_payments?.length ?? 0) > 0,
    })) continue
    const amount = categoryOwnPortion(e, mySplitByTx)
    if (amount === null) continue // shared with no own split → not ours
    aggRows.push({
      categoryId: e.subcategory_id ?? SUBCATEGORY_UNCATEGORIZED_ID,
      kind: 'expense',
      currency_code: e.currency_code,
      amount,
    })
  }
  for (const r of reimbRows) {
    const amount = categoryOwnPortion(r, mySplitByTx)
    if (amount === null) continue
    const linked = r.linked_transaction_id ? linkedSubcategoryById.get(r.linked_transaction_id) : null
    if (!linked || linked.categoryId !== categoryId) continue
    aggRows.push({
      categoryId: linked.subcategoryId ?? SUBCATEGORY_UNCATEGORIZED_ID,
      kind: 'reimbursement',
      currency_code: r.currency_code,
      amount,
      received_at: r.received_at,
      cancelled_at: r.cancelled_at,
    })
  }

  const netBySubcategory = computeCategoryNet(aggRows)

  const realIds = [...netBySubcategory.keys()].filter((id) => id !== SUBCATEGORY_UNCATEGORIZED_ID)
  const subcategoryById = new Map<
    string,
    { name: string; canonical_name: string; user_id: string | null }
  >()
  if (realIds.length > 0) {
    const { data: subs } = await supabase
      .from('subcategories')
      .select('id, name, canonical_name, user_id')
      .in('id', realIds)
    for (const s of subs ?? []) {
      subcategoryById.set(s.id, {
        name: s.name,
        canonical_name: s.canonical_name,
        user_id: s.user_id,
      })
    }
  }

  const build = (currency: 'ARS' | 'USD'): SubcategorySliceInput[] => {
    const out: SubcategorySliceInput[] = []
    for (const [id, perCurrency] of netBySubcategory.entries()) {
      const value = perCurrency[currency].neto
      if (value <= 0) continue
      const isNone = id === SUBCATEGORY_UNCATEGORIZED_ID
      const display = isNone ? null : subcategoryById.get(id) ?? null
      out.push({
        subcategoryId: isNone ? null : id,
        // Label resolved by the UI for i18n. Real subcategories get their
        // name from the DB; the "Sin subcategoría" bucket comes back with
        // an empty label. System rows carry translation handles.
        label: display?.name ?? '',
        color: parentCategoryColor,
        icon: null,
        value,
        canonicalName: display?.canonical_name ?? null,
        isSystem: display != null && display.user_id === null,
      })
    }
    return out
  }

  return { ARS: build('ARS'), USD: build('USD') }
}
