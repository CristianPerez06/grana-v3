import { PageHeaderSkeleton } from '@/components/ui/page-header-skeleton'

const FormRowSkeleton = () => (
  <div className="flex flex-col gap-2">
    <span className="h-3 w-24 rounded bg-muted/70 animate-pulse" />
    <span className="h-10 w-full rounded-lg bg-muted animate-pulse" />
  </div>
)

const NewMovementLoading = () => (
  <div className="flex flex-col gap-6 max-w-lg" aria-busy="true">
    <PageHeaderSkeleton />

    <div className="flex flex-col gap-5 rounded-2xl border border-border-soft bg-card p-6">
      {Array.from({ length: 6 }).map((_, i) => (
        <FormRowSkeleton key={i} />
      ))}
      <span className="h-10 w-full rounded-lg bg-muted animate-pulse" />
    </div>
  </div>
)

export default NewMovementLoading
