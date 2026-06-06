const HeaderSkeleton = () => (
  <div className="flex items-center gap-4">
    <span className="size-[54px] shrink-0 rounded-[15px] bg-muted animate-pulse" />
    <div className="flex min-w-0 flex-1 flex-col gap-2">
      <span className="h-7 w-48 rounded bg-muted animate-pulse" />
      <span className="h-4 w-32 rounded bg-muted/70 animate-pulse" />
    </div>
  </div>
)

const PeriodCardSkeleton = () => (
  <div className="flex flex-col gap-3 rounded-2xl border border-border-soft bg-card p-4">
    <span className="h-3 w-24 rounded bg-muted/70 animate-pulse" />
    <span className="h-6 w-40 rounded bg-muted animate-pulse" />
    <span className="h-3 w-32 rounded bg-muted/70 animate-pulse" />
  </div>
)

const CardDetailLoading = () => (
  <div className="flex flex-col gap-6" aria-busy="true">
    <HeaderSkeleton />

    <div className="flex flex-col gap-4">
      <PeriodCardSkeleton />
      <PeriodCardSkeleton />
      <PeriodCardSkeleton />
    </div>
  </div>
)

export default CardDetailLoading
