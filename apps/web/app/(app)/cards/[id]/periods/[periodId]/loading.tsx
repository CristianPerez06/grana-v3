const TxRowSkeleton = () => (
  <div className="flex items-center gap-3 px-4 py-3">
    <div className="flex flex-1 flex-col gap-1.5 min-w-0">
      <span className="h-3.5 w-40 rounded bg-muted animate-pulse" />
      <span className="h-3 w-20 rounded bg-muted/70 animate-pulse" />
    </div>
    <span className="h-3.5 w-24 shrink-0 rounded bg-muted animate-pulse" />
  </div>
)

const PeriodDetailLoading = () => (
  <div className="flex flex-col gap-6" aria-busy="true">
    <div className="rounded-lg border border-border bg-card p-4 flex flex-col gap-2">
      <span className="h-8 w-44 rounded bg-muted animate-pulse" />
      <span className="h-4 w-28 rounded bg-muted/70 animate-pulse" />
    </div>

    <section>
      <span className="mb-3 block h-3.5 w-32 rounded bg-muted/70 animate-pulse" />
      <div className="flex flex-col divide-y divide-border rounded-lg border border-border">
        {Array.from({ length: 5 }).map((_, i) => (
          <TxRowSkeleton key={i} />
        ))}
      </div>
    </section>
  </div>
)

export default PeriodDetailLoading
