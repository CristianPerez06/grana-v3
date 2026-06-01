// getCreditCards for mobile. Supabase-coupled query glue stays per-app by repo
// policy ("Supabase queries stay in each app's lib/"), same as the canonical
// mirror apps/web/lib/cards/queries.ts — only getCreditCards is ported so far.
// The pure period/money calculations come from @grana/money-logic via ./utils.
// Keep the public shape in sync with web until a shared query layer exists.

import { supabase } from '../supabase'
import { getTodayAR } from '../date'
import { derivePeriodVariant, formatDateISO, sumMoneyValues } from './utils'
import type { CardPeriodWithPayment, PeriodVariant } from './types'

// Mirror of apps/web/lib/cards/queries.ts. Public shape (CreditCardSummary,
// CardsMonthSummary, UpcomingDue) MUST stay in sync across platforms.

// ─── Types ────────────────────────────────────────────────────────────────────

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

// ─── getCreditCards ──────────────────────────────────────────────────────────

export async function getCreditCards(
  options: { includeArchived?: boolean; archivedOnly?: boolean } = {},
): Promise<CreditCardSummary[]> {
  let query = supabase
    .from('accounts')
    .select('id, name, type, is_active, credit_limit, network_id, other_network_name, institution_id, created_at, currencies:account_currencies(currency_code, is_active)')
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

// ─── Listing-level aggregate: "A pagar este mes" + próximos vencimientos ──────
// Mirror of apps/web/lib/cards/queries.ts → getCardsMonthSummary. Keep shapes in
// sync (UpcomingDue, CardsMonthSummary) so both platforms render the same data.

export type UpcomingDue = {
  cardId: string
  cardName: string
  endDate: string
  dueDate: string
  amountARS: number
  amountUSD: number
  alert: CardPeriodAlert
  isToPay: boolean
}

export type CardsMonthSummary = {
  toPayARS: number
  toPayUSD: number
  hasUSD: boolean
  hasToPay: boolean
  nextDue: UpcomingDue | null
  upcoming: UpcomingDue[]
}

export async function getCardsMonthSummary(): Promise<CardsMonthSummary> {
  const cards = await getCreditCards({ includeArchived: false })
  const today = getTodayAR()
  const todayStr = formatDateISO(today)

  const upcoming: UpcomingDue[] = []
  let toPayARS = 0
  let toPayUSD = 0
  let hasUSD = false
  let hasToPay = false

  for (const card of cards) {
    if (card.currencies.some((c) => c.currency_code === 'USD' && c.is_active)) {
      hasUSD = true
    }
    const period = card.activePeriod
    if (!period || period.has_payment) continue

    const isToPay =
      (period.end_date < todayStr || period.due_date < todayStr) && period.tx_count > 0

    if (isToPay) {
      hasToPay = true
      toPayARS = sumMoneyValues([toPayARS, period.pendingAmountARS])
      toPayUSD = sumMoneyValues([toPayUSD, period.pendingAmountUSD])
    }

    upcoming.push({
      cardId: card.id,
      cardName: card.name,
      endDate: period.end_date,
      dueDate: period.due_date,
      amountARS: period.pendingAmountARS,
      amountUSD: period.pendingAmountUSD,
      alert: period.alert,
      isToPay,
    })
  }

  upcoming.sort((a, b) => a.dueDate.localeCompare(b.dueDate))

  return {
    toPayARS,
    toPayUSD,
    hasUSD,
    hasToPay,
    nextDue: upcoming[0] ?? null,
    upcoming,
  }
}
