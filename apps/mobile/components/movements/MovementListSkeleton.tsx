import { View } from 'react-native'
import { SkeletonBlock } from '../ui/SkeletonBlock'
import { useT } from '../../lib/locale-context'

// Loading skeleton for the global movements feed. Mirrors the anatomy of the
// native `MovementList` (day-group header + rows separated by a top border, each
// row = icon tile · primary/secondary lines · amount) so the screen does not
// jolt when the real data lands. Native twin of web's `MovementListSkeleton`.
// Rendered inside the caller's `bg-card` surface, which the pale skeleton blocks
// need for contrast.

const SkeletonRow = ({ withTopBorder }: { withTopBorder?: boolean }) => (
  <View
    className={`flex-row items-center gap-2.5 px-4 py-3 ${
      withTopBorder ? 'border-t border-border-soft' : ''
    }`}
  >
    <SkeletonBlock className="h-9 w-9 rounded-xl" />
    <View className="min-w-0 flex-1 gap-2">
      <SkeletonBlock className="h-3.5 w-2/3 rounded" />
      <SkeletonBlock className="h-2.5 w-1/3 rounded" />
    </View>
    <SkeletonBlock className="h-3.5 w-16 rounded" />
  </View>
)

const SkeletonDayGroup = ({ rows, withTopBorder }: { rows: number; withTopBorder?: boolean }) => (
  <View className={withTopBorder ? 'mt-3 border-t border-border-soft pt-3' : undefined}>
    <View className="px-4 pb-2">
      <SkeletonBlock className="h-3 w-24 rounded" />
    </View>
    <View className="flex-col">
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonRow key={i} withTopBorder={i !== 0} />
      ))}
    </View>
  </View>
)

export const MovementListSkeleton = () => {
  const t = useT()
  return (
    <View
      accessibilityState={{ busy: true }}
      accessibilityLabel={t('transactions.route.feed_loading')}
      className="flex-col py-1"
    >
      <SkeletonDayGroup rows={3} />
      <SkeletonDayGroup rows={4} withTopBorder />
    </View>
  )
}
