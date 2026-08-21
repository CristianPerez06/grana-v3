import type { SupabaseClient } from '@supabase/supabase-js'
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
} from '@grana/money-logic'
import {
  aggregateCardDebt,
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

// ── getCommittedOutlook (COMPROMISO lens) ──────────────────────────────────────
// "Cuánta plata ya se sabe que hay que pagar el mes que viene."
//
// The window is the NEXT CALENDAR MONTH, day 1 to last day — not "from today",
// not "the next 30 days". The card is titled by that month, so the number has to
// be that month's. It used to read "from today" (statements already STARTED,
// recurrence instances already PENDING, i.e. ones whose date had already passed)
// while the title promised the next month: the title said one thing and the
// amount showed another.
//
// Two sources, per currency, never combined across currencies:
//
//  · Tarjetas — statements whose DUE DATE falls in the window and are unpaid.
//    The criterion is the due date, not the close date: a statement that closes
//    28/09 but is due 10/10 is paid in October and is not a September
//    commitment. A statement that has not closed yet contributes what it has
//    accrued so far and can still grow — the UI must not sell it as final.
//
//  · Gastos fijos — recurrences falling in the window that are NOT paid by a
//    credit card. One debited from a card does not take money out of the
//    account that month: it lands in that card's statement and is paid when the
//    statement comes due, which is another window. Counting it here AND inside
//    its statement would count it twice.
//
// Overdue statements (due date already past, still unpaid) are money that is
// owed and would fall off the screen if the card only ever showed its window,
// so they are carried with their OWN label. `overdue` is DISJOINT from `debt`:
// what is late and what is merely coming are two different facts and the
// headline total must not blur them.
//
// KNOWN GAP (accepted, follows from the window): a statement due LATER THIS
// MONTH — after today, before the window opens — is in neither set. It is a
// commitment the card does not name. The window is the next calendar month by
// decision; a "this month, still ahead" band is a separate change.
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

/** Next calendar month as [first day, last day], ISO, derived from a date string. */
function nextMonthWindow(todayISO: string): { start: string; end: string } {
  const [year, month] = todayISO.split('-').map(Number)
  // `month` is 1-based, so `month` as a 0-based index is already the NEXT month.
  return {
    start: formatDateISO(new Date(year, month, 1)),
    end: formatDateISO(new Date(year, month + 1, 0)),
  }
}

export async function getCommittedOutlook(
  supabase: SupabaseClient,
  todayISO: string = formatDateISO(getTodayAR()),
): Promise<CommittedOutlook> {
  const result: CommittedOutlook = {
    ARS: emptyCommittedCurrency(),
    USD: emptyCommittedCurrency(),
  }

  const { start: windowStart, end: windowEnd } = nextMonthWindow(todayISO)

  // Every credit account, archived ones included. The ACTIVE ones are the cards
  // the outlook lists; the full set is what the "paid by card" exclusion below
  // tests against — a recurrence pointing at a card that was archived is still
  // not money leaving an account this month.
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
  const cardRows = creditRows.filter((c) => c.is_active)
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
      const { data: payments, error: payErr } = await supabase
        .from('period_payments')
        .select('period_id')
        .in('period_id', candidateIds)
      if (payErr) throw payErr
      const paidPeriodIds = new Set((payments ?? []).map((p) => p.period_id))
      const unpaid = candidates.filter((p) => !paidPeriodIds.has(p.id))

      // Disjoint by construction: the window opens on the 1st of NEXT month, so
      // nothing due before today can also be due inside it. A statement due
      // between today and the window is in neither (see KNOWN GAP above).
      const windowPeriods = unpaid.filter(
        (p) => p.due_date >= windowStart && p.due_date <= windowEnd,
      )
      const overduePeriodIds = new Set(
        unpaid.filter((p) => p.due_date < todayISO).map((p) => p.id),
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

        const toPay = aggregateCardDebt(txs.filter(inSet(windowPeriodIds)))
        const overdue = aggregateCardDebt(txs.filter(inSet(overduePeriodIds)))
        result.ARS.debt = toPay.ARS
        result.USD.debt = toPay.USD
        result.ARS.overdue = overdue.ARS
        result.USD.overdue = overdue.USD

        // Debt grouped BY CARD for the "Compromisos" list — the window's
        // statements only, so the rows add up to the headline. Overdue money
        // has its own line and does not hide inside a card's row.
        //
        // The next close is the earliest end_date still ahead of today among the
        // statements we read; null once every one of them has closed.
        const periodToCard = new Map(windowPeriods.map((p) => [p.id, p.account_id]))
        const nextCloseByCard = new Map<string, string>()
        for (const period of unpaid) {
          if (period.end_date < todayISO) continue
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
        )
        result.ARS.cards = byCard.ARS
        result.USD.cards = byCard.USD
      }
    }
  }

  // ── Gastos fijos: the window's recurrence occurrences, from BOTH sources.
  //
  //  · Instances the generator has ALREADY created for the window and nobody
  //    has resolved yet (`status = 'pending'`).
  //  · Occurrences of the active rules PROJECTED over the window.
  //
  // They cannot overlap: the projection advances from `last_generated_date`, so
  // it never returns an occurrence that has already been generated. Without both
  // the card would be wrong in opposite directions — projection alone would
  // double-count what exists, instances alone would miss everything the
  // generator has not reached yet, which for a next-month window is most of it.
  const [instancesResult, rulesResult] = await Promise.all([
    supabase
      .from('recurrence_instances')
      .select(
        'amount, currency_code, description, scheduled_date, account_id, recurrence:recurrences(movement_type), category:categories(name), subcategory:subcategories(name)',
      )
      .eq('status', 'pending')
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

  const projectedExpenses = projectRecurrenceItems(
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
  const income = sumByCurrency(
    projectRecurrenceItems(
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
