import { getTranslations } from 'next-intl/server'

/**
 * Shape-matched: la card oscura con su zócalo de acciones.
 *
 * Se dibuja OSCURA y no en gris claro: es la pieza que ancla la pantalla, y un
 * placeholder claro que se vuelve oscuro al resolver hace saltar toda la
 * jerarquía a la vista. Lo que pulsa adentro son los dos montos.
 *
 * El `min-h` va en el fallback y no en el contenido resuelto — si el contenido
 * es más alto crece, y si es más bajo no queda un hueco permanente.
 */
export const SavingsHeadlineSkeleton = async () => {
  const t = await getTranslations('savings.route')
  return (
    <div
      className="min-h-[11.5rem] overflow-hidden rounded-3xl shadow-sm"
      aria-busy="true"
      aria-label={t('headline_loading')}
    >
      <div className="bg-surface-dark px-[18px] pb-4 pt-[18px] sm:px-7 sm:pb-[22px] sm:pt-6">
        <span className="block h-3 w-20 animate-pulse rounded bg-navy-soft" />
        <div className="mt-[15px] grid grid-cols-[1fr_1px_1fr] items-start gap-4">
          <span className="block h-7 w-36 animate-pulse rounded bg-navy-soft sm:h-9" />
          <span aria-hidden className="h-full w-px self-stretch bg-navy-border" />
          <span className="block h-7 w-24 animate-pulse rounded bg-navy-soft sm:h-9" />
        </div>
        <span className="mt-[15px] block h-3 w-full max-w-[22rem] animate-pulse rounded bg-navy-soft" />
      </div>
      <div className="grid grid-cols-3 bg-card">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex min-h-12 items-center justify-center sm:min-h-[60px]">
            <span className="h-3 w-16 animate-pulse rounded bg-muted" />
          </div>
        ))}
      </div>
    </div>
  )
}

/** El bloque del resto más cuatro propósitos: el caso típico son cinco. */
export const SavingsBreakdownSkeleton = async () => {
  const t = await getTranslations('savings.route')
  return (
    <div
      className="flex min-h-[19rem] flex-col gap-3 sm:gap-[18px]"
      aria-busy="true"
      aria-label={t('breakdown_loading')}
    >
      {/* Cálido ya en el placeholder: si apareciera gris y virara al resolver,
          el bloque saltaría de «apagado» a «pendiente» a la vista. */}
      <div className="rounded-3xl border border-dashed border-savings-unassigned-border bg-savings-unassigned-bg p-[15px]">
        <div className="flex items-center gap-3">
          <span className="size-10 shrink-0 animate-pulse rounded-full bg-savings-unassigned-deep/15" />
          <span className="h-6 flex-1 animate-pulse rounded bg-savings-unassigned-deep/15" />
        </div>
      </div>
      <div className="flex flex-col gap-2.5">
        <span className="h-4 w-40 animate-pulse rounded bg-muted" />
        <div className="grid grid-cols-1 gap-[9px] sm:grid-cols-[repeat(auto-fill,minmax(330px,1fr))] sm:gap-[11px]">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="flex min-h-[72px] items-center gap-[13px] rounded-2xl border border-border-soft bg-card px-3.5"
            >
              <span className="size-[42px] shrink-0 animate-pulse rounded-xl bg-muted" />
              <span className="h-3.5 flex-1 animate-pulse rounded bg-muted" />
              <span className="h-3.5 w-20 shrink-0 animate-pulse rounded bg-muted" />
            </div>
          ))}
          {/* La card punteada de crear va también acá: es la única que SIEMPRE
              está, así que si faltara, la grilla se movería al resolver. */}
          <div className="min-h-[72px] rounded-2xl border border-dashed border-border" />
        </div>
      </div>
    </div>
  )
}

/** Dos resúmenes plegados: lo único que ocupa alto mientras carga. */
export const SavingsLedgerSkeleton = async () => {
  const t = await getTranslations('savings.route')
  return (
    <div
      className="flex min-h-[5.5rem] flex-col gap-1"
      aria-busy="true"
      aria-label={t('ledger_loading')}
    >
      {Array.from({ length: 2 }).map((_, i) => (
        <div key={i} className="flex min-h-[44px] items-center px-1">
          <span className="h-3 w-52 animate-pulse rounded bg-muted" />
        </div>
      ))}
    </div>
  )
}
