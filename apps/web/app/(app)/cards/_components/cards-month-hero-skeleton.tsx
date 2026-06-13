import { getTranslations } from 'next-intl/server'
import { Card, CardContent } from '@/components/ui/card'

export const CardsMonthHeroSkeleton = async () => {
  const t = await getTranslations('cards.route')
  return (
    <Card
      className="border-transparent bg-surface-dark"
      aria-busy="true"
      aria-label={t('hero_loading')}
    >
      <CardContent className="grid grid-cols-1 gap-0 p-0 md:grid-cols-[1fr_1px_minmax(0,340px)]">
        <div className="flex flex-col gap-3 p-7">
          <span className="h-3 w-32 rounded bg-white/15 animate-pulse" />
          <span className="h-12 w-56 rounded bg-white/15 animate-pulse" />
          <span className="h-5 w-28 rounded bg-white/10 animate-pulse" />
        </div>
        <div className="hidden bg-white/10 md:block" aria-hidden />
        <div className="flex flex-col gap-3 border-t border-white/10 p-7 md:border-t-0">
          <span className="h-3 w-28 rounded bg-white/15 animate-pulse" />
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <span className="h-4 w-10 rounded bg-white/15 animate-pulse" />
              <span className="h-4 w-32 rounded bg-white/10 animate-pulse" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
