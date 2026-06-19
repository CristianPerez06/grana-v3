import { View } from 'react-native'
import { useT } from '../../lib/locale-context'
import { SkeletonBlock } from '../ui/SkeletonBlock'

// Lives inside the "Dónde está" swap region: concentration callout + bar +
// compact 2-col grid (shape-matched to the redesigned card).
export const AccountsCardSkeleton = () => {
  const t = useT()
  return (
    <View
      accessibilityState={{ busy: true }}
      accessibilityLabel={t('dashboard.hero_loading')}
      className="gap-4"
    >
      {/* Callout */}
      <View className="flex-row items-center gap-3">
        <SkeletonBlock className="h-11 w-20 rounded" />
        <SkeletonBlock className="h-3.5 w-32 rounded" />
      </View>
      {/* Concentration bar */}
      <SkeletonBlock className="h-4 w-full rounded-[7px]" />
      {/* Compact grid */}
      <View className="flex-row flex-wrap">
        {Array.from({ length: 4 }).map((_, i) => (
          <View key={i} className="w-1/2 flex-row items-center gap-2 py-1.5 pr-3">
            <SkeletonBlock className="h-2 w-2 rounded-[3px]" />
            <SkeletonBlock className="h-3 w-20 rounded" />
            <View className="flex-1" />
            <SkeletonBlock className="h-3 w-12 rounded" />
          </View>
        ))}
      </View>
    </View>
  )
}
