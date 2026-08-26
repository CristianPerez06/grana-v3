import { getTranslations } from 'next-intl/server'

/**
 * Shape-matched al contenido real: la grilla de dos monedas arriba y la lista de
 * propósitos abajo. Un esqueleto que no matchea la forma mueve la página cuando
 * llegan los datos, que es peor que no tenerlo.
 */
export const SavingsOverviewSkeleton = async () => {
  const t = await getTranslations('savings.route')

  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label={t('loading')}>
      <div className="flex flex-col gap-3 rounded-2xl border border-border-soft bg-card p-5">
        <div className="flex items-baseline justify-between">
          <span className="h-3 w-20 rounded bg-muted animate-pulse" />
          <span className="h-4 w-28 rounded bg-muted animate-pulse" />
        </div>
        <div className="flex items-baseline justify-between">
          <span className="h-3.5 w-16 rounded bg-muted animate-pulse" />
          <span className="h-6 w-32 rounded bg-muted animate-pulse" />
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <span className="h-3 w-16 rounded bg-muted animate-pulse" />
        <div className="flex flex-col divide-y divide-border-soft rounded-2xl border border-border-soft bg-card">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex min-h-[52px] items-center gap-3 px-4 py-3">
              <span className="size-5 shrink-0 rounded-full bg-muted animate-pulse" />
              <span className="h-3.5 flex-1 rounded bg-muted animate-pulse" />
              <span className="h-3.5 w-24 shrink-0 rounded bg-muted animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
