'use client'

import { useQuery } from '@tanstack/react-query'
import {
  deriveMonthOpening,
  deriveMonthSummary,
  getDashboardHero,
  getMonthBalanceSeries,
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
 * "Venía" is derived, not read: `saldo − (entró − se fue)`. One less round-trip,
 * and the three amounts add up to the balance above them by construction.
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

  const hero = heroQuery.data ?? null
  const summary = monthQuery.data ? deriveMonthSummary(monthQuery.data) : null

  return {
    hero,
    summary,
    isCurrent,
    selected,
    /**
     * Verdadero mientras alguna de las dos lecturas del mes seleccionado no
     * resolvió. El mes actual llega server-rendered como `initialData`, así que
     * esto sólo se enciende al navegar a un mes sin cachear — donde la card
     * caía a `?? 0` y mostraba ceros que no eran el saldo de nadie.
     */
    isLoading: heroQuery.isPending || monthQuery.isPending,
    venia:
      hero && summary
        ? {
            ARS: deriveMonthOpening(hero.ars, summary.ARS),
            USD: deriveMonthOpening(hero.usd, summary.USD),
          }
        : null,
  }
}
