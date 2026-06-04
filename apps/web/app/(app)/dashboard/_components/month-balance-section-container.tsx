import { getTranslations } from 'next-intl/server'
import { getMonthBalanceSeries, type MonthBalanceByCurrency } from '@grana/dashboard'
import { createClient } from '@/lib/supabase/server'
import { MonthBalanceSection } from './month-balance-section'

type Props = {
  currentYear: number
  currentMonth: number
}

// Server-renders the current month; the section then follows the header's
// shared month selection client-side.
export const MonthBalanceSectionContainer = async ({ currentYear, currentMonth }: Props) => {
  const supabase = await createClient()
  let data: MonthBalanceByCurrency
  try {
    data = await getMonthBalanceSeries(supabase, currentYear, currentMonth)
  } catch {
    const t = await getTranslations('dashboard.month')
    return (
      <div className="flex h-full min-h-[15rem] items-center justify-center rounded-2xl border border-dashed border-border bg-card p-6 text-center text-sm text-text-muted shadow-sm">
        {t('error')}
      </div>
    )
  }
  return <MonthBalanceSection initialData={data} />
}
