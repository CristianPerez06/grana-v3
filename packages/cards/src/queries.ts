import type { GranaSupabaseClient } from '@grana/supabase'
import {
  derivePeriodStatus,
  derivePeriodVariant,
  formatDateISO,
  sumMoneyValues,
  subtractMoneyValues,
} from '@grana/money-logic'
import type { CardPeriodWithPayment } from '@grana/transactions-mutations'
import type { CardPeriodAlert, CreditCardSummary, CreditCardDebtCheck } from './types'

// ─── Period alert level helper ─────────────────────────────────────────────────
// Exported because the cards read slice (`getCreditCards`) and the web-retained
// period reads (`getCardPeriods`, `getCardPeriodDetail`) both derive it.

export function derivePeriodAlert(
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

// ─── Debt check for archive/delete guards ─────────────────────────────────────

export async function getCreditCardDebtCheck(
  supabase: GranaSupabaseClient,
  accountId: string,
  today: Date,
): Promise<CreditCardDebtCheck> {
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

// ─── getCreditCards ───────────────────────────────────────────────────────────

export async function getCreditCards(
  supabase: GranaSupabaseClient,
  options: { today: Date; includeArchived?: boolean; archivedOnly?: boolean },
): Promise<CreditCardSummary[]> {
  const { today } = options
  let query = supabase
    .from('accounts')
    .select('id, name, type, is_active, credit_limit, network_id, other_network_name, institution_id, color_key, icon_key, created_at, institution:institutions(name, brand_color, icon_type), currencies:account_currencies(currency_code, is_active)')
    .eq('type', 'credit')
    .order('created_at', { ascending: true })

  if (options.archivedOnly) {
    query = query.eq('is_active', false)
  } else if (!options.includeArchived) {
    query = query.eq('is_active', true)
  }

  const { data: cards, error } = await query
  if (error) throw error
  if (!cards || cards.length === 0) return []

  const cardIds = cards.map((c) => c.id)

  // Load all periods for all cards + active installment children (per card).
  // An "active installment purchase" = a parent (is_parent=true) with at least
  // one pending child. Children carry account_id=card and parent_id=parent.
  const [periodsResult, installmentChildrenResult] = await Promise.all([
    supabase
      .from('card_periods')
      .select('*')
      .in('account_id', cardIds)
      .order('start_date', { ascending: true }),
    supabase
      .from('transactions')
      .select('account_id, parent_id')
      .in('account_id', cardIds)
      .eq('is_parent', false)
      .eq('status', 'pending')
      .not('parent_id', 'is', null),
  ])

  const { data: allPeriods, error: periodsError } = periodsResult
  if (periodsError) throw periodsError
  if (installmentChildrenResult.error) throw installmentChildrenResult.error

  // Distinct parents with pending children, grouped by card.
  const installmentParentsByCard = new Map<string, Set<string>>()
  for (const child of installmentChildrenResult.data ?? []) {
    if (!child.account_id || !child.parent_id) continue
    const set = installmentParentsByCard.get(child.account_id) ?? new Set<string>()
    set.add(child.parent_id)
    installmentParentsByCard.set(child.account_id, set)
  }

  const periodIds = (allPeriods ?? []).map((p) => p.id)

  // Parallel: payments + pending charges + received reimbursements per period
  const [paymentsResult, txResult, reimbResult] = await Promise.all([
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
    periodIds.length > 0
      ? supabase
          .from('transactions')
          .select('card_period_id, currency_code, amount')
          .in('card_period_id', periodIds)
          .eq('type', 'reimbursement')
          .not('received_at', 'is', null)
          .is('cancelled_at', null)
      : Promise.resolve({ data: [], error: null }),
  ])

  if (paymentsResult.error) throw paymentsResult.error
  if (txResult.error) throw txResult.error
  if (reimbResult.error) throw reimbResult.error

  const paidIds = new Set((paymentsResult.data ?? []).map((p) => p.period_id))

  // Build amount sums per period: pending charges minus received reimbursements.
  type AmountByPeriod = { ARS: number; USD: number }
  const amountByPeriod = new Map<string, AmountByPeriod>()
  for (const tx of txResult.data ?? []) {
    if (!tx.card_period_id) continue
    const entry = amountByPeriod.get(tx.card_period_id) ?? { ARS: 0, USD: 0 }
    if (tx.currency_code === 'ARS') entry.ARS = sumMoneyValues([entry.ARS, tx.amount])
    if (tx.currency_code === 'USD') entry.USD = sumMoneyValues([entry.USD, tx.amount])
    amountByPeriod.set(tx.card_period_id, entry)
  }
  for (const r of reimbResult.data ?? []) {
    if (!r.card_period_id) continue
    const entry = amountByPeriod.get(r.card_period_id) ?? { ARS: 0, USD: 0 }
    if (r.currency_code === 'ARS') entry.ARS = subtractMoneyValues(entry.ARS, r.amount)
    if (r.currency_code === 'USD') entry.USD = subtractMoneyValues(entry.USD, r.amount)
    amountByPeriod.set(r.card_period_id, entry)
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

    const activeInstallmentsCount = installmentParentsByCard.get(card.id)?.size ?? 0

    // The OPEN statement (today within range, unpaid) — independent of which
    // period is "active". A card with a closed-unpaid statement has BOTH: the
    // one "a pagar" (its activePeriod) and this open one still accruing.
    const inProgressPeriod = unpaidPeriods.find(
      (p) => p.start_date <= todayStr && todayStr <= p.end_date,
    )
    const inProgress = inProgressPeriod
      ? {
          endDate: inProgressPeriod.end_date,
          amountARS: amountByPeriod.get(inProgressPeriod.id)?.ARS ?? 0,
          amountUSD: amountByPeriod.get(inProgressPeriod.id)?.USD ?? 0,
        }
      : null

    return {
      ...card,
      type: 'credit' as const,
      activeInstallmentsCount,
      inUse: (activePeriodWithMeta?.tx_count ?? 0) > 0 || activeInstallmentsCount > 0,
      activePeriod: activePeriodWithMeta,
      inProgress,
    }
  })
}
