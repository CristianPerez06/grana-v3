import { BalanceCardSkeleton } from './_components/balance-card-skeleton'
import { SpendingSkeleton } from './_components/spending-skeleton'

// Route-level loading shell: mirrors the redesigned dashboard composition
// (card de saldo → resto) with the same section skeletons
// DashboardContent uses as Suspense fallbacks.
const DashboardLoading = () => (
  <div className="flex flex-col gap-4">
    <BalanceCardSkeleton />
    <SpendingSkeleton />
  </div>
)

export default DashboardLoading
