import { getTranslations } from 'next-intl/server'
import { Card, CardContent, CardHeader } from '@/components/ui/card'

const ROWS_PER_GROUP = 2

const Row = () => (
  <li className="-mx-2 flex items-baseline justify-between gap-3 px-2 py-1.5">
    <div className="flex min-w-0 items-baseline gap-2">
      <span className="h-3 w-10 rounded bg-muted/70 animate-pulse" />
      <span className="h-3.5 w-32 rounded bg-muted animate-pulse" />
    </div>
    <span className="h-3.5 w-16 shrink-0 rounded bg-muted animate-pulse" />
  </li>
)

const Group = () => (
  <div className="flex flex-col gap-3">
    <span className="h-3 w-20 rounded bg-muted animate-pulse" />
    <ul className="flex flex-col gap-2">
      {Array.from({ length: ROWS_PER_GROUP }).map((_, i) => (
        <Row key={i} />
      ))}
    </ul>
    <div className="mt-1 border-t border-border-soft pt-2">
      <div className="flex justify-between">
        <span className="h-3 w-10 rounded bg-muted/70 animate-pulse" />
        <span className="h-3 w-20 rounded bg-muted animate-pulse" />
      </div>
    </div>
  </div>
)

export const UpcomingFortnightSkeleton = async () => {
  const t = await getTranslations('dashboard')
  return (
    <Card
      className="h-full min-h-[20rem]"
      aria-busy="true"
      aria-label={t('upcoming.loading')}
    >
      <CardHeader className="flex-row items-baseline justify-between">
        <span className="h-5 w-32 rounded bg-muted animate-pulse" />
        <span className="h-3 w-24 rounded bg-muted/70 animate-pulse" />
      </CardHeader>

      <CardContent>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-1">
          <Group />
          <Group />
        </div>

        <div className="mt-6 border-t border-border-soft pt-4">
          <span className="h-3 w-28 rounded bg-muted animate-pulse" />
          <div className="mt-2 h-6 w-40 rounded bg-muted animate-pulse" />
        </div>
      </CardContent>
    </Card>
  )
}
