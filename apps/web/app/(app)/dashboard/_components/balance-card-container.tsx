import { getTranslations } from 'next-intl/server'
import {
  getDashboardHero,
  getMonthBalanceSeries,
  type DashboardHero,
  type MonthBalanceByCurrency,
} from '@grana/dashboard'
import { createClient } from '@/lib/supabase/server'
import { BalanceCard } from './balance-card'

type Props = {
  currentYear: number
  currentMonth: number
}

// Row 1 of the dashboard: the balance card, full width.
//
// Two reads feed one card: the hero (today's balance and the per-account
// breakdown, month-independent) and the month series ("Resumen del mes", which
// follows the month selector). They resolve together behind a single Suspense
// so the card does not assemble in jumps in front of the user.
//
// The month read failing does not take the card down: the balance and "Dónde
// está" still render, and the summary zone shows its own empty state.
export const BalanceCardContainer = async ({ currentYear, currentMonth }: Props) => {
  const supabase = await createClient()

  let hero: DashboardHero
  try {
    hero = await getDashboardHero(supabase)
  } catch {
    const t = await getTranslations('dashboard')
    return (
      <div className="flex min-h-[13rem] items-center justify-center rounded-2xl border border-dashed border-border bg-card p-6 text-center text-sm text-text-muted shadow-sm">
        {t('hero_error')}
      </div>
    )
  }

  let month: MonthBalanceByCurrency | null = null
  try {
    month = await getMonthBalanceSeries(supabase, currentYear, currentMonth)
  } catch {
    month = null
  }

  return <BalanceCard data={hero} monthInitialData={month} />
}
