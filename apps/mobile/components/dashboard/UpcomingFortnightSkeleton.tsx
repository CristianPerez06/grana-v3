import { View } from 'react-native'
import { useT } from '../../lib/locale-context'
import { SkeletonBlock } from '../ui/SkeletonBlock'

const ROWS_PER_GROUP = 2

const Row = () => (
  <View className="flex-row items-baseline justify-between gap-3 py-1.5">
    <View className="min-w-0 flex-row items-baseline gap-2">
      <SkeletonBlock className="h-3 w-10 rounded" />
      <SkeletonBlock className="h-3.5 w-32 rounded" />
    </View>
    <SkeletonBlock className="h-3.5 w-16 rounded" />
  </View>
)

const Group = () => (
  <View className="flex-col gap-3">
    <SkeletonBlock className="h-3 w-20 rounded" />
    <View className="flex-col gap-2">
      {Array.from({ length: ROWS_PER_GROUP }).map((_, i) => (
        <Row key={i} />
      ))}
    </View>
    <View className="mt-1 border-t border-border-soft pt-2">
      <View className="flex-row justify-between">
        <SkeletonBlock className="h-3 w-10 rounded" />
        <SkeletonBlock className="h-3 w-20 rounded" />
      </View>
    </View>
  </View>
)

export const UpcomingFortnightSkeleton = () => {
  const t = useT()
  return (
    <View
      accessibilityState={{ busy: true }}
      accessibilityLabel={t('dashboard.upcoming.loading')}
      className="flex-col gap-6"
    >
      <Group />
      <Group />
      <View className="border-t border-border-soft pt-4">
        <SkeletonBlock className="h-3 w-28 rounded" />
        <View className="mt-2">
          <SkeletonBlock className="h-6 w-40 rounded" />
        </View>
      </View>
    </View>
  )
}
