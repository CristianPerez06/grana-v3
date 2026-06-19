import { getTranslations } from 'next-intl/server'
import { Card, CardContent, CardHeader } from '@/components/ui/card'

// Shape-matched placeholder for "Comprometido": title + total + two outflow tiles + USD strip.
export const CommittedSkeleton = async () => {
  const t = await getTranslations('dashboard.committed')
  return (
    <Card className="flex min-h-[15rem] flex-col" aria-busy="true" aria-label={t('loading')}>
      <CardHeader className="gap-0.5">
        <span className="h-5 w-36 rounded bg-muted animate-pulse" />
        <span className="mt-1 h-3 w-44 rounded bg-muted/70 animate-pulse" />
      </CardHeader>

      <CardContent className="flex flex-1 flex-col">
        <div className="h-3 w-24 rounded bg-muted/70 animate-pulse" />
        <div className="mt-2 h-8 w-44 rounded bg-muted animate-pulse" />

        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-2 rounded-2xl border border-border p-4">
              <span className="size-8 rounded-lg bg-muted animate-pulse" />
              <span className="h-3 w-20 rounded bg-muted/70 animate-pulse" />
              <span className="h-5 w-24 rounded bg-muted animate-pulse" />
            </div>
          ))}
        </div>

        <div className="mt-auto flex items-center gap-3 border-t border-border-soft pt-3.5">
          <div className="h-5 w-10 rounded-full bg-muted/70 animate-pulse" />
          <div className="h-4 w-24 rounded bg-muted animate-pulse" />
        </div>
      </CardContent>
    </Card>
  )
}
