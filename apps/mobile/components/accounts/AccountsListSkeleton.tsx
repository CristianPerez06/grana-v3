import { View } from 'react-native'
import { SkeletonBlock } from '../ui/SkeletonBlock'
import { useT } from '../../lib/locale-context'

// Loading skeleton for the accounts list. Mirrors the anatomy of `AccountSection`
// (uppercase group title + count, then a bordered card whose rows are separated
// by a top border) and of `AccountRow` (44px avatar · name/subtitle · balance ·
// row menu), so the screen does not jolt when the real groups land.

const SkeletonRow = ({ withTopBorder }: { withTopBorder?: boolean }) => (
  <View
    className={`flex-row items-center gap-3 px-[18px] py-[15px] ${
      withTopBorder ? 'border-t border-border-soft' : ''
    }`}
  >
    <SkeletonBlock className="h-11 w-11 rounded-[10px]" />
    <View className="min-w-0 flex-1 gap-2">
      <SkeletonBlock className="h-3.5 w-2/5 rounded" />
      <SkeletonBlock className="h-4 w-1/3 rounded" />
    </View>
    <SkeletonBlock className="h-5 w-5 rounded-full" />
  </View>
)

const SkeletonGroup = ({ rows }: { rows: number }) => (
  <View className="flex-col gap-2.5">
    <View className="flex-row items-baseline gap-2 px-1">
      <SkeletonBlock className="h-3 w-24 rounded" />
      <SkeletonBlock className="h-3 w-4 rounded" />
    </View>
    <View className="overflow-hidden rounded-[18px] border border-border bg-card">
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonRow key={i} withTopBorder={i !== 0} />
      ))}
    </View>
  </View>
)

export const AccountsListSkeleton = () => {
  const t = useT()
  return (
    <View
      accessibilityState={{ busy: true }}
      accessibilityLabel={t('accounts.route.active_loading')}
      className="gap-7"
    >
      <SkeletonGroup rows={2} />
      <SkeletonGroup rows={3} />
    </View>
  )
}
