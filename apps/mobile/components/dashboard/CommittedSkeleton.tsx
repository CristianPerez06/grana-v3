import { View } from 'react-native'
import { useT } from '../../lib/locale-context'
import { SkeletonBlock } from '../ui/SkeletonBlock'

// Lives inside the "Comprometido" swap region: total + two outflow tiles + USD strip.
export const CommittedSkeleton = () => {
  const t = useT()
  return (
    <View accessibilityState={{ busy: true }} accessibilityLabel={t('dashboard.committed.loading')}>
      <SkeletonBlock className="h-3 w-24 rounded" />
      <SkeletonBlock className="mt-2 h-8 w-44 rounded" />
      <View className="mt-5 gap-3">
        {Array.from({ length: 2 }).map((_, i) => (
          <View key={i} className="gap-2 rounded-2xl border border-border p-4">
            <SkeletonBlock className="h-8 w-8 rounded-lg" />
            <SkeletonBlock className="h-3 w-20 rounded" />
            <SkeletonBlock className="h-5 w-24 rounded" />
          </View>
        ))}
      </View>
      <View className="mt-5 flex-row items-center gap-3 border-t border-border-soft pt-3.5">
        <SkeletonBlock className="h-5 w-10 rounded-full" />
        <SkeletonBlock className="h-4 w-24 rounded" />
      </View>
    </View>
  )
}
