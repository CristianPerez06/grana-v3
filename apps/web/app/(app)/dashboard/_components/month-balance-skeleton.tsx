import { getTranslations } from 'next-intl/server'
import { Card, CardContent, CardHeader } from '@/components/ui/card'

// Chart + footer placeholders. Exported so `MonthBalanceSection`'s in-card
// loading state (month navigation) reuses the same body shape.
export const MonthBalanceBodySkeleton = () => (
  <div className="flex min-h-[17.5rem] flex-1 flex-col">
    <div className="mb-3 h-[200px] w-full flex-1 rounded-md bg-muted animate-pulse" />
    <div className="mt-4 flex flex-wrap items-baseline justify-between gap-3 border-t border-border-soft pt-4">
      <div>
        <div className="h-3 w-24 rounded bg-muted/70 animate-pulse" />
        <div className="mt-2 h-6 w-32 rounded bg-muted animate-pulse" />
      </div>
      <div className="flex gap-4">
        <div className="h-3 w-24 rounded bg-muted/70 animate-pulse" />
        <div className="h-3 w-24 rounded bg-muted/70 animate-pulse" />
      </div>
    </div>
  </div>
)

export const MonthBalanceSkeleton = async () => {
  const t = await getTranslations('dashboard')
  return (
    <Card
      className="flex h-full min-h-[26rem] flex-col overflow-hidden"
      aria-busy="true"
      aria-label={t('month.loading')}
    >
      <CardHeader className="flex-row items-center justify-between gap-4">
        <span className="h-5 w-40 rounded bg-muted animate-pulse" />
        <span className="h-6 w-32 rounded bg-muted/70 animate-pulse" />
      </CardHeader>

      <CardContent className="flex flex-1 flex-col">
        <MonthBalanceBodySkeleton />
      </CardContent>
    </Card>
  )
}
