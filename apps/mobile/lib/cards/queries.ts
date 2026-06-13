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
  /** Institution branding + name for the card accent and bank grouping. */
  institution: { name: string | null; brand_color: string | null; icon_type: string | null } | null
  color_key: string | null
  icon_key: string | null
  created_at: string
  currencies: Array<{ currency_code: string; is_active: boolean }>
  /**
   * Whether the card is "in use" this cycle. Mobile derives it from the active
   * period's pending charges (its `tx_count` already includes installment
   * children that fall in it); no separate installment-parent query yet.
   */
  inUse: boolean
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
      inUse: (activePeriodWithMeta?.tx_count ?? 0) > 0,
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
  /**
   * Upcoming statement CLOSES (cierres) among open periods (`end_date >= today`),
   * one row per card, sorted by close date ascending, capped at the next 3.
   * These are CLOSE dates, NOT payment due dates.
   */
  nextCloses: { endDate: string; cardName: string }[]
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

  // Próximos cierres: open statements about to close (end_date in the future),
  // one row per card, by close date ascending, next 3.
  const nextCloses = upcoming
    .filter((u) => u.endDate >= todayStr)
    .sort((a, b) => a.endDate.localeCompare(b.endDate) || a.cardName.localeCompare(b.cardName))
    .slice(0, 3)
    .map((u) => ({ endDate: u.endDate, cardName: u.cardName }))

  return {
    toPayARS,
    toPayUSD,
    hasUSD,
    hasToPay,
    nextDue: upcoming[0] ?? null,
    upcoming,
    nextCloses,
  }
}

// ─── Card networks catalog ────────────────────────────────────────────────────
// Mirror of apps/web/lib/cards/queries.ts → getCardNetworks. Used to resolve a
// card's network display name for the compact list's monogram + meta line.

export type CardNetwork = {
  id: string
  slug: string
  name: string
  brand_color: string | null
  display_order: number | null
}

export async function getCardNetworks(): Promise<CardNetwork[]> {
  const { data, error } = await supabase
    .from('card_networks')
    .select('id, slug, name, brand_color, display_order')
    .eq('is_active', true)
    .order('display_order', { ascending: true })

  if (error) throw error
  return data ?? []
}
