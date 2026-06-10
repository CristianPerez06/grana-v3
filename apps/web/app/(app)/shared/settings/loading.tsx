const SectionSkeleton = ({ children }: { children: React.ReactNode }) => (
  <div className="flex flex-col gap-2.5">
    <span className="h-3 w-24 rounded bg-muted/70 animate-pulse" />
    {children}
  </div>
)

const SharedSettingsLoading = () => (
  <div className="flex flex-col gap-5" aria-busy="true">
    {/* Name */}
    <SectionSkeleton>
      <div className="rounded-2xl border border-border bg-card p-4">
        <span className="block h-11 w-full rounded-lg bg-muted animate-pulse" />
      </div>
    </SectionSkeleton>

    {/* Members */}
    <SectionSkeleton>
      <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-4">
        <span className="h-10 w-1/2 rounded-lg bg-muted animate-pulse" />
        <span className="h-10 w-1/2 rounded-lg bg-muted animate-pulse" />
      </div>
    </SectionSkeleton>
  </div>
)

export default SharedSettingsLoading
