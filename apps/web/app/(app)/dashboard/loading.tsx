import { CategoryTeaserSkeleton } from './_components/category-teaser-skeleton'
import { HeroSkeleton } from './_components/hero-skeleton'
import { MonthBalanceSkeleton } from './_components/month-balance-skeleton'
import { UpcomingFortnightSkeleton } from './_components/upcoming-fortnight-skeleton'

const DashboardLoading = () => (
  <div className="flex flex-col gap-5">
    <HeroSkeleton />
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="lg:order-2">
        <UpcomingFortnightSkeleton />
      </div>
      <div className="lg:order-1">
        <MonthBalanceSkeleton />
      </div>
    </div>
    <CategoryTeaserSkeleton />
  </div>
)

export default DashboardLoading
