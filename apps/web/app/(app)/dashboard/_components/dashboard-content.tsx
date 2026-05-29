import { Suspense } from 'react'
import { getTranslations } from 'next-intl/server'
import { getTodayAR } from '@/lib/date'
import { CategoryTeaserContainer } from './category-teaser-container'
import { DashboardErrorBoundary } from './dashboard-error-boundary'
import { HeroSectionContainer } from './hero-section-container'
import { MonthBalanceSectionContainer } from './month-balance-section-container'
import { SectionFallback } from './section-fallback'
import { UpcomingFortnightSectionContainer } from './upcoming-fortnight-section-container'
import { WelcomeFirstMoveCardContainer } from './welcome-first-move-card-container'

const MONTHS_BACK_LIMIT = 12

export const DashboardContent = async () => {
  const today = getTodayAR()
  const currentYear = today.getFullYear()
  const currentMonth = today.getMonth() + 1
  const t = await getTranslations('dashboard')

  return (
    <DashboardErrorBoundary>
      <div className="flex flex-col gap-5">
        {/* Welcome card streams in late: when present, it shifts content down.
            hasUserMovements is a cheap head-count, so the shift is usually
            imperceptible. */}
        <Suspense fallback={null}>
          <WelcomeFirstMoveCardContainer />
        </Suspense>

        <Suspense
          fallback={
            <SectionFallback message={t('hero_loading')} className="min-h-[10rem]" />
          }
        >
          <HeroSectionContainer />
        </Suspense>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="lg:order-2">
            <Suspense
              fallback={
                <SectionFallback
                  message={t('upcoming.loading')}
                  className="min-h-[20rem]"
                />
              }
            >
              <UpcomingFortnightSectionContainer today={today} />
            </Suspense>
          </div>

          <div className="lg:order-1">
            <Suspense
              fallback={
                <SectionFallback
                  message={t('month.loading')}
                  className="min-h-[26rem]"
                />
              }
            >
              <MonthBalanceSectionContainer
                currentYear={currentYear}
                currentMonth={currentMonth}
                monthsBackLimit={MONTHS_BACK_LIMIT}
              />
            </Suspense>
          </div>
        </div>

        <Suspense
          fallback={
            <SectionFallback message={t('spending.loading')} className="min-h-[8rem]" />
          }
        >
          <CategoryTeaserContainer today={today} />
        </Suspense>
      </div>
    </DashboardErrorBoundary>
  )
}
