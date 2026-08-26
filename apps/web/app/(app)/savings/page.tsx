import { Suspense } from 'react'
import { SavingsErrorBoundary } from './_components/savings-error-boundary'
import { SavingsBreakdownContainer } from './_components/savings-breakdown-container'
import { SavingsHeadlineContainer } from './_components/savings-headline-container'
import {
  SavingsBreakdownSkeleton,
  SavingsHeadlineSkeleton,
} from './_components/savings-skeletons'

/**
 * Dos secciones, cada una con SU consulta: la foto lee `get_available_sums` y el
 * desglose `get_purpose_sums`. Un fallo en el desglose no se lleva la foto, que
 * es donde está el número y desde donde se puede sacar la plata.
 *
 * El desglose va como `children` de la foto y no como hermano, porque los
 * botones tienen que quedar DEBAJO de la lista y dependen de la foto — no del
 * desglose.
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
  </SavingsErrorBoundary>
)

export default SavingsPage
