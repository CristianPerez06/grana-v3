import { MovementListSkeleton } from '@/lib/transactions/components/movement-list-skeleton'

const FiltersBarSkeleton = () => (
  <div className="flex flex-wrap items-center gap-2" aria-hidden>
    <span className="h-9 w-28 rounded-full bg-muted animate-pulse" />
    <span className="h-9 w-24 rounded-full bg-muted animate-pulse" />
    <span className="h-9 w-32 rounded-full bg-muted animate-pulse" />
    <span className="h-9 w-20 rounded-full bg-muted animate-pulse" />
  </div>
)

const TransactionsLoading = () => (
  <>
    <FiltersBarSkeleton />
    <MovementListSkeleton />
  </>
)

export default TransactionsLoading
