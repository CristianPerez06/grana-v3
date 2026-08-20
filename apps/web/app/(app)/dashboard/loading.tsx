import { BalanceCardSkeleton } from './_components/balance-card-skeleton'
import { CommittedSkeleton } from './_components/committed-skeleton'

// Route-level loading shell: mirrors the redesigned composition (balance card →
// row of "Cuánto gastaste" + "Compromisos") with the same section skeletons
// DashboardContent uses as Suspense fallbacks.
const DashboardLoading = () => (
  <div className="flex flex-col gap-4">
    <BalanceCardSkeleton />
    <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-[1fr_1.12fr]">
      <CommittedSkeleton />
      <CommittedSkeleton />
    </div>
  </div>
)

export default DashboardLoading
