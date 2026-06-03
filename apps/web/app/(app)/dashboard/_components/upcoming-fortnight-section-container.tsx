import { getTranslations } from 'next-intl/server'
import { getUpcomingFortnight, type UpcomingFortnight } from '@grana/dashboard'
import { createClient } from '@/lib/supabase/server'
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
    return (
      <div className="flex h-full min-h-[20rem] items-center justify-center rounded-2xl border border-dashed border-border bg-card p-6 text-center text-sm text-text-muted shadow-sm">
        {t('error')}
      </div>
    )
  }
  return <UpcomingFortnightSection data={data} />
}
