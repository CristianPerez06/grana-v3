import { Suspense } from 'react'
import { formatDateISO, getTodayAR } from '@/lib/date'
import { BalanceCardContainer } from './balance-card-container'
import { BalanceCardSkeleton } from './balance-card-skeleton'
import { CommittedSectionContainer } from './committed-section-container'
import { CommittedSkeleton } from './committed-skeleton'
import { DashboardErrorBoundary } from './dashboard-error-boundary'
import { SharedStripContainer } from './shared-strip-container'
import { SpentCardContainer } from './spent-card-container'
import { SpentCardSkeleton } from './spent-card-skeleton'
import { SaveSuggestionStrip } from '@/lib/savings/components/save-suggestion-strip'

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
  const todayISO = formatDateISO(today)

  return (
    <DashboardErrorBoundary>
      <div className="flex flex-col gap-4">
        {/* La sugerencia de guardar. Va ARRIBA de la card porque su momento es
            "acabás de cobrar", y se resuelve entera en el cliente: si no
            corresponde ofrecerla no renderiza nada y la fila 1 sube sola. No es
            una tarea pendiente — sin badge, sin contador, sin bloquear nada. */}
        <SaveSuggestionStrip year={currentYear} month={currentMonth} />

        {/* Fila 1 — "Saldo disponible total" a ancho completo: el total, la
            fila USD y "Dónde está" plegado adentro del hero oscuro. */}
        <Suspense fallback={<BalanceCardSkeleton />}>
          <BalanceCardContainer
            currentYear={currentYear}
            currentMonth={currentMonth}
            todayISO={todayISO}
          />
        </Suspense>

        {/* Fila 2 — "Cuánto gastaste" + "Compromisos del próximo mes". La
            PRIMERA es la ancha: sus tres tiles se reparten un tercio del ancho
            cada uno y tienen que sostener montos de hasta diez dígitos con
            centavos, mientras que Compromisos apila filas de ancho completo. Las
            dos terminan a la misma altura (`items-stretch` + la tira de ritmo
            anclada al pie). */}
        <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-[1.12fr_1fr]">
          <Suspense fallback={<SpentCardSkeleton />}>
            <SpentCardContainer />
          </Suspense>

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
