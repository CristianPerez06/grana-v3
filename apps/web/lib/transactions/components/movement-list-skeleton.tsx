// Loading skeleton for the global movement list. Mirrors the anatomy of
// `MovementRow` (40x40 icon square + two text lines + amount on the right)
// so the page does not jolt when real data lands. Used as the Suspense
// fallback in `/transactions` page.tsx; never imported directly by users.

const SkeletonRow = () => (
  <div className="flex items-center justify-between gap-4 px-4 py-3">
    <div className="flex min-w-0 items-center gap-3 flex-1">
      <div className="size-10 shrink-0 rounded-md bg-muted animate-pulse" />
      <div className="flex flex-col gap-2 flex-1 min-w-0">
        <div className="h-3.5 w-2/3 rounded bg-muted animate-pulse" />
        <div className="h-2.5 w-1/3 rounded bg-muted/70 animate-pulse" />
      </div>
    </div>
    <div className="h-3.5 w-20 shrink-0 rounded bg-muted animate-pulse" />
  </div>
)

const SkeletonDayGroup = ({ rows }: { rows: number }) => (
  <div className="flex flex-col gap-2.5">
    <div className="flex items-baseline justify-between px-1">
      <div className="h-3 w-24 rounded bg-muted animate-pulse" />
      <div className="h-2.5 w-16 rounded bg-muted/70 animate-pulse" />
    </div>
    <div className="flex flex-col divide-y divide-border rounded-2xl border border-border bg-card overflow-hidden">
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonRow key={i} />
      ))}
    </div>
  </div>
)

export const MovementListSkeleton = () => (
  <div className="flex flex-col gap-7" aria-busy="true" aria-label="Cargando movimientos">
    <SkeletonDayGroup rows={3} />
    <SkeletonDayGroup rows={4} />
  </div>
)
