import { getTranslations } from 'next-intl/server'
import { Card, CardContent } from '@/components/ui/card'

const MAX_BREAKDOWN_ACCOUNTS = 3

export const HeroSkeleton = async () => {
  const t = await getTranslations('dashboard')
  return (
    <Card className="min-h-[10rem]" aria-busy="true" aria-label={t('hero_loading')}>
      <CardContent className="pt-6">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="lg:flex-1">
            <div className="h-3 w-20 rounded bg-muted animate-pulse" />
            <div className="mt-2 h-10 w-44 rounded bg-muted animate-pulse" />
            <div className="mt-2 h-3.5 w-24 rounded bg-muted/70 animate-pulse" />
          </div>

          <div className="hidden lg:flex lg:w-72 lg:shrink-0 lg:flex-col lg:gap-3 lg:border-l lg:border-border-soft lg:pl-6">
            <ul className="flex flex-col gap-2">
              {Array.from({ length: MAX_BREAKDOWN_ACCOUNTS }).map((_, i) => (
                <li key={i} className="flex items-center justify-between gap-4">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="size-6 shrink-0 rounded-md bg-muted animate-pulse" />
                    <span className="h-3 w-24 rounded bg-muted animate-pulse" />
                  </span>
                  <span className="h-3.5 w-20 shrink-0 rounded bg-muted animate-pulse" />
                </li>
              ))}
            </ul>
            <span className="h-3 w-36 rounded bg-muted/70 animate-pulse" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
