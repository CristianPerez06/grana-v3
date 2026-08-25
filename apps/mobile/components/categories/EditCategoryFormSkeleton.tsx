import { View } from 'react-native'
import { SkeletonBlock } from '../ui/SkeletonBlock'
import { useT } from '../../lib/locale-context'

// Loading skeleton for `/settings/categories/[id]/edit` while the category
// resolves. Mirrors `EditCategoryForm`: name field, the read-only type box, the
// icon and color fields, and the submit button.

const FieldSkeleton = () => (
  <View className="flex-col gap-1.5">
    <SkeletonBlock className="h-3.5 w-24 rounded" />
    <SkeletonBlock className="h-11 w-full rounded-lg" />
  </View>
)

export const EditCategoryFormSkeleton = () => {
  const t = useT()
  return (
    <View
      accessibilityState={{ busy: true }}
      accessibilityLabel={t('settings.categories.route.form_loading')}
      className="flex-col gap-4"
    >
      <FieldSkeleton />

      <View className="flex-col gap-1.5">
        <SkeletonBlock className="h-3.5 w-16 rounded" />
        <View className="rounded-xl border border-border-soft bg-card px-3 py-2">
          <SkeletonBlock className="h-5 w-24 rounded" />
        </View>
      </View>

      <FieldSkeleton />
      <FieldSkeleton />

      <SkeletonBlock className="h-11 w-full rounded-xl" />
    </View>
  )
}
