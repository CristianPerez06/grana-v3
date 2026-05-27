import type { SupabaseClient } from '@supabase/supabase-js'
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
