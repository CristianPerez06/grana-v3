import { View } from 'react-native'
import { SkeletonBlock } from '../ui/SkeletonBlock'
import { MovementRowsSkeleton } from './MovementRowsSkeleton'
import { useT } from '../../lib/locale-context'

// Loading skeleton for the account detail. Mirrors `AccountDetailHero` (navy
// card: avatar + name/meta, then the balance label with its ARS amount and the
// USD line) over the `MovementsSection` card (title + month nav, action chips,
// rows). The pale blocks read fine on navy — same treatment as
// `BalanceCardSkeleton`'s navy zone.
//
// It draws the USD line and the "+ Agregar moneda" chip even though both are
// conditional in the real screen: that is the tall case, and falling short
// makes the content below jump up when the account resolves.

const HeroSkeleton = () => (
  <View className="gap-5 rounded-3xl bg-navy p-6">
    <View className="flex-row items-center gap-3">
      <SkeletonBlock className="h-11 w-11 rounded-[10px]" />
      <View className="flex-1 gap-2">
        <SkeletonBlock className="h-[18px] w-2/5 rounded" />
        <SkeletonBlock className="h-3 w-1/2 rounded" />
      </View>
    </View>
    <View>
      <SkeletonBlock className="h-2.5 w-16 rounded" />
      <View className="mt-2">
        <SkeletonBlock className="h-[34px] w-56 rounded" />
      </View>
      <View className="mt-1">
        <SkeletonBlock className="h-4 w-28 rounded" />
      </View>
    </View>
  </View>
)

const MovementsCardSkeleton = () => (
  <View className="gap-3 rounded-[18px] border border-border bg-card p-5">
    <View className="flex-row items-center justify-between gap-2">
      <SkeletonBlock className="h-4 w-28 rounded" />
      <SkeletonBlock className="h-8 w-36 rounded-lg" />
    </View>
    <View className="flex-row flex-wrap items-center gap-2">
      <SkeletonBlock className="h-7 w-24 rounded-full" />
      <SkeletonBlock className="h-7 w-32 rounded-full" />
      <SkeletonBlock className="h-7 w-20 rounded-full" />
    </View>
    <MovementRowsSkeleton />
  </View>
)

export const AccountDetailSkeleton = () => {
  const t = useT()
  return (
    <View
      accessibilityState={{ busy: true }}
      accessibilityLabel={t('accounts.route.detail_loading')}
      className="gap-5"
    >
      <HeroSkeleton />
      <SkeletonBlock className="h-9 w-40 self-start rounded-full" />
      <MovementsCardSkeleton />
    </View>
  )
}
