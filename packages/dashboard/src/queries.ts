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
  aggregateHero,
  aggregateRecurrenceProjection,
  buildMonthBalanceSeries,
  sumByCurrency,
  topCommittedItems,
  type CardDebtRow,
  type CommittedItemRow,
  type CommittedRecurrenceRule,
  type HeroAccountRow,
  type MonthBalanceTxInput,
} from './aggregations'
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

export async function getDashboardHero(
  supabase: SupabaseClient,
): Promise<DashboardHero> {
  // Which accounts are "propias" is resolved by the normative SQL definition
  // (`get_owned_account_ids`, migration 0051), not by rebuilding the predicate
  // here. The Hero needs the account METADATA too, so it fetches the rows by id
  // — same two sequential steps as before, the metadata read and the balance
  // aggregate now run in parallel.
  const { data: ownedIds, error: ownedErr } = await supabase.rpc('get_owned_account_ids')
  if (ownedErr) throw ownedErr

  const accountIds = (ownedIds ?? []) as string[]
  if (accountIds.length === 0) return aggregateHero([], new Map())

  const [{ data: accounts, error }, txSums] = await Promise.all([
    supabase
      .from('accounts')
      .select(
        'id, name, type, color_key, icon_key, institution:institutions(name, brand_color, icon_type), currencies:account_currencies(currency_code, initial_balance)',
      )
      .in('id', accountIds),
    getTransactionSums(supabase, accountIds),
  ])

  if (error) throw error

  return aggregateHero((accounts ?? []) as unknown as HeroAccountRow[], txSums)
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
): Promise<Map<string, { ARS: number; USD: number }>> {
  if (accountIds.length === 0) return new Map()

  // `p_today` pins the temporal cut (migration 0052) to the UI's financial "hoy".
  const { data, error } = await supabase.rpc('get_account_balance_sums', {
    p_account_ids: accountIds,
    p_today: formatDateISO(getTodayAR()),
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
// Static "from today": card debt (a present stock) + next-calendar-month
// recurrence projection. ARS and USD are never combined. The committed total
// (computed by the UI) is debt + recurringExpense; recurringIncome is context.
//
// KNOWN GAP: same as getMonthCategoryBreakdown — the reads below (card_periods,
// period_payments, the consumos of unpaid statements, recurrence_instances) have
// no `.range()`. They are bounded by "statements already started and unpaid",
// which is an observation about the data, not a property of the code, and their
// product is a money number. Out of scope of `fix-balance-read-path-defects`
// (2026-07-30); same fix applies.

function emptyCommittedCurrency(): CommittedCurrency {
  return {
    debt: 0,
    overdue: 0,
    recurringExpense: 0,
    recurringIncome: 0,
    topCard: [],
    topRecurring: [],
  }
}

export async function getCommittedOutlook(
  supabase: SupabaseClient,
): Promise<CommittedOutlook> {
  const result: CommittedOutlook = {
    ARS: emptyCommittedCurrency(),
    USD: emptyCommittedCurrency(),
  }

  const today = getTodayAR()
  const y = today.getFullYear()
  const m = today.getMonth() // 0-indexed
  const todayISO = formatDateISO(today)
  // Next calendar month window [first day, last day] — only the recurring INCOME
  // projection (the "Ya entra" context band) uses it now.
  const windowStart = formatDateISO(new Date(y, m + 1, 1))
  const windowEnd = formatDateISO(new Date(y, m + 2, 0))

  // ── Card debt: pending consumos − received reimbursements across the unpaid
  //    statements that have ALREADY STARTED (start_date <= today) of active credit
  //    cards. That is "A pagar" (closed/overdue) + "En curso" (the open statement
  //    still accruing) from the Tarjetas module — everything you actually owe on
  //    the card. FUTURE statements (start_date > today: installments 2..N,
  //    projected periods) are excluded — that was the inflation bug. `overdue` is
  //    the subset whose due_date already passed (drives the "incluye $X vencido" flag).
  const { data: cards, error: cardsErr } = await supabase
    .from('accounts')
    .select('id')
    .eq('type', 'credit')
    .eq('is_active', true)
  if (cardsErr) throw cardsErr
  const cardIds = (cards ?? []).map((c) => c.id)

  if (cardIds.length > 0) {
    const { data: periods, error: periodsErr } = await supabase
      .from('card_periods')
      .select('id, due_date')
      .in('account_id', cardIds)
      .lte('start_date', todayISO)
    if (periodsErr) throw periodsErr
    const startedPeriods = periods ?? []
    const periodIds = startedPeriods.map((p) => p.id)

    if (periodIds.length > 0) {
      const { data: payments, error: payErr } = await supabase
        .from('period_payments')
        .select('period_id')
        .in('period_id', periodIds)
      if (payErr) throw payErr
      const paidPeriodIds = new Set((payments ?? []).map((p) => p.period_id))
      const unpaidIds = startedPeriods.filter((p) => !paidPeriodIds.has(p.id)).map((p) => p.id)
      const overdueIds = new Set(
        startedPeriods
          .filter((p) => !paidPeriodIds.has(p.id) && p.due_date < todayISO)
          .map((p) => p.id),
      )

      if (unpaidIds.length > 0) {
        const { data: txData, error: txErr } = await supabase
          .from('transactions')
          .select(
            'type, amount, currency_code, status, received_at, cancelled_at, card_period_id, description, date, category:categories(name), subcategory:subcategories(name)',
          )
          .in('card_period_id', unpaidIds)
          .eq('is_parent', false)
        if (txErr) throw txErr
        type CardTxRow = CardDebtRow & {
          description: string | null
          category: NameEmbed
          subcategory: NameEmbed
        }
        const txs = (txData ?? []) as unknown as CardTxRow[]

        const toPay = aggregateCardDebt(txs)
        const overdue = aggregateCardDebt(
          txs.filter((t) => t.card_period_id != null && overdueIds.has(t.card_period_id)),
        )
        // Top consumos for the section detail: pending charges only (a received
        // reimbursement reduces the total but is not a "consumo to pay"). The label
        // falls back to subcategory/category when the consumo has no description.
        const consumos: CommittedItemRow[] = txs
          .filter((t) => t.status === 'pending' && t.type !== 'reimbursement')
          .map((t) => ({
            amount: t.amount,
            currency_code: t.currency_code,
            date: t.date,
            description: t.description || embedName(t.subcategory) || embedName(t.category),
          }))

        result.ARS.debt = toPay.ARS
        result.USD.debt = toPay.USD
        result.ARS.overdue = overdue.ARS
        result.USD.overdue = overdue.USD
        result.ARS.topCard = topCommittedItems(consumos, 'ARS')
        result.USD.topCard = topCommittedItems(consumos, 'USD')
      }
    }
  }

  // ── Recurrences pending confirmation: generated `expense` instances awaiting
  //    the user's OK (recurrence_instances.status='pending'). We do NOT project
  //    next-month fixed expenses: an occurrence becomes "pending to confirm" when
  //    its time comes (and if paid by card, its debt is already in the card
  //    section), so a future projection is not a present obligation.
  const { data: instData, error: instErr } = await supabase
    .from('recurrence_instances')
    .select(
      'amount, currency_code, description, scheduled_date, recurrence:recurrences(movement_type), category:categories(name), subcategory:subcategories(name)',
    )
    .eq('status', 'pending')
  if (instErr) throw instErr
  type MovementTypeEmbed = { movement_type: string }
  type PendingInstanceRow = {
    amount: number | string
    currency_code: string
    description: string | null
    scheduled_date: string | null
    // PostgREST returns the to-one embeds as objects, but the generated types
    // widen them to arrays — tolerate both.
    recurrence: MovementTypeEmbed | MovementTypeEmbed[] | null
    category: NameEmbed
    subcategory: NameEmbed
  }
  const movementTypeOf = (r: PendingInstanceRow['recurrence']): string | undefined =>
    Array.isArray(r) ? r[0]?.movement_type : (r?.movement_type ?? undefined)

  const pendingExpenses: CommittedItemRow[] = ((instData ?? []) as unknown as PendingInstanceRow[])
    .filter((i) => movementTypeOf(i.recurrence) === 'expense')
    .map((i) => ({
      amount: i.amount,
      currency_code: i.currency_code,
      description: i.description || embedName(i.subcategory) || embedName(i.category),
      date: i.scheduled_date,
    }))

  const pending = sumByCurrency(pendingExpenses)
  result.ARS.recurringExpense = pending.ARS
  result.USD.recurringExpense = pending.USD
  result.ARS.topRecurring = topCommittedItems(pendingExpenses, 'ARS')
  result.USD.topRecurring = topCommittedItems(pendingExpenses, 'USD')

  // ── Recurring INCOME projected into the next calendar month → "Ya entra"
  //    context band. Income is never summed into the committed total.
  const { data: rules, error: rulesErr } = await supabase
    .from('recurrences')
    .select(
      'id, start_date, end_date, interval_count, interval_unit, max_occurrences, last_generated_date, amount, currency_code, movement_type',
    )
    .eq('status', 'active')
  if (rulesErr) throw rulesErr

  const projection = aggregateRecurrenceProjection(
    (rules ?? []) as CommittedRecurrenceRule[],
    windowStart,
    windowEnd,
  )
  result.ARS.recurringIncome = projection.income.ARS
  result.USD.recurringIncome = projection.income.USD

  return result
}
