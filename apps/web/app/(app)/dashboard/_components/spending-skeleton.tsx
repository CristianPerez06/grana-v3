import { getTranslations } from 'next-intl/server'
import { Card, CardContent, CardHeader } from '@/components/ui/card'

const SKELETON_LEGEND_ROWS = 5

// Donut + legend placeholders. Exported so `SpendingSection`'s in-card loading
// state (month navigation) reuses the same body shape.
export const SpendingBodySkeleton = () => (
  <div className="grid min-h-[12rem] grid-cols-1 items-center justify-items-center gap-6 sm:grid-cols-[150px_1fr] sm:gap-7 sm:justify-items-stretch">
    <div className="size-[150px] shrink-0 rounded-full border-[17px] border-muted animate-pulse" />
    <ul className="flex w-full flex-col gap-3">
      {Array.from({ length: SKELETON_LEGEND_ROWS }).map((_, i) => (
        <li key={i} className="flex items-center gap-2.5">
          <span className="size-2.5 shrink-0 rounded-[3px] bg-muted animate-pulse" />
          <span className="h-3.5 w-28 rounded bg-muted animate-pulse" />
          <span className="ml-auto h-3.5 w-20 shrink-0 rounded bg-muted animate-pulse" />
          <span className="h-3 w-[34px] shrink-0 rounded bg-muted/70 animate-pulse" />
        </li>
      ))}
    </ul>
  </div>
)

export const SpendingSkeleton = async () => {
  const t = await getTranslations('dashboard')
  return (
    <Card
      className="flex flex-col"
      aria-busy="true"
      aria-label={t('spending.loading')}
    >
      <CardHeader className="flex-col items-start gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <span className="h-5 w-36 rounded bg-muted animate-pulse" />
        <span className="h-8 w-28 rounded-lg bg-muted/70 animate-pulse" />
      </CardHeader>
      <CardContent className="flex flex-1 flex-col">
        <SpendingBodySkeleton />
      </CardContent>
    </Card>
  )
}
