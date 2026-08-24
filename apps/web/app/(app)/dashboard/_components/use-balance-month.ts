'use client'

import { useQuery } from '@tanstack/react-query'
import {
  deriveBalanceCardView,
  deriveMonthSummary,
  getAvailableTotals,
  getDashboardHero,
  getMonthBalanceSeries,
  getReservedFlow,
  resolveMonthRange,
  type DashboardHero,
  type MonthBalanceByCurrency,
} from '@grana/dashboard'
import { createClient } from '@/lib/supabase/client'
import { useDashboardMonth, type DashboardMonth } from './dashboard-month-context'

/**
 * The balance card's data for the SELECTED month.
 *
 * The balance is cut at the month's last day (today for the current month), so
 * navigating months moves it with the rest of the card. `get_account_balance_sums`
 * already took that cut as a parameter, so nothing changed in SQL.
 *
 * "Venía" is derived, not read: `cierre − (entró − se fue − guardado)`. One less
 * round-trip, and the amounts add up to the number above them by construction.
 *
 * The saved figures are fetched ONLY for the current month, and that is the same
 * rule the label already follows: the reserve is netted exactly where the card
 * says "disponible". At the close of a past month the question does not apply —
 * the money was either spent or it was not, and a reserve is a stance about the
 * future. Netting it there would also rewrite history on every save: look at May
 * on Monday and it says one number, save on Tuesday and May says another,
 * without anything having happened in May.
 */

/** Last day of the month, or today when that month is the current one. */
export const balanceCutISO = (selected: DashboardMonth, current: DashboardMonth, today: string) => {
  const isCurrentOrLater =
    selected.year > current.year ||
    (selected.year === current.year && selected.month >= current.month)
  if (isCurrentOrLater) return today

  const lastDay = new Date(selected.year, selected.month, 0).getDate()
  return `${selected.year}-${String(selected.month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
}

type Args = {
  todayISO: string
  heroInitial: DashboardHero | null
  monthInitial: MonthBalanceByCurrency | null
}

export const useBalanceMonth = ({ todayISO, heroInitial, monthInitial }: Args) => {
  const { selected, current, isCurrent } = useDashboardMonth()
  const cutISO = balanceCutISO(selected, current, todayISO)

  const heroQuery = useQuery({
    queryKey: ['dashboard', 'hero', cutISO],
    queryFn: () => getDashboardHero(createClient(), cutISO),
    initialData: isCurrent ? (heroInitial ?? undefined) : undefined,
    staleTime: 60_000,
  })

  const monthQuery = useQuery({
    queryKey: ['dashboard', 'balance-series', selected.year, selected.month],
    queryFn: () => getMonthBalanceSeries(createClient(), selected.year, selected.month),
    initialData:
      monthInitial != null &&
      monthInitial.year === selected.year &&
      monthInitial.month === selected.month
        ? monthInitial
        : undefined,
    staleTime: 60_000,
  })

  // The real disponible: accounts minus what is set aside, per currency. It comes
  // from `get_available_sums` already subtracted — the card never recomposes it
  // from the account total it happens to be holding.
  const availableQuery = useQuery({
    queryKey: ['dashboard', 'available', cutISO],
    queryFn: () => getAvailableTotals(createClient(), cutISO),
    enabled: isCurrent,
    staleTime: 60_000,
  })

  const monthKey = `${selected.year}-${String(selected.month).padStart(2, '0')}`
  const flowQuery = useQuery({
    queryKey: ['dashboard', 'reserved-flow', monthKey],
    queryFn: () => {
      const { from, to } = resolveMonthRange(monthKey)
      return getReservedFlow(createClient(), from, to, todayISO)
    },
    enabled: isCurrent,
    staleTime: 60_000,
  })

  const hero = heroQuery.data ?? null
  const summary = monthQuery.data ? deriveMonthSummary(monthQuery.data) : null

  // What the card shows is decided ONCE, in `@grana/dashboard`, and native
  // consumes the same function: which number the dark zone renders, which state
  // the savings row is in, and what "Tenías" derives from are three rules that
  // have to agree across platforms.
  const { displayed, savings, venia } = deriveBalanceCardView({
    isCurrent,
    accounts: hero ? { ARS: hero.ars, USD: hero.usd } : null,
    available: isCurrent ? (availableQuery.data ?? null) : null,
    reservedNet: flowQuery.data ?? { ARS: 0, USD: 0 },
    summary,
  })

  return { hero, summary, isCurrent, selected, displayed, savings, venia }
}
