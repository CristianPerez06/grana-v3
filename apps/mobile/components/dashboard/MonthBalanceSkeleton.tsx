import { View } from 'react-native'
import { useT } from '../../lib/locale-context'
import { SkeletonBlock } from '../ui/SkeletonBlock'

// Lives inside the "Balance del mes" swap region: eyebrow + big net, two flow
// rows (label/amount + bar) and the USD strip.
export const MonthBalanceSkeleton = () => {
  const t = useT()
  return (
    <View
      accessibilityState={{ busy: true }}
      accessibilityLabel={t('dashboard.month.loading')}
    >
      <SkeletonBlock className="h-3 w-16 rounded" />
      <View className="mt-2">
        <SkeletonBlock className="h-9 w-48 rounded" />
      </View>

      <View className="mt-5 gap-3.5">
        {Array.from({ length: 2 }).map((_, i) => (
          <View key={i}>
            <View className="flex-row items-center justify-between gap-3">
              <SkeletonBlock className="h-3.5 w-24 rounded" />
              <SkeletonBlock className="h-3.5 w-28 rounded" />
            </View>
            <View className="mt-1.5">
              <SkeletonBlock className="h-[11px] w-full rounded-md" />
            </View>
          </View>
        ))}
      </View>

      <View className="mt-5 flex-row items-center gap-3 border-t border-border-soft pt-3.5">
        <SkeletonBlock className="h-5 w-10 rounded-full" />
        <SkeletonBlock className="h-4 w-24 rounded" />
        <View className="ml-auto">
          <SkeletonBlock className="h-3 w-36 rounded" />
        </View>
      </View>
    </View>
  )
}
