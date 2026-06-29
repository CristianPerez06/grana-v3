import { getTranslations } from 'next-intl/server'
import { Card, CardContent, CardHeader } from '@/components/ui/card'

const SKELETON_GRID_CELLS = 4

// Shape-matched skeleton for the dashboard top row: the dark "Para gastar"
// card on the left and the "Dónde está" accounts card on the right (stacked
// below lg, like the real grid).
export const HeroSkeleton = async () => {
  const t = await getTranslations('dashboard')
  return (
    <div
      className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-[1.15fr_1fr]"
      aria-busy="true"
      aria-label={t('hero_loading')}
    >
      {/* Para gastar · hoy */}
      <Card className="flex min-h-[13rem] flex-col border-transparent bg-surface-dark">
        <CardContent className="flex flex-1 flex-col p-6">
          <div className="flex flex-1 flex-col justify-center">
            <div className="h-3 w-32 rounded bg-white/15 animate-pulse" />
            <div className="mt-3 h-10 w-52 rounded bg-white/20 animate-pulse" />
            <div className="mt-3 flex items-center gap-2">
              <div className="h-5 w-10 rounded-full bg-white/15 animate-pulse" />
              <div className="h-4 w-24 rounded bg-white/15 animate-pulse" />
            </div>
          </div>
          <div className="h-3 w-64 max-w-full rounded bg-white/10 animate-pulse" />
        </CardContent>
      </Card>

      {/* Dónde está */}
      <Card className="flex min-h-[13rem] flex-col">
        <CardHeader className="flex-col items-start gap-1 pb-1 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
          <span className="h-4 w-24 rounded bg-muted animate-pulse" />
          <span className="h-3.5 w-16 rounded bg-muted/70 animate-pulse" />
        </CardHeader>
        <CardContent className="flex flex-1 flex-col gap-4">
          {/* Concentration callout */}
          <div className="flex items-center gap-3">
            <span className="h-11 w-20 rounded bg-muted animate-pulse" />
            <span className="h-3.5 w-32 rounded bg-muted/70 animate-pulse" />
          </div>
          {/* Concentration bar */}
          <span className="h-4 w-full rounded-[7px] bg-muted animate-pulse" />
          {/* Compact grid */}
          <div className="mt-auto grid grid-cols-1 gap-x-5 gap-y-2.5 sm:grid-cols-2">
            {Array.from({ length: SKELETON_GRID_CELLS }).map((_, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="size-2 shrink-0 rounded-[3px] bg-muted animate-pulse" />
                <span className="h-3 w-20 rounded bg-muted animate-pulse" />
                <span className="ml-auto h-3 w-16 shrink-0 rounded bg-muted/70 animate-pulse" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
