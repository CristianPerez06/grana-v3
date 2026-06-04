import { View } from 'react-native'
import { useT } from '../../lib/locale-context'
import { SkeletonBlock } from '../ui/SkeletonBlock'

// Lives inside the navy hero card's swap region: a big block for the ARS
// headline + a chip-and-amount row for the USD line. The light block color
// reads as translucent white over navy, matching the web hero skeleton.
export const HeroSkeleton = () => {
  const t = useT()
  return (
    <View
      accessibilityState={{ busy: true }}
      accessibilityLabel={t('dashboard.hero_loading')}
    >
      <SkeletonBlock className="h-10 w-52 rounded" />
      <View className="mt-3 flex-row items-center gap-2">
        <SkeletonBlock className="h-5 w-10 rounded-full" />
        <SkeletonBlock className="h-4 w-24 rounded" />
      </View>
    </View>
  )
}
