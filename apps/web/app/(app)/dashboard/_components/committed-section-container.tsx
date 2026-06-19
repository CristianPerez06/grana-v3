import { getTranslations } from 'next-intl/server'
import { getCommittedOutlook, type CommittedOutlook } from '@grana/dashboard'
import { createClient } from '@/lib/supabase/server'
import { CommittedSection } from './committed-section'

// "Lo que se viene" — static (from today), so it is fully server-rendered once
// and does NOT follow the month navigator. Sits next to "Balance del mes".
export const CommittedSectionContainer = async () => {
  const supabase = await createClient()
  let data: CommittedOutlook
  try {
    data = await getCommittedOutlook(supabase)
  } catch {
    const t = await getTranslations('dashboard.committed')
    return (
      <div className="flex h-full min-h-[15rem] items-center justify-center rounded-2xl border border-dashed border-border bg-card p-6 text-center text-sm text-text-muted shadow-sm">
        {t('error')}
      </div>
    )
  }
  return <CommittedSection data={data} />
}
