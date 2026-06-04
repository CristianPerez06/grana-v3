import { getTranslations } from 'next-intl/server'
import { Card, CardContent, CardHeader } from '@/components/ui/card'

// Net + flow rows + USD strip placeholders. Exported so `MonthBalanceSection`'s
// in-card loading state (month navigation) reuses the same body shape.
export const MonthBalanceBodySkeleton = () => (
  <div className="flex min-h-[15rem] flex-1 flex-col">
    {/* Eyebrow + net */}
    <div className="h-3 w-16 rounded bg-muted/70 animate-pulse" />
    <div className="mt-2 h-9 w-48 rounded bg-muted animate-pulse" />

    {/* Ingresos / Gastos rows */}
    <div className="mt-5 flex flex-col gap-3.5">
      {Array.from({ length: 2 }).map((_, i) => (
        <div key={i}>
          <div className="flex items-center justify-between gap-3">
            <div className="h-3.5 w-24 rounded bg-muted/70 animate-pulse" />
            <div className="h-3.5 w-28 rounded bg-muted animate-pulse" />
          </div>
          <div className="mt-1.5 h-[11px] rounded-md bg-muted animate-pulse" />
        </div>
      ))}
    </div>

    {/* USD strip */}
    <div className="mt-auto flex items-center gap-3 border-t border-border-soft pt-3.5">
      <div className="h-5 w-10 rounded-full bg-muted/70 animate-pulse" />
      <div className="h-4 w-24 rounded bg-muted animate-pulse" />
      <div className="ml-auto h-3 w-44 rounded bg-muted/70 animate-pulse" />
    </div>
  </div>
)

export const MonthBalanceSkeleton = async () => {
  const t = await getTranslations('dashboard')
  return (
    <Card
      className="flex flex-col overflow-hidden"
      aria-busy="true"
      aria-label={t('month.loading')}
    >
      <CardHeader className="flex-row items-center justify-between gap-4">
        <span className="h-5 w-40 rounded bg-muted animate-pulse" />
      </CardHeader>

      <CardContent className="flex flex-1 flex-col">
        <MonthBalanceBodySkeleton />
      </CardContent>
    </Card>
  )
}
