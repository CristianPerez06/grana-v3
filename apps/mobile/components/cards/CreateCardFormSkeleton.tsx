import { View } from 'react-native'
import { SkeletonBlock } from '../ui/SkeletonBlock'
import { useT } from '../../lib/locale-context'

// Loading skeleton for `/cards/new` while the institutions and networks
// catalogs resolve. Mirrors `CreateCardForm` field by field: bank selector,
// network chips, name, the current-period pair of date fields side by side,
// credit limit, and the submit button.
export const CreateCardFormSkeleton = () => {
  const t = useT()
  return (
    <View
      accessibilityState={{ busy: true }}
      accessibilityLabel={t('cards.route.form_loading')}
      className="flex-col gap-5"
    >
      {/* Bank */}
      <View className="flex-col gap-1.5">
        <SkeletonBlock className="h-3 w-16 rounded" />
        <SkeletonBlock className="h-11 w-full rounded-lg" />
      </View>

      {/* Network chips */}
      <View className="flex-col gap-1.5">
        <SkeletonBlock className="h-3 w-12 rounded" />
        <View className="flex-row flex-wrap gap-2">
          <SkeletonBlock className="h-10 w-24 rounded-xl" />
          <SkeletonBlock className="h-10 w-24 rounded-xl" />
          <SkeletonBlock className="h-10 w-20 rounded-xl" />
        </View>
      </View>

      {/* Name */}
      <View className="flex-col gap-1.5">
        <SkeletonBlock className="h-3 w-12 rounded" />
        <SkeletonBlock className="h-11 w-full rounded-lg" />
      </View>

      {/* Current period: close + due */}
      <View className="flex-col gap-2.5">
        <SkeletonBlock className="h-3 w-32 rounded" />
        <View className="flex-row gap-3">
          <SkeletonBlock className="h-11 flex-1 rounded-lg" />
          <SkeletonBlock className="h-11 flex-1 rounded-lg" />
        </View>
      </View>

      {/* Credit limit */}
      <View className="flex-col gap-1.5">
        <SkeletonBlock className="h-3 w-24 rounded" />
        <SkeletonBlock className="h-11 w-full rounded-lg" />
      </View>

      <SkeletonBlock className="h-11 w-full rounded-xl" />
    </View>
  )
}
