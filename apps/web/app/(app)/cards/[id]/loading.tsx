const HeaderSkeleton = () => (
  <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-4">
    <div className="flex items-start gap-4 md:flex-1 md:items-center">
      <span className="size-[54px] shrink-0 rounded-[15px] bg-muted animate-pulse" />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <span className="h-7 w-48 rounded bg-muted animate-pulse" />
        <span className="h-4 w-32 rounded bg-muted/70 animate-pulse" />
      </div>
    </div>
  </div>
)

const TimelineSkeleton = () => (
  <span className="h-[72px] rounded-2xl border border-border-soft bg-card animate-pulse" />
)

const PeriodCardSkeleton = ({ tall = false }: { tall?: boolean }) => (
  <div className={`flex flex-col gap-3 rounded-2xl border border-border-soft bg-card p-6 ${tall ? 'min-h-[200px]' : 'min-h-[140px]'}`}>
    <span className="h-3 w-24 rounded bg-muted/70 animate-pulse" />
    <span className="h-8 w-40 rounded bg-muted animate-pulse" />
    <span className="h-3 w-32 rounded bg-muted/70 animate-pulse" />
  </div>
)

const SideCardSkeleton = () => (
  <span className="h-[120px] rounded-2xl border border-border-soft bg-card animate-pulse" />
)

const CardDetailLoading = () => (
  <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_320px]" aria-busy="true">
    <div className="flex min-w-0 flex-col gap-5">
      <HeaderSkeleton />
      <TimelineSkeleton />
      <PeriodCardSkeleton tall />
      <PeriodCardSkeleton tall />
    </div>
    <aside className="hidden flex-col gap-4 lg:flex">
      <SideCardSkeleton />
      <SideCardSkeleton />
    </aside>
  </div>
)

export default CardDetailLoading
