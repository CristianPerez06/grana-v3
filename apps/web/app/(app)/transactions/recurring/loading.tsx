import { PageHeaderSkeleton } from '@/components/ui/page-header-skeleton'

const ROW_COUNT = 6

const RecurringRowSkeleton = () => (
  <div className="flex items-center gap-3 border-b border-border-soft px-4 py-3 last:border-b-0">
    <span className="size-9 shrink-0 rounded-lg bg-muted animate-pulse" />
    <div className="flex flex-1 flex-col gap-1.5 min-w-0">
      <span className="h-3.5 w-40 rounded bg-muted animate-pulse" />
      <span className="h-3 w-24 rounded bg-muted/70 animate-pulse" />
    </div>
    <span className="h-3.5 w-20 shrink-0 rounded bg-muted animate-pulse" />
  </div>
)

const RecurringLoading = () => (
  <div className="flex max-w-3xl flex-col gap-6" aria-busy="true">
    <PageHeaderSkeleton withSubtitle withAction />

    <div className="flex items-center gap-2">
      <span className="h-9 w-24 rounded-full bg-muted animate-pulse" />
      <span className="h-9 w-24 rounded-full bg-muted/70 animate-pulse" />
    </div>

    <div className="flex flex-col rounded-2xl border border-border-soft bg-card">
      {Array.from({ length: ROW_COUNT }).map((_, i) => (
        <RecurringRowSkeleton key={i} />
      ))}
    </div>
  </div>
)

export default RecurringLoading
