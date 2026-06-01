import type { SupabaseClient } from '@supabase/supabase-js'
import {
  computeCategoryNet,
  type CategoryAggRow,
  type CategorySliceInput,
} from '@grana/money-logic'
import {
  aggregateHero,
  buildMonthBalanceSeries,
  buildUpcomingFortnight,
  calculateTransactionSums,
  type BalanceTransactionRow,
  type HeroAccountRow,
  type UpcomingCardPeriodInput,
  type UpcomingPeriodTxInput,
  type UpcomingRecurrenceInstanceInput,
  type MonthBalanceTxInput,
} from './aggregations'
import type {
  DashboardHero,
  MonthBalanceSeries,
  UpcomingFortnight,
} from './types'

function formatDateISO(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/** First/last accounting date of a `YYYY-MM` month, as ISO `YYYY-MM-DD`. */
export function resolveMonthRange(month: string): { from: string; to: string } {
  const [year, m] = month.split('-').map(Number)
  return {
    from: formatDateISO(new Date(year, m - 1, 1)),
    to: formatDateISO(new Date(year, m, 0)),
  }
}

export async function hasUserMovements(supabase: SupabaseClient): Promise<boolean> {
  const { count, error } = await supabase
    .from('transactions')
    .select('id', { count: 'exact', head: true })
    .in('type', ['income', 'expense'])
    .eq('is_parent', false)
  if (error) throw error
  return (count ?? 0) > 0
}

export async function getDashboardHero(
  supabase: SupabaseClient,
): Promise<DashboardHero> {
  const { data: accounts, error } = await supabase
    .from('accounts')
    .select(
      'id, name, type, color_key, icon_key, institution:institutions(brand_color, icon_type), currencies:account_currencies(currency_code, initial_balance)',
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
  // destination_amount/currency feed the exchange leg in calculateTransactionSums.
  const { data, error } = await supabase
    .from('transactions')
    .select('account_id, transfer_destination_account_id, currency_code, amount, type, destination_amount, destination_currency')
    .or(
      `account_id.in.(${accountIds.join(',')}),transfer_destination_account_id.in.(${accountIds.join(',')})`,
    )
    .is('status', null)

  if (error) throw error

  return calculateTransactionSums((data ?? []) as BalanceTransactionRow[], accountIds)
}

export async function getUpcomingFortnight(
  supabase: SupabaseClient,
  today: Date,
): Promise<UpcomingFortnight> {
  const todayISO = formatDateISO(today)
  const horizon = new Date(today)
  horizon.setDate(horizon.getDate() + 14)
  const horizonISO = formatDateISO(horizon)

  const { data: candidatePeriods, error: periodsErr } = await supabase
    .from('card_periods')
    .select(
      'id, account_id, end_date, due_date, account:accounts!card_periods_account_id_fkey(id, name)',
    )
    .gte('due_date', todayISO)
    .lte('due_date', horizonISO)
    .lt('end_date', todayISO)
    .order('due_date', { ascending: true })

  if (periodsErr) throw periodsErr

  const periods = (candidatePeriods ?? []) as unknown as UpcomingCardPeriodInput[]
  const periodIds = periods.map((p) => p.id)

  const [paymentsResult, txsResult, instancesResult] = await Promise.all([
    periodIds.length > 0
      ? supabase.from('period_payments').select('period_id').in('period_id', periodIds)
      : Promise.resolve({ data: [] as Array<{ period_id: string }>, error: null }),
    periodIds.length > 0
      ? supabase
          .from('transactions')
          .select('card_period_id, currency_code, amount')
          .in('card_period_id', periodIds)
          .eq('is_parent', false)
          .eq('status', 'pending')
      : Promise.resolve({ data: [] as UpcomingPeriodTxInput[], error: null }),
    supabase
      .from('recurrence_instances')
      .select(
        'id, scheduled_date, amount, currency_code, recurrence:recurrences!inner(id, movement_type, description, account:accounts!recurrences_account_id_fkey(id, name))',
      )
      .eq('status', 'pending')
      .gte('scheduled_date', todayISO)
      .lte('scheduled_date', horizonISO)
      .order('scheduled_date', { ascending: true }),
  ])

  if (paymentsResult.error) throw paymentsResult.error
  if (txsResult.error) throw txsResult.error
  if (instancesResult.error) throw instancesResult.error

  const paidIds = new Set((paymentsResult.data ?? []).map((p) => p.period_id))
  const periodTxs = (txsResult.data ?? []) as unknown as UpcomingPeriodTxInput[]
  const instances = (instancesResult.data ?? []) as unknown as UpcomingRecurrenceInstanceInput[]

  return buildUpcomingFortnight(periods, paidIds, periodTxs, instances)
}

export async function getMonthBalanceSeries(
  supabase: SupabaseClient,
  year: number,
  month: number,
): Promise<MonthBalanceSeries> {
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
  if (accIds.length === 0) return buildMonthBalanceSeries(year, month, [], [])

  const { data: txs, error: txsErr } = await supabase
    .from('transactions')
    .select(
      'id, date, type, amount, account_id, transfer_destination_account_id, created_at',
    )
    .eq('currency_code', 'ARS')
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

  return buildMonthBalanceSeries(year, month, (txs ?? []) as unknown as MonthBalanceTxInput[], accIds)
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
}

export async function getMonthCategoryBreakdown(
  supabase: SupabaseClient,
  month: string,
): Promise<MonthCategoryBreakdown> {
  const { from, to } = resolveMonthRange(month)

  const [expensesResult, reimbursementsResult] = await Promise.all([
    supabase
      .from('transactions')
      .select('category_id, currency_code, amount, is_parent, period_payments(id)')
      .eq('type', 'expense')
      // Off-ledger: credit card consumos (direct + installment children) live
      // on a card period (`card_period_id IS NOT NULL`) and don't actually
      // reduce `disponible` until the statement is paid. Keep them out of
      // "Gastado por categoría" so the donut matches what the user sees in
      // their month list (and the footer note "Sin contar consumos en tarjeta
      // sin pagar" is honest).
      //
      // TODO(spec follow-up): the correct behavior is "category + amount
      // impact when the statement is PAID, distributed by the consumos that
      // payment covered". Today statement payments are skipped via the
      // `period_payments?.length > 0` check below, which means card spending
      // never appears in the breakdown — neither when it devenga nor when
      // it's paid. The right model walks the statement payment → its
      // `card_period` → consumos in that period (parent of installment for
      // cuotas, or the consumo itself) → their category, attributing the
      // paid amount proportionally. Tracked as a separate change.
      .is('card_period_id', null)
      .gte('date', from)
      .lte('date', to),
    supabase
      .from('transactions')
      .select('amount, currency_code, linked_transaction_id, received_at, cancelled_at')
      .eq('type', 'reimbursement')
      .not('received_at', 'is', null)
      .is('cancelled_at', null)
      .gte('date', from)
      .lte('date', to),
  ])
  if (expensesResult.error) throw expensesResult.error
  if (reimbursementsResult.error) throw reimbursementsResult.error

  const expenseRows = (expensesResult.data ?? []) as unknown as Array<{
    category_id: string | null
    currency_code: string
    amount: number
    is_parent: boolean
    period_payments: { id: string }[] | null
  }>
  const reimbRows = (reimbursementsResult.data ?? []) as unknown as Array<{
    amount: number
    currency_code: string
    linked_transaction_id: string | null
    received_at: string | null
    cancelled_at: string | null
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

  const aggRows: CategoryAggRow[] = []
  for (const e of expenseRows) {
    if (e.is_parent) continue // installment parent is off-ledger; its cuotas count
    if ((e.period_payments?.length ?? 0) > 0) continue // statement payment, not category spend
    aggRows.push({
      categoryId: e.category_id ?? UNCATEGORIZED_ID,
      kind: 'expense',
      currency_code: e.currency_code,
      amount: e.amount,
    })
  }
  for (const r of reimbRows) {
    const derived = r.linked_transaction_id
      ? linkedCategoryById.get(r.linked_transaction_id)
      : null
    aggRows.push({
      categoryId: derived ?? UNCATEGORIZED_ID,
      kind: 'reimbursement',
      currency_code: r.currency_code,
      amount: r.amount,
      received_at: r.received_at,
      cancelled_at: r.cancelled_at,
    })
  }

  const netByCategory = computeCategoryNet(aggRows)

  const realIds = [...netByCategory.keys()].filter((id) => id !== UNCATEGORIZED_ID)
  const categoryById = new Map<
    string,
    { name: string; color: string | null; icon: string | null }
  >()
  if (realIds.length > 0) {
    const { data: cats } = await supabase
      .from('categories')
      .select('id, name, color, icon')
      .in('id', realIds)
    for (const c of cats ?? []) {
      categoryById.set(c.id, { name: c.name, color: c.color, icon: c.icon })
    }
  }

  const build = (currency: 'ARS' | 'USD'): CategorySliceInput[] => {
    const out: CategorySliceInput[] = []
    for (const [id, perCurrency] of netByCategory.entries()) {
      const value = perCurrency[currency].neto
      if (value <= 0) continue
      const display = id === UNCATEGORIZED_ID ? null : categoryById.get(id)
      // Uncategorized label is left empty; the UI fills it (i18n).
      out.push({
        categoryId: id,
        label: display?.name ?? '',
        color: display?.color ?? null,
        icon: display?.icon ?? null,
        value,
      })
    }
    return out
  }

  return { ARS: build('ARS'), USD: build('USD') }
}
