import { View } from 'react-native'
import { SkeletonBlock } from '../ui/SkeletonBlock'

/** Mismo alto fijo que `SpentTile`, para que la fila no cambie al resolver. */
const TILE_HEIGHT = 150

/** Espejo del frente de `SpentTile`: ícono, rótulo, monto, línea USD y bajada. */
const TileSkeleton = () => (
  <View
    style={{ height: TILE_HEIGHT }}
    className="flex-1 overflow-hidden rounded-2xl border border-border bg-card"
  >
    <View className="flex-1 items-center px-2 pt-2.5">
      <SkeletonBlock className="size-8 rounded-xl" />
      <View className="mt-2">
        <SkeletonBlock className="h-3 w-14 rounded" />
      </View>
      <View className="mt-1.5">
        <SkeletonBlock className="h-[15px] w-16 rounded" />
      </View>
      <View className="mt-0.5">
        <SkeletonBlock className="h-2.5 w-12 rounded" />
      </View>
      {/* El mismo slot de alto fijo que la bajada y la invitación a girar. */}
      <View className="mt-2 items-center gap-1" style={{ minHeight: 26 }}>
        <SkeletonBlock className="h-2.5 w-16 rounded" />
        <SkeletonBlock className="h-2.5 w-12 rounded" />
      </View>
    </View>
    {/* La franja de acento del pie, que en la card real lleva el tono del tile. */}
    <SkeletonBlock className="h-1 w-full" />
  </View>
)

/**
 * Skeleton shape-matched del cuerpo de "Cuánto gastaste": los tres tiles en
 * fila y la tira de ritmo debajo.
 *
 * Reemplaza a `SpendingSkeleton`, que era el sobrante de "En qué se fue" —un
 * anillo de 150px y cinco filas de leyenda— y quedó anticipando una sección dada
 * de baja mientras la card mostraba otra cosa.
 *
 * Cubre solo el cuerpo: el encabezado de la card (título y link a Movimientos)
 * lo renderiza `SpentCard` desde el primer paint, porque no depende de la
 * lectura (spec `dashboard`).
 */
export const SpentCardSkeleton = () => (
  <>
    <View className="mt-3 flex-row gap-2">
      <TileSkeleton />
      <TileSkeleton />
      <TileSkeleton />
    </View>

    {/* Tira de ritmo: anillo, rótulo, barra y pie. */}
    <View className="mt-3 flex-row items-center gap-3 rounded-2xl border border-border bg-page p-3.5">
      <SkeletonBlock className="size-[46px] rounded-full" />
      <View className="min-w-0 flex-1">
        <SkeletonBlock className="h-3 w-40 rounded" />
        <View className="mt-2">
          <SkeletonBlock className="h-1.5 w-full rounded-full" />
        </View>
        <View className="mt-1.5">
          <SkeletonBlock className="h-2.5 w-48 rounded" />
        </View>
      </View>
    </View>
  </>
)
