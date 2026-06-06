// Segment-level loading fallback for /accounts/[id]. The back-link in
// layout.tsx is never replaced; this file renders below it. Mirrors the
// peer-card layout (navy hero + ledger card) so the page does not jolt
// when the real shell mounts.

const HeroCardSkeleton = () => (
  <div
    className="bg-hero-navy text-white relative overflow-hidden rounded-3xl border border-navy-border flex min-h-[238px] flex-col justify-between p-6 shadow-[0_24px_60px_-42px_rgba(11,26,43,0.48)]"
    aria-busy
  >
    <div className="flex items-start justify-between gap-4">
      <div className="flex min-w-0 items-center gap-3">
        <div className="size-[52px] shrink-0 rounded-2xl bg-navy-soft animate-pulse" />
        <div className="flex min-w-0 flex-col gap-2 pt-1">
          <div className="h-6 w-40 rounded bg-navy-soft animate-pulse" />
          <div className="h-3.5 w-28 rounded bg-navy-soft animate-pulse" />
        </div>
      </div>
      <div className="size-[38px] shrink-0 rounded-xl bg-navy-soft animate-pulse" />
    </div>
    <div className="flex flex-col gap-3">
      <div className="h-2.5 w-16 rounded bg-navy-soft animate-pulse" />
      <div className="h-10 w-56 rounded bg-navy-soft animate-pulse" />
      <div className="h-5 w-32 rounded bg-navy-soft animate-pulse" />
    </div>
  </div>
)

const LedgerCardSkeleton = () => (
  <div className="overflow-hidden rounded-3xl border border-border bg-card" aria-busy>
    <div className="flex items-center justify-between gap-4 border-b border-border-soft px-5 py-4">
      <span className="h-4 w-32 rounded bg-muted animate-pulse" />
      <span className="h-9 w-32 rounded-lg bg-muted animate-pulse" />
    </div>
    <div className="flex flex-col gap-3 px-5 py-4">
      <div className="flex items-center justify-between gap-2">
        <span className="h-9 w-36 rounded-md bg-muted/70 animate-pulse" />
        <span className="h-9 w-24 rounded-md bg-muted/70 animate-pulse" />
      </div>
      <div className="flex flex-col gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 border-t border-border-soft py-3 first:border-t-0">
            <span className="size-9 shrink-0 rounded-xl bg-muted animate-pulse" />
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <span className="h-3.5 w-40 rounded bg-muted animate-pulse" />
              <span className="h-3 w-24 rounded bg-muted/70 animate-pulse" />
            </div>
            <span className="h-3.5 w-20 shrink-0 rounded bg-muted animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  </div>
)

const AccountDetailLoading = () => (
  <div className="flex flex-col gap-5" aria-busy="true">
    <HeroCardSkeleton />
    <LedgerCardSkeleton />
  </div>
)

export default AccountDetailLoading
