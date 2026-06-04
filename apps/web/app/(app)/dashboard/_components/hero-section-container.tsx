import { getTranslations } from 'next-intl/server'
import { getDashboardHero, type DashboardHero } from '@grana/dashboard'
import { createClient } from '@/lib/supabase/server'
import { AccountsCard } from './accounts-card'
import { HeroSection } from './hero-section'

// Top row of the dashboard: "Para gastar · hoy" + "Dónde está". One container,
// one getDashboardHero call — both cards render off the same payload.
export const HeroSectionContainer = async () => {
  const supabase = await createClient()
  let data: DashboardHero
  try {
    data = await getDashboardHero(supabase)
  } catch {
    const t = await getTranslations('dashboard')
    return (
      <div className="flex h-full min-h-[13rem] items-center justify-center rounded-2xl border border-dashed border-border bg-card p-6 text-center text-sm text-text-muted shadow-sm">
        {t('hero_error')}
      </div>
    )
  }
  return (
    <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-[1.15fr_1fr]">
      <HeroSection data={data} />
      <AccountsCard data={data} />
    </div>
  )
}
