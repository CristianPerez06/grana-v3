import { Card } from '@/components/ui/card'

const EXPENSE_ROWS = 4

const ExpenseRowSkeleton = () => (
  <li className="flex items-center justify-between gap-3 border-b border-border-soft p-4 last:border-b-0">
    <div className="flex flex-col gap-1.5 min-w-0">
      <span className="h-3.5 w-44 rounded bg-muted animate-pulse" />
      <span className="h-3 w-56 rounded bg-muted/70 animate-pulse" />
    </div>
    <span className="h-3.5 w-20 shrink-0 rounded bg-muted animate-pulse" />
  </li>
)

const SharedHomeLoading = () => (
  <>
    <Card className="flex flex-col gap-4 p-5" aria-busy="true">
      <span className="h-3 w-20 rounded bg-muted/70 animate-pulse" />
      <div className="flex items-baseline justify-between gap-3">
        <span className="h-3.5 w-32 rounded bg-muted/70 animate-pulse" />
        <span className="h-7 w-28 rounded bg-muted animate-pulse" />
      </div>
      <div className="flex items-baseline justify-between gap-3">
        <span className="h-3.5 w-28 rounded bg-muted/70 animate-pulse" />
        <span className="h-7 w-24 rounded bg-muted animate-pulse" />
      </div>
    </Card>

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
  </>
)

export default SharedHomeLoading
