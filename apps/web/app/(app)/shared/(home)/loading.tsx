import { Card } from '@/components/ui/card'

const EXPENSE_ROWS = 4
const MEMBER_ROWS = 2

const ExpenseRowSkeleton = () => (
  <li className="flex items-center justify-between gap-3 border-b border-border-soft p-4 last:border-b-0">
    <div className="flex flex-col gap-1.5 min-w-0">
      <span className="h-3.5 w-44 rounded bg-muted animate-pulse" />
      <span className="h-3 w-56 rounded bg-muted/70 animate-pulse" />
    </div>
    <span className="h-3.5 w-20 shrink-0 rounded bg-muted animate-pulse" />
  </li>
)

const MemberRowSkeleton = () => (
  <li className="flex items-center gap-3">
    <span className="size-10 shrink-0 rounded-xl bg-muted animate-pulse" />
    <div className="flex flex-col gap-1.5 min-w-0">
      <span className="h-3.5 w-24 rounded bg-muted animate-pulse" />
      <span className="h-3 w-14 rounded bg-muted/70 animate-pulse" />
    </div>
  </li>
)

// Mirrors the active-household layout: navy balance hero + recent list in the
// main column, members card in the side column. Two columns on desktop,
// stacked on narrow — same shape the page renders so the chrome doesn't shift.
const SharedHomeLoading = () => (
  <div
    className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_330px] lg:items-start"
    aria-busy="true"
  >
    <div className="flex min-w-0 flex-col gap-4">
      <article className="bg-hero-navy relative flex min-h-[238px] flex-col justify-between overflow-hidden rounded-3xl border border-navy-border p-6 shadow-[0_24px_60px_-42px_rgba(11,26,43,0.48)]">
        <div className="flex flex-col gap-5">
          <span className="h-3 w-24 rounded bg-navy-soft animate-pulse" />
          <div className="flex flex-col gap-4">
            <div className="flex items-end justify-between gap-3">
              <span className="h-3.5 w-32 rounded bg-navy-soft animate-pulse" />
              <span className="h-8 w-28 rounded bg-navy-soft animate-pulse" />
            </div>
            <div className="flex items-end justify-between gap-3">
              <span className="h-3.5 w-28 rounded bg-navy-soft animate-pulse" />
              <span className="h-6 w-24 rounded bg-navy-soft animate-pulse" />
            </div>
          </div>
        </div>
      </article>

      <section className="flex flex-col gap-3">
        <span className="h-3 w-32 rounded bg-muted/70 animate-pulse" />
        <Card asChild>
          <ul className="flex flex-col">
            {Array.from({ length: EXPENSE_ROWS }).map((_, i) => (
              <ExpenseRowSkeleton key={i} />
            ))}
          </ul>
        </Card>
      </section>
    </div>

    <aside className="flex flex-col gap-4">
      <Card className="flex flex-col gap-4 p-5">
        <span className="h-3 w-20 rounded bg-muted/70 animate-pulse" />
        <ul className="flex flex-col gap-3">
          {Array.from({ length: MEMBER_ROWS }).map((_, i) => (
            <MemberRowSkeleton key={i} />
          ))}
        </ul>
      </Card>
    </aside>
  </div>
)

export default SharedHomeLoading
