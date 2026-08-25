import { View } from 'react-native'
import { SkeletonBlock } from '../ui/SkeletonBlock'
import { useT } from '../../lib/locale-context'

// Loading skeleton for `/accounts/new` while the institutions catalog resolves.
// Mirrors `CreateAccountForm`: identity preview card, institution selector, name
// field, the two initial-balance amounts with their hint, and the submit button.
export const CreateAccountFormSkeleton = () => {
  const t = useT()
  return (
    <View
      accessibilityState={{ busy: true }}
      accessibilityLabel={t('accounts.route.form_loading')}
      className="flex-col gap-5"
    >
      {/* Identity preview */}
      <View className="flex-row items-center gap-3 rounded-[18px] border border-border bg-card p-4">
        <SkeletonBlock className="h-11 w-11 rounded-[10px]" />
        <View className="flex-1 gap-2">
          <SkeletonBlock className="h-4 w-2/5 rounded" />
          <SkeletonBlock className="h-3 w-3/5 rounded" />
        </View>
      </View>

      {/* Institution */}
      <View className="flex-col gap-1.5">
        <SkeletonBlock className="h-3 w-16 rounded" />
        <SkeletonBlock className="h-11 w-full rounded-lg" />
      </View>

      {/* Name */}
      <View className="flex-col gap-1.5">
        <SkeletonBlock className="h-3 w-12 rounded" />
        <SkeletonBlock className="h-11 w-full rounded-lg" />
      </View>

      {/* Initial balance: ARS + USD + hint */}
      <View className="flex-col gap-2.5">
        <SkeletonBlock className="h-3 w-24 rounded" />
        <View className="flex-col gap-1.5">
          <SkeletonBlock className="h-2.5 w-8 rounded" />
          <SkeletonBlock className="h-11 w-full rounded-lg" />
        </View>
        <View className="flex-col gap-1.5">
          <SkeletonBlock className="h-2.5 w-8 rounded" />
          <SkeletonBlock className="h-11 w-full rounded-lg" />
        </View>
        <SkeletonBlock className="h-2.5 w-4/5 rounded" />
      </View>

      <SkeletonBlock className="h-11 w-full rounded-xl" />
    </View>
  )
}
