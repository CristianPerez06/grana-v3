import { View } from 'react-native'
import { SkeletonBlock } from '../ui/SkeletonBlock'
import { useT } from '../../lib/locale-context'

// Loading skeleton for the periods list. Mirrors `PeriodRow`: date range with
// its status pill and the "vence" line on the left, the period total (plus the
// USD line) on the right, rows split by a top border inside one card.

const RowSkeleton = ({ isFirst }: { isFirst?: boolean }) => (
  <View
    className={`flex-row items-center gap-3 px-4 py-3 ${
      isFirst ? '' : 'border-t border-border-soft'
    }`}
  >
    <View className="flex-1 gap-1.5">
      <View className="flex-row items-center gap-2">
        <SkeletonBlock className="h-3.5 w-32 rounded" />
        <SkeletonBlock className="h-5 w-16 rounded-full" />
      </View>
      <SkeletonBlock className="h-2.5 w-24 rounded" />
    </View>
    <View className="items-end gap-1">
      <SkeletonBlock className="h-3.5 w-20 rounded" />
      <SkeletonBlock className="h-2.5 w-14 rounded" />
    </View>
  </View>
)

export const PeriodListSkeleton = () => {
  const t = useT()
  return (
    <View
      accessibilityState={{ busy: true }}
      accessibilityLabel={t('cards.route.periods_loading')}
      className="overflow-hidden rounded-2xl border border-border bg-card"
    >
      {Array.from({ length: 4 }).map((_, i) => (
        <RowSkeleton key={i} isFirst={i === 0} />
      ))}
    </View>
  )
}
