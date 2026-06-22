import { getTranslations } from 'next-intl/server'
import { Card, CardContent, CardHeader } from '@/components/ui/card'

// Shape-matched placeholder for "Comprometido": title + total + two obligation
// sections (icon + label + subtotal, each with a couple of movement rows).
export const CommittedSkeleton = async () => {
  const t = await getTranslations('dashboard.committed')
  return (
    <Card className="flex min-h-[15rem] flex-col" aria-busy="true" aria-label={t('loading')}>
      <CardHeader className="gap-0.5">
        <span className="h-5 w-36 rounded bg-muted animate-pulse" />
        <span className="mt-1 h-3 w-44 rounded bg-muted/70 animate-pulse" />
      </CardHeader>

      <CardContent className="flex flex-1 flex-col">
        {/* Total a pagar */}
        <div className="flex items-baseline justify-between">
          <div className="h-3 w-24 rounded bg-muted/70 animate-pulse" />
          <div className="h-7 w-32 rounded bg-muted animate-pulse" />
        </div>

        {/* Two obligation sections */}
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="mt-4">
            <div className="flex items-center gap-2.5 border-b border-border-soft pb-2.5">
              <span className="size-7 rounded-lg bg-muted animate-pulse" />
              <span className="h-3 w-40 flex-1 rounded bg-muted/70 animate-pulse" />
              <span className="h-4 w-20 rounded bg-muted animate-pulse" />
            </div>
            <div className="mt-2 space-y-2">
              <span className="block h-3 w-full rounded bg-muted/60 animate-pulse" />
              <span className="block h-3 w-4/5 rounded bg-muted/60 animate-pulse" />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
