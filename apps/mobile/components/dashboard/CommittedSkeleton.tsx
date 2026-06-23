import { View } from 'react-native'
import { useT } from '../../lib/locale-context'
import { SkeletonBlock } from '../ui/SkeletonBlock'

// Lives inside the "Comprometido" swap region. Shape-matched to the redesigned
// card: total (label + amount) + two obligation sections (icon + label +
// subtotal, each with a couple of movement rows).
export const CommittedSkeleton = () => {
  const t = useT()
  return (
    <View accessibilityState={{ busy: true }} accessibilityLabel={t('dashboard.committed.loading')}>
      {/* Total a pagar */}
      <View className="flex-row items-center justify-between">
        <SkeletonBlock className="h-3 w-24 rounded" />
        <SkeletonBlock className="h-7 w-32 rounded" />
      </View>

      {/* Two obligation sections */}
      {Array.from({ length: 2 }).map((_, i) => (
        <View key={i} className="mt-4">
          <View className="flex-row items-center gap-2.5 border-b border-border-soft pb-2.5">
            <SkeletonBlock className="h-7 w-7 rounded-lg" />
            <SkeletonBlock className="h-3 flex-1 rounded" />
            <SkeletonBlock className="h-4 w-20 rounded" />
          </View>
          <View className="mt-2 gap-2">
            <SkeletonBlock className="h-3 w-full rounded" />
            <SkeletonBlock className="h-3 w-4/5 rounded" />
          </View>
        </View>
      ))}
    </View>
  )
}
