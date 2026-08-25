import { View } from 'react-native'
import { SkeletonBlock } from '../ui/SkeletonBlock'
import { MovementListSkeleton } from '../movements/MovementListSkeleton'
import { useT } from '../../lib/locale-context'

// Loading skeleton for a statement detail. Mirrors the screen: the date range
// with its status pill over the "vence" line, the amount card (total + USD
// line), the pay CTA, and the movements block — whose rows reuse
// `MovementListSkeleton`, the same skeleton the real `MovementList` resolves to.
export const PeriodDetailSkeleton = () => {
  const t = useT()
  return (
    <View
      accessibilityState={{ busy: true }}
      accessibilityLabel={t('cards.route.period_loading')}
      className="flex-col gap-5"
    >
      <View className="flex-col gap-1.5">
        <View className="flex-row items-center gap-2">
          <SkeletonBlock className="h-4 w-40 rounded" />
          <SkeletonBlock className="h-5 w-16 rounded-full" />
        </View>
        <SkeletonBlock className="h-3.5 w-32 rounded" />
      </View>

      <View className="flex-col gap-1.5 rounded-2xl border border-border bg-card p-4">
        <SkeletonBlock className="h-8 w-48 rounded" />
        <SkeletonBlock className="h-3.5 w-28 rounded" />
      </View>

      <SkeletonBlock className="h-11 w-full rounded-xl" />

      <View className="flex-col gap-3">
        <SkeletonBlock className="h-3 w-36 rounded" />
        <View className="overflow-hidden rounded-2xl border border-border bg-card">
          <MovementListSkeleton />
        </View>
      </View>
    </View>
  )
}
