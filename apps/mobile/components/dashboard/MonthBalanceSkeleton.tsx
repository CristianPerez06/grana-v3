import { View } from 'react-native'
import { useT } from '../../lib/locale-context'
import { SkeletonBlock } from '../ui/SkeletonBlock'

export const MonthBalanceSkeleton = () => {
  const t = useT()
  return (
    <View
      accessibilityState={{ busy: true }}
      accessibilityLabel={t('dashboard.month.loading')}
    >
      <View className="mb-3">
        <SkeletonBlock className="h-[200px] w-full rounded-md" />
      </View>
      <View className="mt-4 flex-row flex-wrap items-baseline justify-between gap-3 border-t border-border-soft pt-4">
        <View className="flex-col gap-2">
          <SkeletonBlock className="h-3 w-24 rounded" />
          <SkeletonBlock className="h-6 w-32 rounded" />
        </View>
        <View className="flex-row gap-4">
          <SkeletonBlock className="h-3 w-24 rounded" />
          <SkeletonBlock className="h-3 w-24 rounded" />
        </View>
      </View>
    </View>
  )
}
