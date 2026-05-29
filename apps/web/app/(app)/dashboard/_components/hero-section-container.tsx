import { getTranslations } from 'next-intl/server'
import { getDashboardHero, type DashboardHero } from '@grana/dashboard'
import { createClient } from '@/lib/supabase/server'
import { HeroSection } from './hero-section'
import { SectionFallback } from './section-fallback'

export const HeroSectionContainer = async () => {
  const supabase = await createClient()
  let data: DashboardHero
  try {
    data = await getDashboardHero(supabase)
  } catch {
    const t = await getTranslations('dashboard')
    return <SectionFallback message={t('hero_error')} />
  }
  return <HeroSection data={data} />
}
