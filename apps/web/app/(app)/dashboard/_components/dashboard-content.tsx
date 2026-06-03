import { Suspense } from 'react'
import { getTodayAR } from '@/lib/date'
import { CategoryTeaserContainer } from './category-teaser-container'
import { CategoryTeaserSkeleton } from './category-teaser-skeleton'
import { DashboardErrorBoundary } from './dashboard-error-boundary'
import { HeroSectionContainer } from './hero-section-container'
import { HeroSkeleton } from './hero-skeleton'
import { MonthBalanceSectionContainer } from './month-balance-section-container'
import { MonthBalanceSkeleton } from './month-balance-skeleton'
import { UpcomingFortnightSectionContainer } from './upcoming-fortnight-section-container'
import { UpcomingFortnightSkeleton } from './upcoming-fortnight-skeleton'
import { WelcomeFirstMoveCardContainer } from './welcome-first-move-card-container'

const MONTHS_BACK_LIMIT = 12

export const DashboardContent = async () => {
  const today = getTodayAR()
  const currentYear = today.getFullYear()
  const currentMonth = today.getMonth() + 1

  return (
    <DashboardErrorBoundary>
      <div className="flex flex-col gap-5">
        {/* Welcome card streams in late: when present, it shifts content down.
            hasUserMovements is a cheap head-count, so the shift is usually
            imperceptible. */}
        <Suspense fallback={null}>
          <WelcomeFirstMoveCardContainer />
        </Suspense>

        <Suspense fallback={<HeroSkeleton />}>
          <HeroSectionContainer />
        </Suspense>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="lg:order-2">
            <Suspense fallback={<UpcomingFortnightSkeleton />}>
              <UpcomingFortnightSectionContainer today={today} />
            </Suspense>
          </div>

          <div className="lg:order-1">
            <Suspense fallback={<MonthBalanceSkeleton />}>
              <MonthBalanceSectionContainer
                currentYear={currentYear}
                currentMonth={currentMonth}
                monthsBackLimit={MONTHS_BACK_LIMIT}
              />
            </Suspense>
          </div>
        </div>

        <Suspense fallback={<CategoryTeaserSkeleton />}>
          <CategoryTeaserContainer today={today} />
        </Suspense>
      </div>
    </DashboardErrorBoundary>
  )
}
