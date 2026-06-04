import { Suspense } from 'react'
import { getTodayAR } from '@/lib/date'
import { DashboardErrorBoundary } from './dashboard-error-boundary'
import { HeroSectionContainer } from './hero-section-container'
import { HeroSkeleton } from './hero-skeleton'
import { MonthBalanceSectionContainer } from './month-balance-section-container'
import { MonthBalanceSkeleton } from './month-balance-skeleton'
import { SpendingSectionContainer } from './spending-section-container'
import { SpendingSkeleton } from './spending-skeleton'

// Dashboard composition (design handoff order): top row ("Para gastar · hoy" +
// "Dónde está") → "Balance del mes" → "En qué se fue". Each section streams
// behind its own Suspense with a shape-matched skeleton.
export const DashboardContent = async () => {
  const today = getTodayAR()
  const currentYear = today.getFullYear()
  const currentMonth = today.getMonth() + 1

  return (
    <DashboardErrorBoundary>
      <div className="flex flex-col gap-4">
        <Suspense fallback={<HeroSkeleton />}>
          <HeroSectionContainer />
        </Suspense>

        <Suspense fallback={<MonthBalanceSkeleton />}>
          <MonthBalanceSectionContainer
            currentYear={currentYear}
            currentMonth={currentMonth}
          />
        </Suspense>

        <Suspense fallback={<SpendingSkeleton />}>
          <SpendingSectionContainer today={today} />
        </Suspense>
      </div>
    </DashboardErrorBoundary>
  )
}
