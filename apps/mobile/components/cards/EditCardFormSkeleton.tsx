import { View } from 'react-native'
import { SkeletonBlock } from '../ui/SkeletonBlock'
import { useT } from '../../lib/locale-context'

// Loading skeleton for `/cards/[id]/edit` while the card, the institutions and
// the networks resolve. Mirrors `EditCardForm`: name, bank, the network row with
// its badge, the current-period date pair, credit limit, submit, and the
// secondary archive/delete actions at the bottom.
export const EditCardFormSkeleton = () => {
  const t = useT()
  return (
    <View
      accessibilityState={{ busy: true }}
      accessibilityLabel={t('cards.route.form_loading')}
      className="flex-col gap-5"
    >
      <View className="flex-col gap-1.5">
        <SkeletonBlock className="h-3 w-12 rounded" />
        <SkeletonBlock className="h-11 w-full rounded-lg" />
      </View>

      <View className="flex-col gap-1.5">
        <SkeletonBlock className="h-3 w-16 rounded" />
        <SkeletonBlock className="h-11 w-full rounded-lg" />
      </View>

      <View className="flex-col gap-1.5">
        <SkeletonBlock className="h-3 w-14 rounded" />
        <SkeletonBlock className="h-9 w-28 rounded-xl" />
      </View>

      <View className="flex-col gap-2.5">
        <SkeletonBlock className="h-3 w-32 rounded" />
        <View className="flex-row gap-3">
          <SkeletonBlock className="h-11 flex-1 rounded-lg" />
          <SkeletonBlock className="h-11 flex-1 rounded-lg" />
        </View>
      </View>

      <View className="flex-col gap-1.5">
        <SkeletonBlock className="h-3 w-24 rounded" />
        <SkeletonBlock className="h-11 w-full rounded-lg" />
      </View>

      <SkeletonBlock className="h-11 w-full rounded-xl" />

      <View className="flex-col gap-3">
        <SkeletonBlock className="h-11 w-full rounded-xl" />
        <SkeletonBlock className="h-11 w-full rounded-xl" />
      </View>
    </View>
  )
}
