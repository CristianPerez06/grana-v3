import { View } from 'react-native'
import { SkeletonBlock } from '../ui/SkeletonBlock'
import { useT } from '../../lib/locale-context'

// Loading skeleton for the subcategories list. Mirrors `SubcategoryList`: one
// card whose rows carry the name on the left and the row action on the right.
export const SubcategoryListSkeleton = () => {
  const t = useT()
  return (
    <View
      accessibilityState={{ busy: true }}
      accessibilityLabel={t('settings.categories.route.subcategories_loading')}
      className="overflow-hidden rounded-[18px] border border-border bg-card"
    >
      {Array.from({ length: 4 }).map((_, i) => (
        <View
          key={i}
          className={`flex-row items-center gap-3 px-[18px] py-[15px] ${
            i === 0 ? '' : 'border-t border-border-soft'
          }`}
        >
          <SkeletonBlock className="h-3.5 flex-1 rounded" />
          <SkeletonBlock className="h-9 w-9 rounded-[12px]" />
        </View>
      ))}
    </View>
  )
}
