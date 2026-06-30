const FieldSkeleton = () => (
  <div className="flex flex-col gap-1.5">
    <span className="h-3 w-24 rounded bg-muted/70 animate-pulse" />
    <span className="h-11 w-full rounded-[10px] bg-muted animate-pulse" />
  </div>
)

const CardSkeleton = ({ fields }: { fields: number }) => (
  <div className="flex flex-col gap-5 rounded-2xl border border-border bg-card p-5 shadow-sm">
    <span className="h-3 w-28 rounded bg-muted/70 animate-pulse" />
    {Array.from({ length: fields }).map((_, i) => (
      <FieldSkeleton key={i} />
    ))}
  </div>
)

const PayPeriodLoading = () => (
  <div className="flex flex-col gap-5" aria-busy="true">
    <CardSkeleton fields={4} />
    <CardSkeleton fields={2} />
    <span className="h-12 w-full rounded-[10px] bg-muted animate-pulse" />
  </div>
)

export default PayPeriodLoading
