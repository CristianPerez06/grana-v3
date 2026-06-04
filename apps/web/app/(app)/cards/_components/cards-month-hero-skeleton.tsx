import { getTranslations } from 'next-intl/server'
import { Card } from '@/components/ui/card'

const UPCOMING_ROWS = 3

export const CardsMonthHeroSkeleton = async () => {
  const t = await getTranslations('cards.route')
  return (
    <Card
      className="min-h-[14rem]"
      aria-busy="true"
      aria-label={t('hero_loading')}
      asChild
    >
      <section className="grid grid-cols-1 gap-0 overflow-hidden md:grid-cols-[1fr_1px_360px]">
        <div className="flex flex-col gap-4 p-7">
          <span className="h-3 w-32 rounded bg-muted animate-pulse" />
          <div className="flex flex-col gap-2">
            <span className="h-12 w-56 rounded bg-muted animate-pulse" />
            <span className="h-6 w-32 rounded bg-muted/70 animate-pulse" />
          </div>
          <span className="mt-1 h-12 w-72 rounded-2xl bg-muted/60 animate-pulse" />
        </div>
        <div className="hidden bg-border md:block" aria-hidden />
        <div className="flex flex-col gap-3 border-t border-border p-7 md:border-t-0">
          <span className="h-3 w-28 rounded bg-muted animate-pulse" />
          <ul className="flex flex-col gap-3">
            {Array.from({ length: UPCOMING_ROWS }).map((_, i) => (
              <li key={i} className="flex items-center gap-3">
                <span className="size-10 shrink-0 rounded-xl bg-muted animate-pulse" />
                <div className="min-w-0 flex-1 flex flex-col gap-1">
                  <span className="h-3.5 w-28 rounded bg-muted animate-pulse" />
                  <span className="h-3 w-20 rounded bg-muted/70 animate-pulse" />
                </div>
                <span className="h-3.5 w-16 shrink-0 rounded bg-muted animate-pulse" />
              </li>
            ))}
          </ul>
        </div>
      </section>
    </Card>
  )
}
