import { getTranslations } from 'next-intl/server'
import type { MonthCategoryBreakdown } from '@grana/dashboard'
import { monthOf } from '@/lib/transactions/filters'
import { getMonthCategoryBreakdown } from '@/lib/transactions/queries'
import { SpendingSection } from './spending-section'

type Props = {
  today: Date
}

// Server-renders the current month's breakdown; the section then follows the
// header's shared month selection client-side (labels translate client-side
// so server and refetched months speak the same language).
export const SpendingSectionContainer = async ({ today }: Props) => {
  let breakdown: MonthCategoryBreakdown
  try {
    breakdown = await getMonthCategoryBreakdown(monthOf(today))
  } catch {
    const t = await getTranslations('dashboard.spending')
    return (
      <div className="flex h-full min-h-[12rem] items-center justify-center rounded-2xl border border-dashed border-border bg-card p-6 text-center text-sm text-text-muted shadow-sm">
        {t('error')}
      </div>
    )
  }
  return <SpendingSection initialData={breakdown} />
}
