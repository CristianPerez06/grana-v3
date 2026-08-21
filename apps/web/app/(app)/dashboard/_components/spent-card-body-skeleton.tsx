import { cn } from '@/lib/utils'

/**
 * Cuerpo de "Cuánto gastaste" mientras carga: los tres tiles y la tira de ritmo.
 *
 * Vive aparte de `spent-card-skeleton.tsx` porque lo consumen dos lados con
 * requisitos opuestos: el fallback del `<Suspense>` (server component, que trae
 * el encabezado real) y la rama de carga de la card client cuando el usuario
 * cambia de mes. Ese archivo importa `next-intl/server`, así que no puede
 * entrar en un módulo client.
 *
 * Espeja `SpentTile` y `PaceStrip`: alto mínimo del tile, franja de acento al
 * pie, y la tira con su anillo, su barra y su pie.
 */
export const SpentCardBodySkeleton = () => (
  <>
    <div className="grid flex-1 grid-cols-3 gap-2 sm:gap-[11px]">
      {[0, 1, 2].map((tile) => (
        <div
          key={tile}
          className="flex h-full min-h-[184px] flex-col overflow-hidden rounded-2xl border border-border bg-card"
        >
          <div className="flex flex-1 flex-col items-center justify-center px-1 py-3.5">
            <div className="size-8 animate-pulse rounded-xl bg-muted sm:size-9" />
            <div className="mt-2.5 h-3 w-14 animate-pulse rounded bg-muted/70" />
            <div className="mt-2 h-[19px] w-16 max-w-full animate-pulse rounded bg-muted" />
            <div className="mt-[3px] h-2.5 w-12 animate-pulse rounded bg-muted/70" />
            {/* El mismo slot de alto fijo que llevan la bajada y la invitación a
                girar, para que el tile mida igual con y sin datos. */}
            <div className="mt-3 flex min-h-[30px] flex-col items-center gap-1 sm:min-h-[32px]">
              <div className="h-2.5 w-16 animate-pulse rounded bg-muted/70" />
              <div className="h-2.5 w-12 animate-pulse rounded bg-muted/70" />
            </div>
          </div>
          <div className={cn('h-1 w-full animate-pulse bg-muted')} />
        </div>
      ))}
    </div>

    <div className="flex items-center gap-4 rounded-2xl border border-border bg-surface-sunken p-4">
      <div className="size-[54px] shrink-0 animate-pulse rounded-full bg-muted" />
      <div className="min-w-0 flex-1">
        <div className="h-4 w-44 max-w-full animate-pulse rounded bg-muted/70" />
        <div className="mt-2 h-[7px] w-full animate-pulse rounded-[5px] bg-muted" />
        <div className="mt-1.5 h-3 w-56 max-w-full animate-pulse rounded bg-muted/70" />
      </div>
    </div>
  </>
)
