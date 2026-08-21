import { View } from 'react-native'
import { SkeletonBlock } from '../ui/SkeletonBlock'
import { useT } from '../../lib/locale-context'

// Loading skeleton for `CardsMonthHero`, the navy card of the cards module.
// Mirrors its three stacked zones: "A pagar este mes" (eyebrow + big ARS amount
// + USD pill line), "En curso" above a divider, and "Próximos cierres" with its
// date · card rows. Pale blocks on navy, same treatment as the dashboard hero.
//
// The USD lines are drawn even though the real hero makes them conditional:
// that is the tall case, and falling short makes the wallet below jump upwards.

const UsdLineSkeleton = () => (
  <View className="mt-1 flex-row items-center gap-2">
    <SkeletonBlock className="h-[18px] w-11 rounded-full" />
    <SkeletonBlock className="h-4 w-24 rounded" />
  </View>
)

const NextCloseRowSkeleton = () => (
  <View className="flex-row items-center gap-3">
    <SkeletonBlock className="h-3.5 w-12 rounded" />
    <SkeletonBlock className="h-3.5 flex-1 rounded" />
  </View>
)

export const CardsMonthHeroSkeleton = () => {
  const t = useT()
  return (
    <View
      accessibilityState={{ busy: true }}
      accessibilityLabel={t('cards.route.hero_loading')}
      className="rounded-2xl bg-navy p-6"
    >
      <SkeletonBlock className="h-2.5 w-36 rounded" />
      <View className="mt-2 flex-col gap-1">
        <SkeletonBlock className="h-[38px] w-52 rounded" />
        <UsdLineSkeleton />
      </View>

      <View className="mt-5 border-t border-white/10 pt-4">
        <SkeletonBlock className="h-2.5 w-24 rounded" />
        <View className="mt-1">
          <SkeletonBlock className="h-7 w-40 rounded" />
        </View>
        <UsdLineSkeleton />
        <View className="mt-1.5">
          <SkeletonBlock className="h-3 w-4/5 rounded" />
        </View>
      </View>

      <View className="mt-5 border-t border-white/10 pt-4">
        <SkeletonBlock className="h-2.5 w-32 rounded" />
        <View className="mt-3 flex-col gap-2.5">
          <NextCloseRowSkeleton />
          <NextCloseRowSkeleton />
        </View>
      </View>
    </View>
  )
}
