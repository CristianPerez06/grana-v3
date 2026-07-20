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

// "Últimos movimientos" list placeholder — used as the Suspense fallback and as
// the in-card loading state while a non-current month fetches.
export const RecentSkeleton = () => (
  <Card asChild>
    <ul className="flex flex-col" aria-busy="true">
      {Array.from({ length: RECENT_ROWS }).map((_, i) => (
        <RecentRowSkeleton key={i} />
      ))}
    </ul>
  </Card>
)
