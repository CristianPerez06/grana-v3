import { View } from 'react-native'
import { useT } from '../../lib/locale-context'
import { SkeletonBlock } from '../ui/SkeletonBlock'

const SKELETON_LEGEND_ROWS = 5

// Lives inside the "En qué se fue" swap region: a ring placeholder + legend
// rows (dot + label + amount + %).
export const SpendingSkeleton = () => {
  const t = useT()
  return (
    <View
      accessibilityState={{ busy: true }}
      accessibilityLabel={t('dashboard.spending.loading')}
      className="items-center gap-6"
    >
      <SkeletonBlock className="h-[150px] w-[150px] rounded-full" />
      <View className="w-full gap-3">
        {Array.from({ length: SKELETON_LEGEND_ROWS }).map((_, i) => (
          <View key={i} className="flex-row items-center gap-2.5">
            <SkeletonBlock className="h-2.5 w-2.5 rounded-[3px]" />
            <View className="flex-1">
              <SkeletonBlock className="h-3.5 w-28 rounded" />
            </View>
            <SkeletonBlock className="h-3.5 w-20 rounded" />
            <SkeletonBlock className="h-3 w-[34px] rounded" />
          </View>
        ))}
      </View>
    </View>
  )
}
