// Loading skeleton for the global movement list. Mirrors the anatomy of
// `MovementRow` post-redesign (3-col grid desktop / 2-col mobile, day groups
// separated by border-top) so the page does not jolt when real data lands.
// Used as the Suspense fallback in `/transactions` page.tsx and other ledger
// hosts; never imported directly by users.

const SkeletonRow = () => (
  <div className="grid grid-cols-[minmax(0,1fr)_112px] md:grid-cols-[minmax(0,1fr)_126px_126px] items-center gap-4 md:gap-[18px] min-h-[62px] px-4 py-3">
    <div className="flex min-w-0 items-center gap-2.5">
      <div className="size-9 shrink-0 rounded-xl bg-muted animate-pulse" />
      <div className="flex flex-col gap-2 min-w-0 flex-1">
        <div className="h-3.5 w-2/3 rounded bg-muted animate-pulse" />
        <div className="h-2.5 w-1/3 rounded bg-muted/70 animate-pulse" />
      </div>
    </div>
    <div className="h-3.5 w-20 justify-self-end rounded bg-muted animate-pulse" />
    <div className="hidden h-3 w-20 justify-self-end rounded bg-muted/70 animate-pulse md:block" />
  </div>
)

const SkeletonDayGroup = ({ rows, withTopBorder }: { rows: number; withTopBorder?: boolean }) => (
  <section className={withTopBorder ? 'border-t border-border-soft pt-3 mt-3' : ''}>
    <div className="px-4 pb-2">
      <div className="h-3 w-24 rounded bg-muted animate-pulse" />
    </div>
    <div className="flex flex-col">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className={i === 0 ? '' : 'border-t border-border-soft'}>
          <SkeletonRow />
        </div>
      ))}
    </div>
  </section>
)

export const MovementListSkeleton = () => (
  <div className="flex flex-col" aria-busy="true" aria-label="Cargando movimientos">
    <SkeletonDayGroup rows={3} />
    <SkeletonDayGroup rows={4} withTopBorder />
  </div>
)
