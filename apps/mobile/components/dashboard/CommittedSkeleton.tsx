import { View } from 'react-native'
import { SkeletonBlock } from '../ui/SkeletonBlock'

/** Tarjetas y Gastos fijos: los dos grupos que la card siempre ofrece. */
const GROUP_ROWS = 2

/**
 * Skeleton shape-matched del **cuerpo** de "Compromisos del próximo mes": el
 * resumen con su total y su barra apilada, y las dos filas de grupo.
 *
 * Cubre solo el cuerpo: la card, el título, el mes y "Ver todos" los renderiza
 * `CommittedSection` desde el primer paint. Antes este componente reemplazaba a
 * la card entera —sin borde, sin fondo y sin encabezado— y el chrome aparecía de
 * golpe al resolver.
 *
 * Dibuja la línea USD y la leyenda de la barra aunque la card las condicione:
 * es el caso alto, y quedarse corto hace saltar la pantalla al resolver.
 */
export const CommittedSkeleton = () => (
  <View className="mt-3">
    {/* Resumen: rótulo, total, línea USD, barra apilada y leyenda. */}
    <View className="rounded-2xl border border-border bg-page p-3.5">
      <SkeletonBlock className="h-2.5 w-24 rounded" />
      <View className="mt-1">
        <SkeletonBlock className="h-7 w-40 rounded" />
      </View>
      <View className="mt-1">
        <SkeletonBlock className="h-3 w-24 rounded" />
      </View>
      <View className="mt-3">
        <SkeletonBlock className="h-2 w-full rounded-full" />
      </View>
      <View className="mt-2 flex-row gap-x-4">
        {Array.from({ length: 2 }).map((_, item) => (
          <View key={item} className="flex-row items-center gap-1.5">
            <SkeletonBlock className="size-2 rounded-[2px]" />
            <SkeletonBlock className="h-3 w-20 rounded" />
          </View>
        ))}
      </View>
    </View>

    {/* Las dos filas de grupo, con su área táctil de 44px. */}
    <View className="mt-3 gap-2.5">
      {Array.from({ length: GROUP_ROWS }).map((_, row) => (
        <View
          key={row}
          style={{ minHeight: 44 }}
          className="flex-row items-center gap-3 rounded-2xl border border-border px-3 py-2.5"
        >
          <SkeletonBlock className="size-8 rounded-xl" />
          <View className="min-w-0 flex-1 gap-1">
            <SkeletonBlock className="h-3 w-24 rounded" />
            <SkeletonBlock className="h-2.5 w-32 rounded" />
          </View>
          <View className="items-end gap-1">
            <SkeletonBlock className="h-3.5 w-20 rounded" />
            <SkeletonBlock className="h-2.5 w-12 rounded" />
          </View>
          <SkeletonBlock className="size-[15px] rounded" />
        </View>
      ))}
    </View>
  </View>
)
