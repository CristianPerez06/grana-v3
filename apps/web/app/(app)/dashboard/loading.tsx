import { HeroSkeleton } from './_components/hero-skeleton'
import { MonthBalanceSkeleton } from './_components/month-balance-skeleton'
import { SpendingSkeleton } from './_components/spending-skeleton'

// Route-level loading shell: mirrors the redesigned dashboard composition
// (top row → Balance del mes → En qué se fue) with the same section skeletons
// DashboardContent uses as Suspense fallbacks.
const DashboardLoading = () => (
  <div className="flex flex-col gap-4">
    <HeroSkeleton />
    <MonthBalanceSkeleton />
    <SpendingSkeleton />
  </div>
)

export default DashboardLoading
