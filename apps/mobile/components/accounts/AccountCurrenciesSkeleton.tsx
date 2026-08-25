import { View } from 'react-native'
import { SkeletonBlock } from '../ui/SkeletonBlock'
import { useT } from '../../lib/locale-context'

// Loading skeleton for `/accounts/[id]/currency` while the account resolves.
// Mirrors the screen's two cards: "add currency" (title, currency toggle, label
// + amount, button) and the deactivate card with a row per active currency.
// The add card is conditional in the real screen — drawing it is the tall case,
// so the second card does not jump upwards when the account lands.
export const AccountCurrenciesSkeleton = () => {
  const t = useT()
  return (
    <View
      accessibilityState={{ busy: true }}
      accessibilityLabel={t('accounts.route.detail_loading')}
      className="gap-6"
    >
      <View className="gap-3 rounded-[18px] border border-border bg-card p-5">
        <SkeletonBlock className="h-4 w-36 rounded" />
        <View className="flex-row gap-2">
          <SkeletonBlock className="h-10 flex-1 rounded-xl" />
          <SkeletonBlock className="h-10 flex-1 rounded-xl" />
        </View>
        <View className="gap-1.5">
          <SkeletonBlock className="h-3 w-40 rounded" />
          <SkeletonBlock className="h-11 w-full rounded-lg" />
        </View>
        <SkeletonBlock className="h-11 w-full rounded-xl" />
      </View>

      <View className="gap-3 rounded-[18px] border border-border bg-card p-5">
        <SkeletonBlock className="h-4 w-32 rounded" />
        <View className="flex-row items-center justify-between">
          <SkeletonBlock className="h-3.5 w-24 rounded" />
          <SkeletonBlock className="h-8 w-20 rounded-lg" />
        </View>
        <View className="flex-row items-center justify-between">
          <SkeletonBlock className="h-3.5 w-24 rounded" />
          <SkeletonBlock className="h-8 w-20 rounded-lg" />
        </View>
      </View>
    </View>
  )
}
