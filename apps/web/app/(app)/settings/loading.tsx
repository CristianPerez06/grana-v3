const SectionSkeleton = ({ rowCount }: { rowCount: number }) => (
  <div className="flex flex-col gap-3">
    <span className="h-3 w-28 rounded bg-muted/70 animate-pulse" />
    <div className="flex flex-col divide-y divide-border-soft rounded-2xl border border-border-soft bg-card">
      {Array.from({ length: rowCount }).map((_, i) => (
        <div key={i} className="flex items-center justify-between gap-3 px-4 py-4">
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
  <div className="flex flex-col gap-8" aria-busy="true">
    <SectionSkeleton rowCount={2} />
    <SectionSkeleton rowCount={1} />
    <SectionSkeleton rowCount={1} />
  </div>
)

export default SettingsLoading
