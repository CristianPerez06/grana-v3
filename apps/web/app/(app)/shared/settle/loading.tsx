import { Card } from '@/components/ui/card'

const SharedSettleLoading = () => (
  <>
    <Card className="flex flex-col gap-4 p-5" aria-busy="true">
      <span className="h-3 w-24 rounded bg-muted/70 animate-pulse" />
      <span className="h-8 w-40 rounded bg-muted animate-pulse" />
    </Card>

    <div className="flex flex-col gap-5 rounded-2xl border border-border-soft bg-card p-6">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex flex-col gap-2">
          <span className="h-3 w-28 rounded bg-muted/70 animate-pulse" />
          <span className="h-10 w-full rounded-lg bg-muted animate-pulse" />
        </div>
      ))}
      <span className="h-10 w-32 rounded-lg bg-muted animate-pulse" />
    </div>
  </>
)

export default SharedSettleLoading
