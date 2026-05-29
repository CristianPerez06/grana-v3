import { getTranslations } from 'next-intl/server'
import { getMonthBalanceSeries, type MonthBalanceSeries } from '@grana/dashboard'
import { createClient } from '@/lib/supabase/server'
import { MonthBalanceSection } from './month-balance-section'
import { SectionFallback } from './section-fallback'

type Props = {
  currentYear: number
  currentMonth: number
  monthsBackLimit: number
}

export const MonthBalanceSectionContainer = async ({
  currentYear,
  currentMonth,
  monthsBackLimit,
}: Props) => {
  const supabase = await createClient()
  let data: MonthBalanceSeries
  try {
    data = await getMonthBalanceSeries(supabase, currentYear, currentMonth)
  } catch {
    const t = await getTranslations('dashboard.month')
    return <SectionFallback message={t('error')} />
  }
  return (
    <MonthBalanceSection
      initialData={data}
      currentYear={currentYear}
      currentMonth={currentMonth}
      monthsBackLimit={monthsBackLimit}
    />
  )
}
