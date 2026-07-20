// Navy "Gasto del hogar · neto" placeholder — same shape the hero renders, used
// both as the Suspense fallback (initial load) and as the in-card loading state
// while a non-current month fetches.
export const HeroSkeleton = () => (
  <article
    className="bg-hero-navy relative flex min-h-[210px] flex-col gap-5 overflow-hidden rounded-3xl border border-navy-border p-6 shadow-[0_24px_60px_-42px_rgba(11,26,43,0.48)]"
    aria-busy="true"
  >
    <span className="h-3 w-40 rounded bg-navy-soft animate-pulse" />
    <span className="h-10 w-48 rounded bg-navy-soft animate-pulse" />
    <div className="mt-auto flex justify-between gap-3">
      <span className="h-4 w-28 rounded bg-navy-soft animate-pulse" />
      <span className="h-4 w-24 rounded bg-navy-soft animate-pulse" />
    </div>
  </article>
)
