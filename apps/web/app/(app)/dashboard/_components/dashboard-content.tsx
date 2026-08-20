import { Suspense } from 'react'
import { getTodayAR } from '@/lib/date'
import { BalanceCardContainer } from './balance-card-container'
import { BalanceCardSkeleton } from './balance-card-skeleton'
import { CommittedSectionContainer } from './committed-section-container'
import { CommittedSkeleton } from './committed-skeleton'
import { DashboardErrorBoundary } from './dashboard-error-boundary'
import { SharedStripContainer } from './shared-strip-container'
import { SpentCard } from './spent-card'

// Dashboard composition (design handoff `docs/design/dashboard-home/`), four
// blocks in fixed order: "Saldo disponible total" (full width) → "Cuánto
// gastaste" + "Compromisos del próximo mes" → "Compartido" (only with activity).
// Each block streams behind its own Suspense with a shape-matched skeleton.
//
// "En qué se fue" is deliberately NOT here: the same per-category breakdown is
// the front page of the Movimientos module, and mirroring it made the dashboard
// longer without answering anything new.
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
          <BalanceCardContainer currentYear={currentYear} currentMonth={currentMonth} />
        </Suspense>

        {/* Fila 2 — "Cuánto gastaste" + "Compromisos del próximo mes", con la
            segunda algo más ancha. Las dos cards terminan a la misma altura
            (`items-stretch` + la tira de ritmo anclada al pie). */}
        <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-[1fr_1.12fr]">
          <SpentCard />

          <Suspense fallback={<CommittedSkeleton />}>
            <CommittedSectionContainer />
          </Suspense>
        </div>

        {/* Compartido — tira condicional con el neto del Hogar (solo con actividad). */}
        <Suspense fallback={null}>
          <SharedStripContainer />
        </Suspense>
      </div>
    </DashboardErrorBoundary>
  )
}
