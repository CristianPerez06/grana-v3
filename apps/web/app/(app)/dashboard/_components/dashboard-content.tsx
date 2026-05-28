import { Suspense } from 'react'
import { getTranslations } from 'next-intl/server'
import {
  getDashboardHero,
  getMonthBalanceSeries,
  getUpcomingFortnight,
  hasUserMovements,
} from '@grana/dashboard'
import { buildCategorySlices } from '@grana/money-logic'
import { createClient } from '@/lib/supabase/server'
import { getTodayAR } from '@/lib/date'
import { getMonthCategoryBreakdown, UNCATEGORIZED_ID } from '@/lib/transactions/queries'
import { monthOf } from '@/lib/transactions/filters'
import { RouteLoading } from '@/components/ui/route-loading'
import { CategoryTeaser } from './category-teaser'
import { DashboardErrorBoundary } from './dashboard-error-boundary'
import { HeroSection } from './hero-section'
import { MonthBalanceSection } from './month-balance-section'
import { SectionFallback } from './section-fallback'
import { UpcomingFortnightSection } from './upcoming-fortnight-section'
import { WelcomeFirstMoveCard } from './welcome-first-move-card'

const MONTHS_BACK_LIMIT = 12

const DashboardContentBody = async () => {
  const today = getTodayAR()
  const currentYear = today.getFullYear()
  const currentMonth = today.getMonth() + 1

  const t = await getTranslations('dashboard')
  const supabase = await createClient()

  const [heroResult, upcomingResult, monthResult, hasMovementsResult] =
    await Promise.allSettled([
      getDashboardHero(supabase),
      getUpcomingFortnight(supabase, today),
      getMonthBalanceSeries(supabase, currentYear, currentMonth),
      hasUserMovements(supabase),
    ])

  const showWelcomeCard =
    hasMovementsResult.status === 'fulfilled' && hasMovementsResult.value === false

  const monthStr = monthOf(today)
  const breakdown = await getMonthCategoryBreakdown(monthStr)
  const tTx = await getTranslations('transactions')
  const teaserSlices = buildCategorySlices(
    breakdown.ARS.map((i) =>
      i.categoryId === UNCATEGORIZED_ID ? { ...i, label: tTx('spending.uncategorized') } : i,
    ),
    { topN: 3, othersLabel: tTx('spending.others') },
  ).slices.slice(0, 3)

  return (
    <div className="flex flex-col gap-5">
      {showWelcomeCard && <WelcomeFirstMoveCard />}

      {heroResult.status === 'fulfilled' ? (
        <HeroSection data={heroResult.value} />
      ) : (
        <SectionFallback message={t('hero_error')} />
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="lg:order-2">
          {upcomingResult.status === 'fulfilled' ? (
            <UpcomingFortnightSection data={upcomingResult.value} />
          ) : (
            <SectionFallback message={t('upcoming.error')} />
          )}
        </div>

        <div className="lg:order-1">
          {monthResult.status === 'fulfilled' ? (
            <MonthBalanceSection
              initialData={monthResult.value}
              currentYear={currentYear}
              currentMonth={currentMonth}
              monthsBackLimit={MONTHS_BACK_LIMIT}
            />
          ) : (
            <SectionFallback message={t('month.error')} />
          )}
        </div>
      </div>

      <CategoryTeaser
        title={t('spending.title')}
        viewAllLabel={t('spending.view_all')}
        href="/transactions"
        slices={teaserSlices}
      />
    </div>
  )
}

export const DashboardContent = () => (
  <DashboardErrorBoundary>
    <Suspense fallback={<RouteLoading />}>
      <DashboardContentBody />
    </Suspense>
  </DashboardErrorBoundary>
)
