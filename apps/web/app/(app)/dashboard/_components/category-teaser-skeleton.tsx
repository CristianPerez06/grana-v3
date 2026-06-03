import { getTranslations } from 'next-intl/server'
import { Card, CardContent, CardHeader } from '@/components/ui/card'

const ROWS = 3

const Row = () => (
  <li className="flex items-center gap-2">
    <span className="min-w-0 flex-1 h-3.5 rounded bg-muted animate-pulse" />
    <span className="h-1.5 w-20 shrink-0 rounded-full bg-muted animate-pulse" />
    <span className="h-3 w-9 shrink-0 rounded bg-muted/70 animate-pulse" />
  </li>
)

export const CategoryTeaserSkeleton = async () => {
  const t = await getTranslations('dashboard')
  return (
    <Card
      className="min-h-[8rem]"
      aria-busy="true"
      aria-label={t('spending.loading')}
    >
      <CardHeader className="flex-row items-center justify-between gap-2">
        <span className="h-4 w-32 rounded bg-muted animate-pulse" />
        <span className="h-3 w-20 rounded bg-muted/70 animate-pulse" />
      </CardHeader>

      <CardContent>
        <ul className="flex flex-col gap-2">
          {Array.from({ length: ROWS }).map((_, i) => (
            <Row key={i} />
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}
