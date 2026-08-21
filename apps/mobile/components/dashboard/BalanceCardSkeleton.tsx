import { View } from 'react-native'
import { useT } from '../../lib/locale-context'
import { SkeletonBlock } from '../ui/SkeletonBlock'

/** Las dos cuentas top por moneda, que es lo que `derivePlacement` devuelve. */
const PLACEMENT_ROWS = 2

/** Mismo alto de la swap region que la card real, para que no salte al resolver. */
const SWAP_MIN_HEIGHT = 84

/** Espejo de `PlacementColumn`: gutter de moneda + filas dot / nombre / %. */
export const PlacementSkeleton = () => (
  <View className="flex-row gap-3">
    <SkeletonBlock className="h-3 w-8 rounded" />
    <View className="min-w-0 flex-1 gap-2">
      {Array.from({ length: PLACEMENT_ROWS }).map((_, row) => (
        <View key={row} className="flex-row items-center gap-2">
          <SkeletonBlock className="size-[9px] rounded-[2px]" />
          {/* El nombre es el que se estira: es lo que empuja el % al borde. */}
          <View className="min-w-0 flex-1">
            <SkeletonBlock className="h-3.5 rounded" />
          </View>
          <SkeletonBlock className="h-3.5 w-8 rounded" />
        </View>
      ))}
    </View>
  </View>
)

/**
 * El importe de un `Flow` y su línea USD. El rótulo con su dot NO entra acá: no
 * depende de la lectura y se sigue renderizando real mientras el mes carga.
 */
export const SummaryAmountSkeleton = () => (
  <View className="min-w-0 flex-1 items-end">
    <SkeletonBlock className="h-5 w-28 rounded" />
    <View className="mt-0.5">
      <SkeletonBlock className="h-2.5 w-16 rounded" />
    </View>
  </View>
)

/** Importe del hero y su línea USD, centrados como en la card. */
export const HeroAmountSkeleton = () => (
  <View className="items-center">
    <SkeletonBlock className="h-[34px] w-56 rounded" />
    <View className="mt-3 flex-row items-center gap-2.5">
      <SkeletonBlock className="h-[22px] w-11 rounded-full" />
      <SkeletonBlock className="h-4 w-24 rounded" />
    </View>
  </View>
)

/** Las dos columnas de moneda con su divisor, tal como las apila la card. */
export const PlacementStackSkeleton = () => (
  <View className="mt-3 gap-3">
    <PlacementSkeleton />
    <View className="border-t border-white/10 pt-3">
      <PlacementSkeleton />
    </View>
  </View>
)

/** Espejo de `Flow`: label a la izquierda, monto (y su línea USD) a la derecha. */
const FlowSkeleton = () => (
  <View className="flex-row items-center justify-between gap-3">
    <View className="flex-row items-center gap-1.5">
      <SkeletonBlock className="size-[7px] rounded-full" />
      <SkeletonBlock className="h-3 w-16 rounded" />
    </View>
    <SummaryAmountSkeleton />
  </View>
)

/**
 * Skeleton shape-matched de "Saldo disponible total" en nativo.
 *
 * Un solo skeleton para la card completa —zona navy, "Dónde está" y "Resumen
 * del mes"— aunque las zonas vengan de dos lecturas: comparten card, y llenarlas
 * por separado la hace armarse a saltos (spec `dashboard`). Reemplaza al
 * `HeroSkeleton`, que cubría solo el importe del hero y dejaba el resto de la
 * card en ceros mientras cargaba.
 *
 * El eyebrow, el importe y la línea USD van **centrados**, como en la card: la
 * zona navy real es `text-center` de punta a punta y el skeleton anterior los
 * dibujaba pegados a la izquierda.
 *
 * Dibuja la línea USD y la segunda columna de moneda aunque la card las
 * condicione a que haya dólares: es el caso alto, y quedarse corto hace saltar
 * la pantalla hacia abajo al resolver.
 */
export const BalanceCardSkeleton = () => {
  const t = useT()
  return (
    <View
      accessibilityState={{ busy: true }}
      accessibilityLabel={t('dashboard.hero_loading')}
      className="overflow-hidden rounded-2xl border border-border bg-card"
    >
      {/* Zona navy */}
      <View className="bg-navy px-[18px] pb-[17px] pt-5">
        <View className="items-center">
          <SkeletonBlock className="h-3 w-40 rounded" />
        </View>

        <View style={{ minHeight: SWAP_MIN_HEIGHT }} className="justify-center">
          <HeroAmountSkeleton />
        </View>

        {/* "Dónde está" + el link a cuentas */}
        <View className="mt-4 flex-row items-end justify-between border-t border-white/10 pt-3.5">
          <SkeletonBlock className="h-3 w-24 rounded" />
          <SkeletonBlock className="h-3.5 w-24 rounded" />
        </View>

        {/* Columnas de cuentas, apiladas con divisor entre monedas. */}
        <PlacementStackSkeleton />
      </View>

      {/* Zona clara — "Resumen del mes" */}
      <View className="px-4 pb-4 pt-3">
        <SkeletonBlock className="h-4 w-40 rounded" />
        <View className="mt-3 gap-2.5">
          <FlowSkeleton />
          <FlowSkeleton />
          <FlowSkeleton />
        </View>
      </View>
    </View>
  )
}
