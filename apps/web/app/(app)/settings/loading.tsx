const SectionSkeleton = ({ rowCount }: { rowCount: number }) => (
  <div className="flex flex-col gap-2.5">
    <span className="h-3 w-28 rounded bg-muted/70 animate-pulse" />
    <div className="flex flex-col divide-y divide-border-soft overflow-hidden rounded-2xl border border-border bg-card">
      {Array.from({ length: rowCount }).map((_, i) => (
        <div key={i} className="flex min-h-[68px] items-center justify-between gap-[18px] px-[18px] py-4">
          <div className="flex flex-col gap-1.5 min-w-0">
            <span className="h-3.5 w-40 rounded bg-muted animate-pulse" />
            <span className="h-3 w-56 rounded bg-muted/70 animate-pulse" />
          </div>
          <span className="h-5 w-9 shrink-0 rounded-full bg-muted animate-pulse" />
        </div>
      ))}
    </div>
  </div>
)

const SettingsLoading = () => (
  <div className="flex flex-col gap-[18px]" aria-busy="true">
    <SectionSkeleton rowCount={2} />
    <SectionSkeleton rowCount={1} />
    <SectionSkeleton rowCount={1} />
  </div>
)

export default SettingsLoading
