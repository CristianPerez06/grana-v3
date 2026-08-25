import { cn } from '@/lib/utils'

/** The two top accounts per currency, which is what `derivePlacement` returns. */
export const PLACEMENT_ROWS = 2

/**
 * Mirror of `ALIGN` in `balance-card.tsx`: first hard left, last hard right,
 * middle centred.
 */
export const SUMMARY_ALIGN = {
  start: 'sm:items-start sm:text-left',
  center: 'sm:items-center sm:text-center',
  end: 'sm:items-end sm:text-right',
} as const

/**
 * The pieces of the balance card's body while it loads.
 *
 * They live apart from `balance-card-skeleton.tsx` because two sides with
 * opposite requirements consume them: the `<Suspense>` fallback (a server
 * component, which imports `next-intl/server`) and the client card, which loads
 * again when the user changes month. A client module cannot import the other.
 */
export const HeroAmountSkeleton = () => (
  <div className="mx-auto mt-[11px] h-[38px] w-64 max-w-full animate-pulse rounded bg-white/20" />
)

export const HeroUsdSkeleton = () => (
  <div className="mt-[13px] flex items-center justify-center gap-2.5">
    <div className="h-[23px] w-11 animate-pulse rounded-full bg-white/15" />
    <div className="h-4 w-24 animate-pulse rounded bg-white/15" />
  </div>
)

/** Mirror of `PlacementColumn`: currency gutter + dot / name / % rows. */
export const PlacementSkeleton = () => (
  <div className="flex gap-3 sm:block">
    <span className="h-3.5 w-8 shrink-0 animate-pulse rounded bg-white/15 sm:hidden" />
    <div className="grid min-w-0 flex-1 grid-cols-1 gap-y-2 sm:grid-cols-2 sm:gap-x-5">
      {Array.from({ length: PLACEMENT_ROWS }).map((_, row) => (
        <div key={row} className={cn('flex items-center gap-2', row === 1 && 'sm:justify-end')}>
          <span className="size-[10px] shrink-0 animate-pulse rounded-[2px] bg-white/15" />
          {/* `flex-1` only while stacked — like the real name, which is what
              pushes the percentage against the right edge. */}
          <span className="h-3.5 min-w-0 flex-1 animate-pulse rounded bg-white/15 sm:w-14 sm:flex-none" />
          <span className="h-3.5 w-9 shrink-0 animate-pulse rounded bg-white/10" />
        </div>
      ))}
    </div>
  </div>
)

/** The two currency columns with their divider, stacked as the card stacks them. */
export const PlacementGridSkeleton = () => (
  <>
    <PlacementSkeleton />
    <div className="border-t border-white/10 pt-3 sm:border-l sm:border-t-0 sm:pl-[15px] sm:pt-0">
      <PlacementSkeleton />
    </div>
  </>
)

/**
 * A `Flow`'s amount and its USD line. The label with its dot is NOT in here: it
 * does not depend on the read and keeps rendering for real while it loads.
 */
export const SummaryAmountSkeleton = () => (
  <>
    <span className="h-4 w-24 max-w-full animate-pulse rounded bg-muted sm:h-[27px] sm:w-32" />
    <span className="mt-[5px] h-3 w-16 animate-pulse rounded bg-muted/70" />
  </>
)
