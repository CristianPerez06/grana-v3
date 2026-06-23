import { Card } from '@/components/ui/card'

const RECENT_ROWS = 4

const RecentRowSkeleton = () => (
  <li className="flex items-center justify-between gap-3 border-b border-border-soft p-4 last:border-b-0">
    <div className="flex min-w-0 flex-col gap-1.5">
      <span className="h-3.5 w-44 rounded bg-muted animate-pulse" />
      <span className="h-3 w-56 rounded bg-muted/70 animate-pulse" />
    </div>
    <span className="h-3.5 w-20 shrink-0 rounded bg-muted animate-pulse" />
  </li>
)

// A debt/projection tile: eyebrow + a headline row + two action buttons.
const TileSkeleton = () => (
  <Card className="flex flex-col gap-4 p-5">
    <span className="h-3 w-28 rounded bg-muted/70 animate-pulse" />
    <div className="flex items-center gap-3">
      <span className="size-10 shrink-0 rounded-full bg-muted animate-pulse" />
      <span className="h-7 w-28 rounded bg-muted animate-pulse" />
      <span className="size-10 shrink-0 rounded-full bg-muted animate-pulse" />
    </div>
    <div className="mt-auto flex gap-2">
      <span className="h-10 flex-1 rounded-xl bg-muted/70 animate-pulse" />
      <span className="h-10 w-32 rounded-xl bg-muted/70 animate-pulse" />
    </div>
  </Card>
)

// Mirrors the redesigned home: month nav + navy "Gasto del hogar · neto" hero +
// the debt/projection tiles row + recent movements — same shape the page renders
// so the chrome doesn't shift on load.
const SharedHomeLoading = () => (
  <div className="flex flex-col gap-4" aria-busy="true">
    <div className="flex items-center justify-between">
      <span className="h-4 w-32 rounded bg-muted animate-pulse" />
      <div className="flex gap-2">
        <span className="size-8 rounded-lg bg-muted/70 animate-pulse" />
        <span className="size-8 rounded-lg bg-muted/70 animate-pulse" />
      </div>
    </div>

    <article className="bg-hero-navy relative flex min-h-[210px] flex-col gap-5 overflow-hidden rounded-3xl border border-navy-border p-6 shadow-[0_24px_60px_-42px_rgba(11,26,43,0.48)]">
      <span className="h-3 w-40 rounded bg-navy-soft animate-pulse" />
      <span className="h-10 w-48 rounded bg-navy-soft animate-pulse" />
      <div className="mt-auto flex justify-between gap-3">
        <span className="h-4 w-28 rounded bg-navy-soft animate-pulse" />
        <span className="h-4 w-24 rounded bg-navy-soft animate-pulse" />
      </div>
    </article>

    <div className="grid gap-4 sm:grid-cols-2">
      <TileSkeleton />
      <TileSkeleton />
    </div>

    <section className="flex flex-col gap-3">
      <span className="h-3 w-32 rounded bg-muted/70 animate-pulse" />
      <Card asChild>
        <ul className="flex flex-col">
          {Array.from({ length: RECENT_ROWS }).map((_, i) => (
            <RecentRowSkeleton key={i} />
          ))}
        </ul>
      </Card>
    </section>
  </div>
)

export default SharedHomeLoading
