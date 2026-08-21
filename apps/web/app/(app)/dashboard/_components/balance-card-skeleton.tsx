import { getTranslations } from 'next-intl/server'
import { Card } from '@/components/ui/card'
import {
  HeroAmountSkeleton,
  HeroUsdSkeleton,
  PlacementGridSkeleton,
  SUMMARY_ALIGN,
  SummaryAmountSkeleton,
} from './balance-card-body-skeleton'
import { cn } from '@/lib/utils'

/** Espejo de `Flow`: fila (label izquierda, monto derecha) en angosto, columna en `sm`. */
const FlowSkeleton = ({ align }: { align: keyof typeof SUMMARY_ALIGN }) => (
  <div
    className={cn(
      'flex items-center justify-between gap-3 sm:flex-col sm:justify-start',
      SUMMARY_ALIGN[align],
    )}
  >
    <span className="flex shrink-0 items-center gap-[9px]">
      <span className="size-[9px] animate-pulse rounded-full bg-muted" />
      <span className="h-4 w-16 animate-pulse rounded bg-muted/70" />
    </span>
    <span className={cn('flex min-w-0 flex-col items-end sm:mt-2.5 sm:w-full', SUMMARY_ALIGN[align])}>
      <SummaryAmountSkeleton />
    </span>
  </div>
)

export const BalanceCardSkeleton = async () => {
  const t = await getTranslations('dashboard')
  return (
    <Card className="overflow-hidden p-0" aria-busy="true" aria-label={t('hero_loading')}>
      {/* Zona oscura — saldo, línea USD y "Dónde está" plegado adentro. */}
      <div className="bg-surface-dark px-[22px] pb-5 pt-6 text-center">
        <div className="mx-auto h-3.5 w-40 animate-pulse rounded bg-white/15" />
        <HeroAmountSkeleton />
        <HeroUsdSkeleton />

        {/* Encabezado de "Dónde está": el rótulo con "ARS" a su derecha, "USD"
            sobre la segunda columna, y el link anclado al borde de la card. Los
            dos rótulos de moneda desaparecen al apilarse, como en la card. */}
        <div className="relative mt-[18px]">
          <div className="mx-auto grid max-w-[660px] grid-cols-1 items-end gap-4 border-t border-white/10 pt-[15px] sm:grid-cols-2">
            <span className="flex items-baseline justify-between gap-2">
              <span className="h-3.5 w-24 animate-pulse rounded bg-white/10" />
              <span className="hidden h-3.5 w-8 animate-pulse rounded bg-white/10 sm:block" />
            </span>
            <span className="hidden pl-[15px] sm:block">
              <span className="block h-3.5 w-8 animate-pulse rounded bg-white/10" />
            </span>
          </div>
          <div className="absolute bottom-0 right-0 h-3.5 w-[104px] animate-pulse rounded bg-white/10" />
        </div>

        {/* Columnas de cuentas: apiladas con divisor horizontal en angosto, lado
            a lado con divisor vertical desde `sm`. */}
        <div className="mx-auto mt-3 grid max-w-[660px] grid-cols-1 gap-3 text-left sm:grid-cols-2 sm:gap-4">
          <PlacementGridSkeleton />
        </div>
      </div>

      {/* Resumen del mes — tres bloques: filas apiladas en angosto, tercios en `sm`. */}
      <div className="border-t border-border px-[26px] pb-[18px] pt-4">
        <div className="h-6 w-40 animate-pulse rounded bg-muted" />
        <div className="mt-3 flex flex-col gap-3 sm:grid sm:grid-cols-3 sm:gap-[18px]">
          <FlowSkeleton align="start" />
          <FlowSkeleton align="center" />
          <FlowSkeleton align="end" />
        </div>
      </div>
    </Card>
  )
}
