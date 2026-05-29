import { getTranslations } from 'next-intl/server'
import { getUpcomingFortnight, type UpcomingFortnight } from '@grana/dashboard'
import { createClient } from '@/lib/supabase/server'
import { SectionFallback } from './section-fallback'
import { UpcomingFortnightSection } from './upcoming-fortnight-section'

type Props = {
  today: Date
}

export const UpcomingFortnightSectionContainer = async ({ today }: Props) => {
  const supabase = await createClient()
  let data: UpcomingFortnight
  try {
    data = await getUpcomingFortnight(supabase, today)
  } catch {
    const t = await getTranslations('dashboard.upcoming')
    return <SectionFallback message={t('error')} />
  }
  return <UpcomingFortnightSection data={data} />
}
