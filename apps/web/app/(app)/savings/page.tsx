import { Suspense } from 'react'
import { SavingsErrorBoundary } from './_components/savings-error-boundary'
import { SavingsOverviewContainer } from './_components/savings-overview-container'
import { SavingsOverviewSkeleton } from './_components/savings-overview-skeleton'

const SavingsPage = () => (
  <SavingsErrorBoundary>
    <Suspense fallback={<SavingsOverviewSkeleton />}>
      <SavingsOverviewContainer />
    </Suspense>
  </SavingsErrorBoundary>
)

export default SavingsPage
