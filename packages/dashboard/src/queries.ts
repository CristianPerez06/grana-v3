import type { SupabaseClient } from '@supabase/supabase-js'
import {
  computeCategoryNet,
  getTodayAR,
  type CategoryAggRow,
  type CategorySliceInput,
} from '@grana/money-logic'
import {
  aggregateCardDebt,
  aggregateHero,
  aggregateRecurrenceProjection,
  buildMonthBalanceSeries,
  calculateTransactionSums,
  sumByCurrency,
  topCommittedItems,
  type BalanceTransactionRow,
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
  const { data: accounts, error } = await supabase
    .from('accounts')
    .select(
      'id, name, type, color_key, icon_key, institution:institutions(name, brand_color, icon_type), currencies:account_currencies(currency_code, initial_balance)',
    )
    .in('type', ['cash', 'bank'])
    .eq('is_active', true)

  if (error) throw error

  const accountIds = (accounts ?? []).map((a) => a.id)
  const txSums = await getTransactionSums(supabase, accountIds)

  return aggregateHero((accounts ?? []) as unknown as HeroAccountRow[], txSums)
}

async function getTransactionSums(
  supabase: SupabaseClient,
  accountIds: string[],
): Promise<Map<string, { ARS: number; USD: number }>> {
  if (accountIds.length === 0) return new Map()

  // Exclude credit card child transactions (status IS NOT NULL) and
  // off-ledger parent rows (is_parent=true, account_id=NULL, auto-excluded by the or filter).
  // destination_amount/currency feed the exchange leg; reimbursement_target +
  // received_at + cancelled_at gate which reimbursements credit the account; and
  // settlement_direction gates the settlement leg — all consumed by
  // calculateTransactionSums. Omitting any of them silently drops that type from
  // the disponible (the bug this reconciliation change fixes).
  const { data, error } = await supabase
    .from('transactions')
    .select('account_id, transfer_destination_account_id, currency_code, amount, type, destination_amount, destination_currency, reimbursement_target, received_at, cancelled_at, settlement_direction')
    .or(
      `account_id.in.(${accountIds.join(',')}),transfer_destination_account_id.in.(${accountIds.join(',')})`,
    )
    .is('status', null)

  if (error) throw error

  return calculateTransactionSums((data ?? []) as BalanceTransactionRow[], accountIds)
}

export async function getMonthBalanceSeries(
  supabase: SupabaseClient,
  year: number,
  month: number,
): Promise<MonthBalanceByCurrency> {
  const firstDay = new Date(year, month - 1, 1)
  const lastDay = new Date(year, month, 0)
  const fromISO = formatDateISO(firstDay)
  const toISO = formatDateISO(lastDay)

  const { data: accs, error: accsErr } = await supabase
    .from('accounts')
    .select('id')
    .in('type', ['cash', 'bank'])

  if (accsErr) throw accsErr
  const accIds = (accs ?? []).map((a) => a.id)
  if (accIds.length === 0) {
    return {
      year,
      month,
      ARS: buildMonthBalanceSeries(year, month, [], [], 'ARS'),
      USD: buildMonthBalanceSeries(year, month, [], [], 'USD'),
    }
  }

  // Fetch every cash movement of the month on owned accounts. We do NOT
  // pre-partition by currency_code: an `exchange` row's destination leg lives in
  // `destination_currency` (the other currency), so each currency series must
  // see all rows and pick the leg(s) relevant to it (see buildMonthBalanceSeries).
  // The extra fields + `period_payments(id)` feed the per-type sign rules and the
  // card-payment detection (same embed `getMonthCategoryBreakdown` uses).
  const { data: txs, error: txsErr } = await supabase
    .from('transactions')
    .select(
      'id, date, type, amount, currency_code, account_id, transfer_destination_account_id, destination_amount, destination_currency, reimbursement_target, received_at, cancelled_at, settlement_direction, created_at, period_payments(id)',
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

  if (txsErr) throw txsErr

  const rows: MonthBalanceTxInput[] = (
    (txs ?? []) as unknown as Array<
      Omit<MonthBalanceTxInput, 'is_card_payment'> & { period_payments: { id: string }[] | null }
    >
  ).map((t) => ({ ...t, is_card_payment: (t.period_payments?.length ?? 0) > 0 }))

  return {
    year,
    month,
    ARS: buildMonthBalanceSeries(year, month, rows, accIds, 'ARS'),
    USD: buildMonthBalanceSeries(year, month, rows, accIds, 'USD'),
  }
}

// ── getMonthCategoryBreakdown ──────────────────────────────────────────────────
// Spending by category for a month: expenses (cash/debit + card consumos + the
// installment cuota that accrues in the month) minus received reimbursements,
// net per category and currency. Excludes installment parents (off-ledger) and
// statement payments (the spend already counted as the consumos). Uncategorized
// spend is bucketed under the `uncategorized` sentinel (the UI labels it).

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
): Promise<MonthCategoryBreakdown> {
  const { from, to } = resolveMonthRange(month)

  const [expensesResult, reimbursementsResult] = await Promise.all([
    supabase
      .from('transactions')
      .select('id, category_id, currency_code, amount, is_parent, is_shared, period_payments(id)')
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
      .lte('date', to),
    supabase
      .from('transactions')
      .select('id, amount, currency_code, linked_transaction_id, received_at, cancelled_at, is_shared')
      .eq('type', 'reimbursement')
      .not('received_at', 'is', null)
      .is('cancelled_at', null)
      .gte('date', from)
      .lte('date', to),
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

  // A shared movement contributes only the user's portion; if she has no split
  // (0% / 100% the other member's), it contributes nothing (returns null → skip).
  const ownPortion = (row: { id: string; is_shared: boolean; amount: number }): number | null =>
    row.is_shared ? (mySplitByTx.get(row.id) ?? null) : row.amount

  const aggRows: CategoryAggRow[] = []
  for (const e of expenseRows) {
    if (e.is_parent) continue // installment parent is off-ledger; its cuotas count
    if ((e.period_payments?.length ?? 0) > 0) continue // statement payment, not category spend
    const amount = ownPortion(e)
    if (amount === null) continue // shared with no own split → not ours
    aggRows.push({
      categoryId: e.category_id ?? UNCATEGORIZED_ID,
      kind: 'expense',
      currency_code: e.currency_code,
      amount,
    })
  }
  for (const r of reimbRows) {
    const amount = ownPortion(r)
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
      'id, start_date, end_date, interval_count, interval_unit, max_occurrences, amount, currency_code, movement_type',
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
