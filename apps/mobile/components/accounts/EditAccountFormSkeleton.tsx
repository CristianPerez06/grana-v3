import { View } from 'react-native'
import { SkeletonBlock } from '../ui/SkeletonBlock'
import { useT } from '../../lib/locale-context'

// Loading skeleton for `/accounts/[id]/edit` while the account and the
// institutions catalog resolve. Mirrors `EditAccountForm`: institution selector,
// name field, the read-only initial-balance box with its two currency rows and
// hint, and the submit button.
export const EditAccountFormSkeleton = () => {
  const t = useT()
  return (
    <View
      accessibilityState={{ busy: true }}
      accessibilityLabel={t('accounts.route.form_loading')}
      className="flex-col gap-5"
    >
      <View className="flex-col gap-1.5">
        <SkeletonBlock className="h-3 w-16 rounded" />
        <SkeletonBlock className="h-11 w-full rounded-lg" />
      </View>

      <View className="flex-col gap-1.5">
        <SkeletonBlock className="h-3 w-12 rounded" />
        <SkeletonBlock className="h-11 w-full rounded-lg" />
      </View>

      {/* Read-only initial balance */}
      <View className="flex-col gap-1.5">
        <SkeletonBlock className="h-3 w-24 rounded" />
        <View className="flex-col gap-2 rounded-lg border border-border-soft bg-border-soft px-3 py-3">
          <View className="flex-row items-center justify-between">
            <SkeletonBlock className="h-2.5 w-8 rounded" />
            <SkeletonBlock className="h-3.5 w-20 rounded" />
          </View>
          <View className="flex-row items-center justify-between">
            <SkeletonBlock className="h-2.5 w-8 rounded" />
            <SkeletonBlock className="h-3.5 w-20 rounded" />
          </View>
        </View>
        <SkeletonBlock className="h-2.5 w-3/5 rounded" />
      </View>

      <SkeletonBlock className="h-11 w-full rounded-xl" />
    </View>
  )
}
