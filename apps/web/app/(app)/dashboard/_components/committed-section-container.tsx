import { getFormatter, getTranslations } from 'next-intl/server'
import { getCommittedOutlook, type CommittedOutlook } from '@grana/dashboard'
import { createClient } from '@/lib/supabase/server'
import { CommittedSection } from './committed-section'

// "Compromisos del próximo mes" — the window is the NEXT CALENDAR MONTH, fixed
// relative to today, so it is fully server-rendered once and does NOT follow the
// month navigator. Sits next to "Cuánto gastaste".
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
  // The commitments are next month's, so the subtitle names that month.
  const format = await getFormatter()
  const today = new Date()
  const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1)
  const monthLabel = format.dateTime(nextMonth, { month: 'long', year: 'numeric' })

  return <CommittedSection data={data} monthLabel={monthLabel} />
}
