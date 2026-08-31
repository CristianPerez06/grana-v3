import { Suspense } from 'react'
import { SavingsErrorBoundary } from './_components/savings-error-boundary'
import { SavingsBreakdownContainer } from './_components/savings-breakdown-container'
import { SavingsHeadlineContainer } from './_components/savings-headline-container'
import { SavingsLedgerContainer } from './_components/savings-ledger-container'
import {
  SavingsBreakdownSkeleton,
  SavingsHeadlineSkeleton,
  SavingsLedgerSkeleton,
} from './_components/savings-skeletons'

/**
 * Tres secciones, cada una con SU consulta, ordenadas por lo que se pierde si
 * falla: la foto (`get_available_sums`) tiene el número y las acciones, el
 * desglose (`get_purpose_sums`) dice para qué es, y el pie explica y audita.
 * Un fallo abajo nunca se lleva lo de arriba.
 *
 * El desglose va como `children` de la foto y no como hermano, porque la
 * jerarquía es esa: el total es el bloque padre y el desglose son sus partes
 * (E16). El pie SÍ es hermano — no es parte del total, es sobre él.
 */
const SavingsPage = () => (
  <SavingsErrorBoundary>
    <Suspense fallback={<SavingsHeadlineSkeleton />}>
      <SavingsHeadlineContainer>
        <Suspense fallback={<SavingsBreakdownSkeleton />}>
          <SavingsBreakdownContainer />
        </Suspense>
      </SavingsHeadlineContainer>
    </Suspense>
    <Suspense fallback={<SavingsLedgerSkeleton />}>
      <SavingsLedgerContainer />
    </Suspense>
  </SavingsErrorBoundary>
)

export default SavingsPage
