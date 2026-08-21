import { cn } from '@/lib/utils'

/** Las dos cuentas top por moneda, que es lo que `derivePlacement` devuelve. */
export const PLACEMENT_ROWS = 2

/**
 * Espejo de `ALIGN` en `balance-card.tsx`: primero a la izquierda, último a la
 * derecha, el del medio centrado.
 */
export const SUMMARY_ALIGN = {
  start: 'sm:items-start sm:text-left',
  center: 'sm:items-center sm:text-center',
  end: 'sm:items-end sm:text-right',
} as const

/**
 * Piezas del cuerpo de la card de saldo en estado de carga.
 *
 * Viven aparte de `balance-card-skeleton.tsx` porque las consumen dos lados con
 * requisitos opuestos: el fallback del `<Suspense>` (server component, que
 * importa `next-intl/server`) y la card client, que vuelve a cargar cuando el
 * usuario cambia de mes. Un módulo client no puede importar el otro.
 */
export const HeroAmountSkeleton = () => (
  <div className="mx-auto mt-[11px] h-[38px] w-64 max-w-full animate-pulse rounded bg-white/20" />
)

export const HeroUsdSkeleton = () => (
  <div className="mt-[13px] flex items-center justify-center gap-2.5">
    <div className="h-[23px] w-11 animate-pulse rounded-full bg-white/15" />
    <div className="h-4 w-24 animate-pulse rounded bg-white/15" />
  </div>
)

/** Espejo de `PlacementColumn`: gutter de moneda + filas dot / nombre / %. */
export const PlacementSkeleton = () => (
  <div className="flex gap-3 sm:block">
    <span className="h-3.5 w-8 shrink-0 animate-pulse rounded bg-white/15 sm:hidden" />
    <div className="grid min-w-0 flex-1 grid-cols-1 gap-y-2 sm:grid-cols-2 sm:gap-x-5">
      {Array.from({ length: PLACEMENT_ROWS }).map((_, row) => (
        <div key={row} className={cn('flex items-center gap-2', row === 1 && 'sm:justify-end')}>
          <span className="size-[10px] shrink-0 animate-pulse rounded-[2px] bg-white/15" />
          {/* `flex-1` mientras está apilado — igual que el nombre real, que es
              el que empuja el porcentaje contra el borde derecho. */}
          <span className="h-3.5 min-w-0 flex-1 animate-pulse rounded bg-white/15 sm:w-14 sm:flex-none" />
          <span className="h-3.5 w-9 shrink-0 animate-pulse rounded bg-white/10" />
        </div>
      ))}
    </div>
  </div>
)

/** Las dos columnas de moneda con su divisor, tal como las apila la card. */
export const PlacementGridSkeleton = () => (
  <>
    <PlacementSkeleton />
    <div className="border-t border-white/10 pt-3 sm:border-l sm:border-t-0 sm:pl-[15px] sm:pt-0">
      <PlacementSkeleton />
    </div>
  </>
)

/**
 * El monto de un `Flow` y su línea USD. El rótulo con su dot NO entra acá: no
 * depende de la lectura y se sigue renderizando real mientras carga.
 */
export const SummaryAmountSkeleton = () => (
  <>
    <span className="h-4 w-24 max-w-full animate-pulse rounded bg-muted sm:h-[27px] sm:w-32" />
    <span className="mt-[5px] h-3 w-16 animate-pulse rounded bg-muted/70" />
  </>
)
