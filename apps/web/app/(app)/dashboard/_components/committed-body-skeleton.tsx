// Body-only placeholder for "Compromisos": the total box with its stacked bar
// and the two collapsed group headers, without the Card chrome.
//
// Split out of `committed-skeleton.tsx` so the client card can show it while
// navigating to an uncached month WITHOUT replacing its own header — the title,
// the month and the link do not depend on the read and must not blink. The full
// skeleton (Suspense fallback, first paint) composes this same body, so the two
// loading states cannot drift apart. Same split as `spent-card-body-skeleton`.
export const CommittedBodySkeleton = () => (
  <>
    <div className="rounded-2xl border border-border bg-surface-sunken p-4">
      <div className="h-3 w-28 animate-pulse rounded bg-muted/70" />
      <div className="mt-2 h-8 w-44 max-w-full animate-pulse rounded bg-muted" />
      <div className="mt-3 h-[9px] w-full animate-pulse rounded-[5px] bg-muted" />
      <div className="mt-2 flex gap-4">
        <div className="h-3 w-24 animate-pulse rounded bg-muted/70" />
        <div className="h-3 w-28 animate-pulse rounded bg-muted/70" />
      </div>
    </div>

    {[0, 1].map((group) => (
      <div key={group} className="rounded-2xl border border-border px-3.5 py-3">
        <div className="flex items-center gap-3">
          <span className="size-9 shrink-0 animate-pulse rounded-xl bg-muted" />
          <span className="flex-1 space-y-1.5">
            <span className="block h-3.5 w-24 animate-pulse rounded bg-muted" />
            <span className="block h-3 w-32 animate-pulse rounded bg-muted/70" />
          </span>
          <span className="h-4 w-24 shrink-0 animate-pulse rounded bg-muted" />
        </div>
      </div>
    ))}
  </>
)
