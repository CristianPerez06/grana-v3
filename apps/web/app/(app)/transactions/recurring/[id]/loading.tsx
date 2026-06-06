const RowSkeleton = () => (
  <div className="flex items-center justify-between border-b border-border-soft py-3 last:border-b-0">
    <span className="h-3 w-32 rounded bg-muted/70 animate-pulse" />
    <span className="h-3.5 w-24 rounded bg-muted animate-pulse" />
  </div>
)

const RecurrenceDetailLoading = () => (
  <div className="flex flex-col gap-8" aria-busy="true">
    <div className="flex flex-col gap-2">
      <span className="h-7 w-56 rounded bg-muted animate-pulse" />
      <span className="h-4 w-72 rounded bg-muted/70 animate-pulse" />
    </div>

    <div className="flex flex-col rounded-2xl border border-border-soft bg-card p-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <RowSkeleton key={i} />
      ))}
    </div>

    <div className="flex flex-col gap-2">
      <span className="h-4 w-40 rounded bg-muted/70 animate-pulse" />
      <div className="flex flex-col rounded-2xl border border-border-soft bg-card p-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <RowSkeleton key={i} />
        ))}
      </div>
    </div>
  </div>
)

export default RecurrenceDetailLoading
