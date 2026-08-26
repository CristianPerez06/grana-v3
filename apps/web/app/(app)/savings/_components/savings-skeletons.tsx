import { getTranslations } from 'next-intl/server'

/**
 * Shape-matched: la grilla de dos monedas, con su alto reservado.
 *
 * El `min-h` va en el fallback y no en el contenido resuelto — si el contenido
 * es más alto crece, y si es más bajo no queda un hueco permanente.
 */
export const SavingsHeadlineSkeleton = async () => {
  const t = await getTranslations('savings.route')
  return (
    <div
      className="min-h-[9rem] rounded-2xl border border-border-soft bg-card px-[18px] py-4"
      aria-busy="true"
      aria-label={t('headline_loading')}
    >
      <div className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between">
          <span className="h-3 w-24 rounded bg-muted animate-pulse" />
          <span className="h-4 w-32 rounded bg-muted animate-pulse" />
        </div>
        <div className="flex items-baseline justify-between">
          <span className="h-3.5 w-20 rounded bg-muted animate-pulse" />
          <span className="h-6 w-36 rounded bg-muted animate-pulse" />
        </div>
      </div>
    </div>
  )
}

/** Cuatro filas de lista: el caso típico son cinco propósitos más el resto. */
export const SavingsBreakdownSkeleton = async () => {
  const t = await getTranslations('savings.route')
  return (
    <div
      className="mt-5 flex min-h-[12rem] flex-col gap-2"
      aria-busy="true"
      aria-label={t('breakdown_loading')}
    >
      <span className="h-3 w-16 rounded bg-muted animate-pulse" />
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex min-h-[52px] items-center gap-2.5 px-2">
          <span className="size-5 shrink-0 rounded-full bg-muted animate-pulse" />
          <span className="h-3.5 flex-1 rounded bg-muted animate-pulse" />
          <span className="h-3.5 w-24 shrink-0 rounded bg-muted animate-pulse" />
        </div>
      ))}
    </div>
  )
}
