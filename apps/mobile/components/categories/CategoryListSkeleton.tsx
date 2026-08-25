import { View } from 'react-native'
import { SkeletonBlock } from '../ui/SkeletonBlock'
import { useT } from '../../lib/locale-context'

// Loading skeleton for the categories list. Mirrors `CategoryList`: two titled
// groups (system and own) whose rows are `CategoryRow` — 42px icon tile, name
// over the subcategory count, and the row action button.

const RowSkeleton = ({ withTopBorder }: { withTopBorder?: boolean }) => (
  <View
    className={`flex-row items-center gap-3 px-[18px] py-[15px] ${
      withTopBorder ? 'border-t border-border-soft' : ''
    }`}
  >
    <SkeletonBlock className="h-[42px] w-[42px] rounded-[14px]" />
    <View className="flex-1 gap-2">
      <SkeletonBlock className="h-3.5 w-2/5 rounded" />
      <SkeletonBlock className="h-3 w-1/4 rounded" />
    </View>
    <SkeletonBlock className="h-9 w-9 rounded-[12px]" />
  </View>
)

const GroupSkeleton = ({ rows }: { rows: number }) => (
  <View className="flex-col gap-2.5">
    <SkeletonBlock className="h-3 w-28 rounded" />
    <View className="overflow-hidden rounded-[18px] border border-border bg-card">
      {Array.from({ length: rows }).map((_, i) => (
        <RowSkeleton key={i} withTopBorder={i !== 0} />
      ))}
    </View>
  </View>
)

export const CategoryListSkeleton = () => {
  const t = useT()
  return (
    <View
      accessibilityState={{ busy: true }}
      accessibilityLabel={t('settings.categories.route.list_loading')}
      className="flex-col gap-[26px]"
    >
      <GroupSkeleton rows={4} />
      <GroupSkeleton rows={2} />
    </View>
  )
}
