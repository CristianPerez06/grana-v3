const SharedSetupLoading = () => (
  <div
    className="flex flex-col gap-5 rounded-2xl border border-border-soft bg-card p-6"
    aria-busy="true"
  >
    <div className="flex flex-col gap-2">
      <span className="h-3 w-28 rounded bg-muted/70 animate-pulse" />
      <span className="h-10 w-full rounded-lg bg-muted animate-pulse" />
    </div>
    <div className="flex flex-col gap-2">
      <span className="h-3 w-32 rounded bg-muted/70 animate-pulse" />
      <span className="h-10 w-full rounded-lg bg-muted animate-pulse" />
    </div>
    <span className="h-10 w-32 rounded-lg bg-muted animate-pulse" />
  </div>
)

export default SharedSetupLoading
