import { getTranslations } from 'next-intl/server'
import { getDashboardHero, type DashboardHero } from '@grana/dashboard'
import { createClient } from '@/lib/supabase/server'
import { HeroSection } from './hero-section'

export const HeroSectionContainer = async () => {
  const supabase = await createClient()
  let data: DashboardHero
  try {
    data = await getDashboardHero(supabase)
  } catch {
    const t = await getTranslations('dashboard')
    return (
      <div className="flex h-full min-h-[10rem] items-center justify-center rounded-2xl border border-dashed border-border bg-card p-6 text-center text-sm text-text-muted shadow-sm">
        {t('hero_error')}
      </div>
    )
  }
  return <HeroSection data={data} />
}
