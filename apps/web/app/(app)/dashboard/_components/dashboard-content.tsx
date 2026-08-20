import { Suspense } from 'react'
import { getTodayAR } from '@/lib/date'
import { BalanceCardContainer } from './balance-card-container'
import { BalanceCardSkeleton } from './balance-card-skeleton'
import { CommittedSectionContainer } from './committed-section-container'
import { CommittedSkeleton } from './committed-skeleton'
import { DashboardErrorBoundary } from './dashboard-error-boundary'
import { MonthBalanceSectionContainer } from './month-balance-section-container'
import { MonthBalanceSkeleton } from './month-balance-skeleton'
import { SharedStripContainer } from './shared-strip-container'
import { SpendingSectionContainer } from './spending-section-container'
import { SpendingSkeleton } from './spending-skeleton'
import { SpentThisMonthSection } from './spent-this-month-section'

// Dashboard composition (design handoff `docs/design/dashboard-home/`): row 1
// "Saldo disponible total" (full width) → row ("Balance del mes" +
// "Comprometido") → "Compartido" (only with activity) → "Gastaste este mes"
// (only with card spend) → "¿En qué gasté?".
// Each section streams behind its own Suspense with a shape-matched skeleton.
// NOTE: rows 2+ still hold the pre-redesign sections; they are replaced card by
// card by the `redesign-dashboard-home-v2` change.
export const DashboardContent = async () => {
  const today = getTodayAR()
  const currentYear = today.getFullYear()
  const currentMonth = today.getMonth() + 1

  return (
    <DashboardErrorBoundary>
      <div className="flex flex-col gap-4">
        {/* Fila 1 — "Saldo disponible total" a ancho completo: el total, la
            fila USD y "Dónde está" plegado adentro del hero oscuro. */}
        <Suspense fallback={<BalanceCardSkeleton />}>
          <BalanceCardContainer />
        </Suspense>

        {/* Balance del mes (CAJA, lo que pasó) + Comprometido (COMPROMISO),
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

        {/* Compartido — tira condicional con el neto del Hogar (solo con actividad). */}
        <Suspense fallback={null}>
          <SharedStripContainer />
        </Suspense>

        {/* Gastaste este mes — barra caja vs tarjeta (solo si hubo consumo de
            tarjeta en el mes). Cliente: lee el cache de las otras secciones. */}
        <SpentThisMonthSection />

        <Suspense fallback={<SpendingSkeleton />}>
          <SpendingSectionContainer today={today} />
        </Suspense>
      </div>
    </DashboardErrorBoundary>
  )
}
