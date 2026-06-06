const HeaderSkeleton = () => (
  <div className="flex items-center gap-4">
    <span className="size-[54px] shrink-0 rounded-[15px] bg-muted animate-pulse" />
    <div className="flex min-w-0 flex-1 flex-col gap-2">
      <span className="h-7 w-48 rounded bg-muted animate-pulse" />
      <span className="h-4 w-32 rounded bg-muted/70 animate-pulse" />
    </div>
  </div>
)

const RowSkeleton = () => (
  <div className="flex items-center gap-3 border-b border-border-soft px-4 py-3 last:border-b-0">
    <span className="size-9 shrink-0 rounded-lg bg-muted animate-pulse" />
    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
      <span className="h-3.5 w-40 rounded bg-muted animate-pulse" />
      <span className="h-3 w-24 rounded bg-muted/70 animate-pulse" />
    </div>
    <span className="h-3.5 w-20 shrink-0 rounded bg-muted animate-pulse" />
  </div>
)

const AccountDetailLoading = () => (
  <div className="flex flex-col gap-8" aria-busy="true">
    <HeaderSkeleton />

    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <span className="h-3.5 w-28 rounded bg-muted/70 animate-pulse" />
        <span className="h-8 w-36 rounded bg-muted animate-pulse" />
      </div>

      <div className="flex flex-col rounded-2xl border border-border-soft bg-card">
        {Array.from({ length: 6 }).map((_, i) => (
          <RowSkeleton key={i} />
        ))}
      </div>
    </section>
  </div>
)

export default AccountDetailLoading
