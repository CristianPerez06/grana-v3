import { getTranslations } from 'next-intl/server'
import { Card, CardContent, CardHeader } from '@/components/ui/card'

// Shape-matched placeholder for "Compromisos del próximo mes": title + month,
// the total box with its stacked bar, and the two collapsed group headers.
export const CommittedSkeleton = async () => {
  const t = await getTranslations('dashboard.committed')
  return (
    <Card className="flex min-h-[15rem] flex-col" aria-busy="true" aria-label={t('loading')}>
      <CardHeader className="gap-0.5">
        <span className="h-5 w-52 animate-pulse rounded bg-muted" />
        <span className="mt-1 h-3 w-28 animate-pulse rounded bg-muted/70" />
      </CardHeader>

      <CardContent className="flex flex-1 flex-col gap-3">
        {/* Total + stacked bar */}
        <div className="rounded-2xl border border-border bg-surface-sunken p-4">
          <div className="h-3 w-28 animate-pulse rounded bg-muted/70" />
          <div className="mt-2 h-8 w-44 max-w-full animate-pulse rounded bg-muted" />
          <div className="mt-3 h-[9px] w-full animate-pulse rounded-[5px] bg-muted" />
          <div className="mt-2 flex gap-4">
            <div className="h-3 w-24 animate-pulse rounded bg-muted/70" />
            <div className="h-3 w-28 animate-pulse rounded bg-muted/70" />
          </div>
        </div>

        {/* Two collapsed group headers */}
        {[0, 1].map((group) => (
          <div key={group} className="rounded-2xl border border-border px-3.5 py-3">
            <div className="flex items-center gap-3">
              <span className="size-9 shrink-0 animate-pulse rounded-xl bg-muted" />
              <span className="flex-1 space-y-1.5">
                <span className="block h-3.5 w-24 animate-pulse rounded bg-muted" />
                <span className="block h-3 w-32 animate-pulse rounded bg-muted/70" />
              </span>
              <span className="h-4 w-24 shrink-0 animate-pulse rounded bg-muted" />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
