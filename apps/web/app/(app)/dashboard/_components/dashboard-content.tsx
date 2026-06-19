import { Suspense } from 'react'
import { getTodayAR } from '@/lib/date'
import { CommittedSectionContainer } from './committed-section-container'
import { CommittedSkeleton } from './committed-skeleton'
import { DashboardErrorBoundary } from './dashboard-error-boundary'
import { FinancedOnCardNote } from './financed-on-card-note'
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

        {/* Balance del mes (CAJA, lo que pasó) + Lo que se viene (COMPROMISO),
            dos columnas en desktop como la fila del Hero; apiladas en mobile. */}
        <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-[1.15fr_1fr]">
          <Suspense fallback={<MonthBalanceSkeleton />}>
            <MonthBalanceSectionContainer
              currentYear={currentYear}
              currentMonth={currentMonth}
            />
          </Suspense>

          <Suspense fallback={<CommittedSkeleton />}>
            <CommittedSectionContainer />
          </Suspense>
        </div>

        {/* Puente CAJA → COMPROMISO: de lo gastado, cuánto se financió en
            tarjeta (no salió de caja). Tira full-width; se oculta sin tarjeta. */}
        <FinancedOnCardNote />

        <Suspense fallback={<SpendingSkeleton />}>
          <SpendingSectionContainer today={today} />
        </Suspense>
      </div>
    </DashboardErrorBoundary>
  )
}
