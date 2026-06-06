const PeriodRowSkeleton = () => (
  <div className="flex items-center justify-between border-b border-border-soft px-4 py-4 last:border-b-0">
    <div className="flex flex-col gap-1.5">
      <span className="h-3.5 w-32 rounded bg-muted animate-pulse" />
      <span className="h-3 w-20 rounded bg-muted/70 animate-pulse" />
    </div>
    <span className="h-3.5 w-24 rounded bg-muted animate-pulse" />
  </div>
)

const CardPeriodsLoading = () => (
  <div className="flex flex-col rounded-2xl border border-border-soft bg-card" aria-busy="true">
    {Array.from({ length: 6 }).map((_, i) => (
      <PeriodRowSkeleton key={i} />
    ))}
  </div>
)

export default CardPeriodsLoading
