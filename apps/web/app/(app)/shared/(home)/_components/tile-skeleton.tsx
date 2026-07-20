import { Card } from '@/components/ui/card'

// A debt/projection tile placeholder: eyebrow + a headline row + two actions.
// Suspense fallback for the today-anchored DebtSection / OutlookSection.
export const TileSkeleton = () => (
  <Card className="flex flex-col gap-4 p-5" aria-busy="true">
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
