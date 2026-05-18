import { createClient } from '@/lib/supabase/server'
import { getTodayAR } from '@/lib/date'
import type { Database } from '@grana/supabase'

type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row']
import {
  derivePeriodStatus,
  derivePeriodVariant,
  suggestNextPeriodDates,
  assignTransactionToPeriod,
  formatDateISO,
  sumMoneyValues,
} from './utils'
import type { CardPeriodWithPayment, PeriodVariant } from './types'

// ─── Types for card list and detail ───────────────────────────────────────────

export type CardPeriodAlert = 'red' | 'amber' | 'none'

export type CreditCardSummary = {
  id: string
  name: string
  type: 'credit'
  is_active: boolean
  credit_limit: number | null
  network_id: string | null
  other_network_name: string | null
  institution_id: string | null
  created_at: string
  currencies: Array<{ currency_code: string; is_active: boolean }>
  activePeriod: (CardPeriodWithPayment & {
    pendingAmountARS: number
    pendingAmountUSD: number
    variant: PeriodVariant
    alert: CardPeriodAlert
  }) | null
}

export type CardPeriodDetail = CardPeriodWithPayment & {
  variant: PeriodVariant
  alert: CardPeriodAlert
  pendingAmountARS: number
  pendingAmountUSD: number
  paidAmountARS: number
  paymentDate: string | null
  paymentRecordId: string | null
  paymentExpenseId: string | null
  transactions: Array<{
    id: string
    amount: number
    currency_code: string
    date: string
    status: string | null
    description: string | null
    category_id: string | null
    is_parent: boolean
    installment_n: number | null
    installments_total: number | null
    fx_rate_to_ars: number | null
    category?: { name: string } | null
    subcategory?: { name: string } | null
  }>
}

// ─── Task 3.6: R-tarjeta — debt check for archive/delete guards ───────────────

export type CreditCardDebtCheck =
  | { hasPendingDebt: false }
  | { hasPendingDebt: true; reason: 'pending_debt' }

export async function getCreditCardDebtCheck(
  accountId: string,
): Promise<CreditCardDebtCheck> {
  const supabase = await createClient()

  // Load all periods for this card with payment status and tx counts
  const { data: periods, error: periodsError } = await supabase
    .from('card_periods')
    .select('id, start_date, end_date, due_date, is_estimated, created_at, account_id')
    .eq('account_id', accountId)

  if (periodsError) throw periodsError

  if (!periods || periods.length === 0) {
    return { hasPendingDebt: false }
  }

  const periodIds = periods.map((p) => p.id)

  // Check which periods have payments
  const { data: payments, error: paymentsError } = await supabase
    .from('period_payments')
    .select('period_id')
    .in('period_id', periodIds)

  if (paymentsError) throw paymentsError

  const paidPeriodIds = new Set((payments ?? []).map((p) => p.period_id))

  // Check transaction counts per period
  const { data: txCounts, error: txError } = await supabase
    .from('transactions')
    .select('card_period_id')
    .in('card_period_id', periodIds)
    .eq('is_parent', false)

  if (txError) throw txError

  const countByPeriod = new Map<string, number>()
  for (const tx of txCounts ?? []) {
    if (tx.card_period_id) {
      countByPeriod.set(tx.card_period_id, (countByPeriod.get(tx.card_period_id) ?? 0) + 1)
    }
  }

  const today = getTodayAR()

  for (const period of periods) {
    const hasPayment = paidPeriodIds.has(period.id)
    const txCount = countByPeriod.get(period.id) ?? 0
    const status = derivePeriodStatus(period, today, hasPayment)

    // Block if a non-paid period has transactions (closed or overdue)
    if (!hasPayment && txCount > 0 && (status === 'closed' || status === 'overdue')) {
      return { hasPendingDebt: true, reason: 'pending_debt' }
    }
  }

  return { hasPendingDebt: false }
}

// ─── Load card periods with payment + tx count ────────────────────────────────

export async function getCardPeriodsWithStatus(
  accountId: string,
): Promise<CardPeriodWithPayment[]> {
  const supabase = await createClient()

  const { data: periods, error } = await supabase
    .from('card_periods')
    .select('*')
    .eq('account_id', accountId)
    .order('start_date', { ascending: true })

  if (error) throw error
  if (!periods || periods.length === 0) return []

  const periodIds = periods.map((p) => p.id)

  const [paymentsResult, txResult] = await Promise.all([
    supabase
      .from('period_payments')
      .select('period_id')
      .in('period_id', periodIds),
    supabase
      .from('transactions')
      .select('card_period_id')
      .in('card_period_id', periodIds)
      .eq('is_parent', false),
  ])

  if (paymentsResult.error) throw paymentsResult.error
  if (txResult.error) throw txResult.error

  const paidIds = new Set((paymentsResult.data ?? []).map((p) => p.period_id))
  const countByPeriod = new Map<string, number>()
  for (const tx of txResult.data ?? []) {
    if (tx.card_period_id) {
      countByPeriod.set(tx.card_period_id, (countByPeriod.get(tx.card_period_id) ?? 0) + 1)
    }
  }

  return periods.map((p) => ({
    ...p,
    has_payment: paidIds.has(p.id),
    tx_count: countByPeriod.get(p.id) ?? 0,
  }))
}

// ─── Rolling automático: find or create period covering a given date ──────────

export async function getOrCreatePeriodForDate(
  accountId: string,
  targetDate: string,
): Promise<string> {
  const supabase = await createClient()

  const periods = await getCardPeriodsWithStatus(accountId)

  // Check if an existing non-paid period covers the target date
  const existing = assignTransactionToPeriod(periods, targetDate)
  if (existing) return existing.id

  // No period covers targetDate — generate a new estimated one using rolling algorithm
  const today = getTodayAR()
  const { suggestedEndDate, suggestedDueDate } = suggestNextPeriodDates(periods, today)

  // The new period's start_date = last known end_date + 1 day
  const lastPeriod = periods[periods.length - 1]
  const newStartDate = lastPeriod
    ? addOneDayToISO(lastPeriod.end_date)
    : targetDate

  const { data: newPeriod, error } = await supabase
    .from('card_periods')
    .insert({
      account_id: accountId,
      start_date: newStartDate,
      end_date: suggestedEndDate,
      due_date: suggestedDueDate,
      is_estimated: true,
    })
    .select('id')
    .single()

  if (error) throw error
  return newPeriod.id
}

function addOneDayToISO(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  date.setDate(date.getDate() + 1)
  const yr = date.getFullYear()
  const mo = String(date.getMonth() + 1).padStart(2, '0')
  const dy = String(date.getDate()).padStart(2, '0')
  return `${yr}-${mo}-${dy}`
}

// ─── Period alert level helper ─────────────────────────────────────────────────

function derivePeriodAlert(
  period: { due_date: string },
  today: Date,
  hasPayment: boolean,
): CardPeriodAlert {
  if (hasPayment) return 'none'
  const daysUntilDue = Math.ceil(
    (new Date(period.due_date).getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
  )
  if (daysUntilDue <= 3) return 'red'
  if (daysUntilDue <= 7) return 'amber'
  return 'none'
}

// ─── Task 5.1: getCreditCards ─────────────────────────────────────────────────

export async function getCreditCards(
  options: { includeArchived?: boolean } = {},
): Promise<CreditCardSummary[]> {
  const supabase = await createClient()

  let query = supabase
    .from('accounts')
    .select('id, name, type, is_active, credit_limit, network_id, other_network_name, institution_id, created_at, currencies:account_currencies(currency_code, is_active)')
    .eq('type', 'credit')
    .order('created_at', { ascending: true })

  if (!options.includeArchived) {
    query = query.eq('is_active', true)
  }

  const { data: cards, error } = await query
  if (error) throw error
  if (!cards || cards.length === 0) return []

  const cardIds = cards.map((c) => c.id)
  const today = getTodayAR()

  // Load all periods for all cards
  const { data: allPeriods, error: periodsError } = await supabase
    .from('card_periods')
    .select('*')
    .in('account_id', cardIds)
    .order('start_date', { ascending: true })

  if (periodsError) throw periodsError

  const periodIds = (allPeriods ?? []).map((p) => p.id)

  // Parallel: payments + transaction sums per period
  const [paymentsResult, txResult] = await Promise.all([
    periodIds.length > 0
      ? supabase.from('period_payments').select('period_id').in('period_id', periodIds)
      : Promise.resolve({ data: [], error: null }),
    periodIds.length > 0
      ? supabase
          .from('transactions')
          .select('card_period_id, currency_code, amount')
          .in('card_period_id', periodIds)
          .eq('is_parent', false)
          .eq('status', 'pending')
      : Promise.resolve({ data: [], error: null }),
  ])

  if (paymentsResult.error) throw paymentsResult.error
  if (txResult.error) throw txResult.error

  const paidIds = new Set((paymentsResult.data ?? []).map((p) => p.period_id))

  // Build amount sums per period
  type AmountByPeriod = { ARS: number; USD: number }
  const amountByPeriod = new Map<string, AmountByPeriod>()
  for (const tx of txResult.data ?? []) {
    if (!tx.card_period_id) continue
    const entry = amountByPeriod.get(tx.card_period_id) ?? { ARS: 0, USD: 0 }
    if (tx.currency_code === 'ARS') entry.ARS = sumMoneyValues([entry.ARS, tx.amount])
    if (tx.currency_code === 'USD') entry.USD = sumMoneyValues([entry.USD, tx.amount])
    amountByPeriod.set(tx.card_period_id, entry)
  }

  return cards.map((card) => {
    const cardPeriods = (allPeriods ?? [])
      .filter((p) => p.account_id === card.id)
      .map((p) => ({
        ...p,
        has_payment: paidIds.has(p.id),
        tx_count: (txResult.data ?? []).filter((t) => t.card_period_id === p.id).length,
      }))

    // Active period priority:
    // 1. Overdue with debt (past due_date, unpaid, has transactions)
    // 2. Closed waiting for payment (past end_date but before due_date, has transactions)
    // 3. Current open period (today within range)
    // 4. Fallback: latest unpaid
    const todayStr = formatDateISO(today)
    const unpaidPeriods = cardPeriods.filter((p) => !p.has_payment)
    const activePeriod: CardPeriodWithPayment | null =
      unpaidPeriods.find((p) => p.due_date < todayStr && p.tx_count > 0) ??
      unpaidPeriods.find((p) => p.end_date < todayStr && p.due_date >= todayStr && p.tx_count > 0) ??
      unpaidPeriods.find((p) => p.start_date <= todayStr && todayStr <= p.end_date) ??
      unpaidPeriods.at(-1) ??
      null

    const activePeriodWithMeta = activePeriod
      ? {
          ...activePeriod,
          pendingAmountARS: amountByPeriod.get(activePeriod.id)?.ARS ?? 0,
          pendingAmountUSD: amountByPeriod.get(activePeriod.id)?.USD ?? 0,
          variant: derivePeriodVariant(activePeriod, today, activePeriod.has_payment, activePeriod.tx_count),
          alert: derivePeriodAlert(activePeriod, today, activePeriod.has_payment),
        }
      : null

    return {
      ...card,
      type: 'credit' as const,
      activePeriod: activePeriodWithMeta,
    }
  })
}

// ─── Task 5.2: getCreditCardDetail ────────────────────────────────────────────

export type CreditCardDetail = Tables<'accounts'> & {
  institution: Tables<'institutions'> | null
  currencies: Tables<'account_currencies'>[]
  periods: CardPeriodWithPayment[]
  today: Date
  debtCheck: CreditCardDebtCheck
}

export async function getCreditCardDetail(accountId: string): Promise<CreditCardDetail | null> {
  const supabase = await createClient()

  const { data: account, error } = await supabase
    .from('accounts')
    .select('*, institution:institutions(*), currencies:account_currencies(*)')
    .eq('id', accountId)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null
    throw error
  }

  const periods = await getCardPeriodsWithStatus(accountId)
  const today = getTodayAR()
  const debtCheck = await getCreditCardDebtCheck(accountId)

  return {
    ...account,
    periods,
    today,
    debtCheck,
  }
}

// ─── Task 5.3: getCardPeriods (historial) ─────────────────────────────────────

export async function getCardPeriods(accountId: string): Promise<CardPeriodDetail[]> {
  const supabase = await createClient()

  const periods = await getCardPeriodsWithStatus(accountId)
  if (periods.length === 0) return []

  const today = getTodayAR()
  const periodIds = periods.map((p) => p.id)

  // Load transactions grouped by period
  const { data: txRows, error: txError } = await supabase
    .from('transactions')
    .select('id, card_period_id, amount, currency_code, date, status, description, category_id, is_parent, installment_n, installments_total, fx_rate_to_ars')
    .in('card_period_id', periodIds)
    .eq('is_parent', false)
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })

  if (txError) throw txError

  // Load payment details
  const paidPeriodIds = periods.filter((p) => p.has_payment).map((p) => p.id)
  const { data: paymentRows, error: paymentError } = paidPeriodIds.length > 0
    ? await supabase
        .from('period_payments')
        .select('id, period_id, transaction_id, transactions!transaction_id(date)')
        .in('period_id', paidPeriodIds)
    : { data: [], error: null }

  if (paymentError) throw paymentError

  type PaymentInfo = { date: string | null; recordId: string; expenseId: string }
  const paymentByPeriod = new Map<string, PaymentInfo>()
  for (const p of paymentRows ?? []) {
    const txDate = (p.transactions as unknown as { date: string } | null)?.date ?? null
    paymentByPeriod.set(p.period_id, { date: txDate, recordId: p.id, expenseId: p.transaction_id })
  }

  return periods.reverse().map((period) => {
    const periodTxs = (txRows ?? []).filter((t) => t.card_period_id === period.id)
    const pendingARS = sumMoneyValues(
      periodTxs
        .filter((t) => t.status === 'pending' && t.currency_code === 'ARS')
        .map((t) => t.amount),
    )
    const pendingUSD = sumMoneyValues(
      periodTxs
        .filter((t) => t.status === 'pending' && t.currency_code === 'USD')
        .map((t) => t.amount),
    )
    const paidARS = sumMoneyValues(
      periodTxs
        .filter((t) => t.status === 'paid' && t.currency_code === 'ARS')
        .map((t) => t.amount),
    )
    const paymentInfo = paymentByPeriod.get(period.id)

    return {
      ...period,
      variant: derivePeriodVariant(period, today, period.has_payment, period.tx_count),
      alert: derivePeriodAlert(period, today, period.has_payment),
      pendingAmountARS: pendingARS,
      pendingAmountUSD: pendingUSD,
      paidAmountARS: paidARS,
      paymentDate: paymentInfo?.date ?? null,
      paymentRecordId: paymentInfo?.recordId ?? null,
      paymentExpenseId: paymentInfo?.expenseId ?? null,
      transactions: periodTxs,
    }
  })
}

// ─── Task 5.4: getCardPeriodDetail ────────────────────────────────────────────

export async function getCardPeriodDetail(periodId: string): Promise<CardPeriodDetail | null> {
  const supabase = await createClient()

  const { data: period, error: periodError } = await supabase
    .from('card_periods')
    .select('*')
    .eq('id', periodId)
    .single()

  if (periodError) {
    if (periodError.code === 'PGRST116') return null
    throw periodError
  }

  const [periodsWithStatus, txResult, paymentResult] = await Promise.all([
    getCardPeriodsWithStatus(period.account_id),
    supabase
      .from('transactions')
      .select('id, card_period_id, amount, currency_code, date, status, description, category_id, is_parent, installment_n, installments_total, fx_rate_to_ars, category:categories(name), subcategory:subcategories(name)')
      .eq('card_period_id', periodId)
      .eq('is_parent', false)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })
      .order('id', { ascending: false }),
    supabase
      .from('period_payments')
      .select('id, period_id, transaction_id, transactions!transaction_id(date)')
      .eq('period_id', periodId)
      .maybeSingle(),
  ])

  if (txResult.error) throw txResult.error
  if (paymentResult.error) throw paymentResult.error

  const periodWithPayment = periodsWithStatus.find((p) => p.id === periodId)
  if (!periodWithPayment) return null

  const today = getTodayAR()
  const txRows = txResult.data ?? []
  const pendingARS = sumMoneyValues(
    txRows
      .filter((t) => t.status === 'pending' && t.currency_code === 'ARS')
      .map((t) => t.amount),
  )
  const pendingUSD = sumMoneyValues(
    txRows
      .filter((t) => t.status === 'pending' && t.currency_code === 'USD')
      .map((t) => t.amount),
  )
  const paidARS = sumMoneyValues(
    txRows
      .filter((t) => t.status === 'paid' && t.currency_code === 'ARS')
      .map((t) => t.amount),
  )

  const payment = paymentResult.data
  const paymentTxDate = (payment?.transactions as unknown as { date: string } | null)?.date ?? null

  return {
    ...periodWithPayment,
    variant: derivePeriodVariant(periodWithPayment, today, periodWithPayment.has_payment, periodWithPayment.tx_count),
    alert: derivePeriodAlert(periodWithPayment, today, periodWithPayment.has_payment),
    pendingAmountARS: pendingARS,
    pendingAmountUSD: pendingUSD,
    paidAmountARS: paidARS,
    paymentDate: paymentTxDate,
    paymentRecordId: payment?.id ?? null,
    paymentExpenseId: payment?.transaction_id ?? null,
    transactions: txRows,
  }
}

// ─── Task 5.5: getCardPeriodTransactionCount ──────────────────────────────────

export async function getCardPeriodTransactionCount(periodId: string): Promise<number> {
  const supabase = await createClient()

  const { count, error } = await supabase
    .from('transactions')
    .select('id', { count: 'exact', head: true })
    .eq('card_period_id', periodId)
    .eq('is_parent', false)

  if (error) throw error
  return count ?? 0
}

// ─── Task 5.6: getCardNetworks ────────────────────────────────────────────────

export type CardNetwork = Pick<Tables<'card_networks'>, 'id' | 'slug' | 'name' | 'brand_color' | 'display_order'>

export async function getCardNetworks(): Promise<CardNetwork[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('card_networks')
    .select('id, slug, name, brand_color, display_order')
    .eq('is_active', true)
    .order('display_order', { ascending: true })

  if (error) throw error
  return data ?? []
}
