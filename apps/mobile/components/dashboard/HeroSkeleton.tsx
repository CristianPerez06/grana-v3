import { View } from 'react-native'
import { useT } from '../../lib/locale-context'
import { SkeletonBlock } from '../ui/SkeletonBlock'

export const HeroSkeleton = () => {
  const t = useT()
  return (
    <View
      accessibilityState={{ busy: true }}
      accessibilityLabel={t('dashboard.hero_loading')}
    >
      <SkeletonBlock className="h-9 w-44 rounded" />
      <View className="mt-1">
        <SkeletonBlock className="h-3.5 w-24 rounded" />
      </View>
    </View>
  )
}
