import { getTranslations } from 'next-intl/server'
import { getDashboardHero, type DashboardHero } from '@grana/dashboard'
import { createClient } from '@/lib/supabase/server'
import { BalanceCard } from './balance-card'

// Row 1 of the dashboard: the balance card, full width. One getDashboardHero
// call feeds the total and the "Dónde está" breakdown folded into it.
export const BalanceCardContainer = async () => {
  const supabase = await createClient()
  let data: DashboardHero
  try {
    data = await getDashboardHero(supabase)
  } catch {
    const t = await getTranslations('dashboard')
    return (
      <div className="flex min-h-[13rem] items-center justify-center rounded-2xl border border-dashed border-border bg-card p-6 text-center text-sm text-text-muted shadow-sm">
        {t('hero_error')}
      </div>
    )
  }
  return <BalanceCard data={data} />
}
