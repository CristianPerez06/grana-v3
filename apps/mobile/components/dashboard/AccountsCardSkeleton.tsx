import { View } from 'react-native'
import { useT } from '../../lib/locale-context'
import { SkeletonBlock } from '../ui/SkeletonBlock'

const SKELETON_ACCOUNT_ROWS = 3

// Lives inside the "Dónde está" swap region: account rows (avatar + name +
// amount) and the closing USD row.
export const AccountsCardSkeleton = () => {
  const t = useT()
  return (
    <View
      accessibilityState={{ busy: true }}
      accessibilityLabel={t('dashboard.hero_loading')}
    >
      {Array.from({ length: SKELETON_ACCOUNT_ROWS }).map((_, i) => (
        <View
          key={i}
          className={`flex-row items-center gap-3 py-[11px] ${
            i > 0 ? 'border-t border-border-soft' : ''
          }`}
        >
          <SkeletonBlock className="h-8 w-8 rounded-lg" />
          <View className="flex-1">
            <SkeletonBlock className="h-3.5 w-28 rounded" />
          </View>
          <SkeletonBlock className="h-3.5 w-20 rounded" />
        </View>
      ))}
      <View className="mt-1 flex-row items-center gap-3 border-t border-border-soft pt-3">
        <SkeletonBlock className="h-2.5 w-2.5 rounded-[3px]" />
        <View className="flex-1">
          <SkeletonBlock className="h-3.5 w-24 rounded" />
        </View>
        <SkeletonBlock className="h-3.5 w-20 rounded" />
      </View>
    </View>
  )
}
