import { PageHeaderSkeleton } from '@/components/ui/page-header-skeleton'
import { Card, CardContent } from '@/components/ui/card'

const MetaRowSkeleton = () => (
  <div className="flex items-center justify-between gap-3 border-b border-border-soft py-2 last:border-b-0">
    <span className="h-3 w-24 rounded bg-muted/70 animate-pulse" />
    <span className="h-3.5 w-28 rounded bg-muted animate-pulse" />
  </div>
)

const TransactionDetailLoading = () => (
  <div className="flex flex-col gap-4 max-w-lg mx-auto" aria-busy="true">
    <PageHeaderSkeleton />

    <Card>
      <CardContent className="pt-6 flex flex-col gap-6">
        <div className="flex flex-col items-center gap-3">
          <span className="size-16 rounded-2xl bg-muted animate-pulse" />
          <span className="h-9 w-48 rounded bg-muted animate-pulse" />
          <span className="h-3.5 w-32 rounded bg-muted/70 animate-pulse" />
        </div>

        <div className="flex flex-col">
          {Array.from({ length: 5 }).map((_, i) => (
            <MetaRowSkeleton key={i} />
          ))}
        </div>
      </CardContent>
    </Card>

    <Card>
      <CardContent className="pt-6 flex flex-col gap-3">
        <span className="h-3.5 w-44 rounded bg-muted animate-pulse" />
        <span className="h-3 w-full rounded bg-muted/70 animate-pulse" />
        <span className="h-3 w-3/4 rounded bg-muted/70 animate-pulse" />
      </CardContent>
    </Card>
  </div>
)

export default TransactionDetailLoading
