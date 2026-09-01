import { getTranslations } from 'next-intl/server'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { CommittedBodySkeleton } from './committed-body-skeleton'

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
        <CommittedBodySkeleton />
      </CardContent>
    </Card>
  )
}
