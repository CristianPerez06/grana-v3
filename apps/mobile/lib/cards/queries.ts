// TODO(@grana/cards): duplicación temporal de apps/web/lib/cards/queries.ts
// (solo getCreditCards y sus tipos asociados — los demás queries del módulo
// cards web no se necesitan todavía en mobile). Cuando cards se prometa a un
// package compartido, esta copia se borra y se importa desde ahí. Mantener
// firma pública sincronizada con el archivo web hasta entonces.

import { supabase } from '../supabase'
import { getTodayAR } from '../date'
import { derivePeriodVariant, formatDateISO, sumMoneyValues } from './utils'
import type { CardPeriodWithPayment, PeriodVariant } from './types'

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
  options: { includeArchived?: boolean } = {},
): Promise<CreditCardSummary[]> {
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
