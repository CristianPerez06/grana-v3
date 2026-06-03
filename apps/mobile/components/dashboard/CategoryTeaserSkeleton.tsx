import { View } from 'react-native'
import { useT } from '../../lib/locale-context'
import { SkeletonBlock } from '../ui/SkeletonBlock'

const ROWS = 3

const Row = () => (
  <View className="flex-row items-center gap-2">
    <View className="min-w-0 flex-1">
      <SkeletonBlock className="h-3.5 w-full rounded" />
    </View>
    <SkeletonBlock className="h-1.5 w-20 rounded-full" />
    <SkeletonBlock className="h-3 w-9 rounded" />
  </View>
)

export const CategoryTeaserSkeleton = () => {
  const t = useT()
  return (
    <View
      accessibilityState={{ busy: true }}
      accessibilityLabel={t('dashboard.spending.loading')}
      className="flex-col gap-2"
    >
      {Array.from({ length: ROWS }).map((_, i) => (
        <Row key={i} />
      ))}
    </View>
  )
}
