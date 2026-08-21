import { View } from 'react-native'
import { useT } from '../../lib/locale-context'
import { SkeletonBlock } from '../ui/SkeletonBlock'

/** The two top accounts per currency, which is what `derivePlacement` returns. */
const PLACEMENT_ROWS = 2

/** Same swap-region height as the real card, so nothing jumps when it resolves. */
const SWAP_MIN_HEIGHT = 84

/** Mirror of `PlacementColumn`: currency gutter + dot / name / % rows. */
export const PlacementSkeleton = () => (
  <View className="flex-row gap-3">
    <SkeletonBlock className="h-3 w-8 rounded" />
    <View className="min-w-0 flex-1 gap-2">
      {Array.from({ length: PLACEMENT_ROWS }).map((_, row) => (
        <View key={row} className="flex-row items-center gap-2">
          <SkeletonBlock className="size-[9px] rounded-[2px]" />
          {/* The name is what stretches: it is what pushes the % to the edge. */}
          <View className="min-w-0 flex-1">
            <SkeletonBlock className="h-3.5 rounded" />
          </View>
          <SkeletonBlock className="h-3.5 w-8 rounded" />
        </View>
      ))}
    </View>
  </View>
)

/**
 * A `Flow`'s amount and its USD line. The label with its dot is NOT in here: it
 * does not depend on the read and keeps rendering for real while the month loads.
 */
export const SummaryAmountSkeleton = () => (
  <View className="min-w-0 flex-1 items-end">
    <SkeletonBlock className="h-5 w-28 rounded" />
    <View className="mt-0.5">
      <SkeletonBlock className="h-2.5 w-16 rounded" />
    </View>
  </View>
)

/** Hero amount and its USD line, centred as they are in the card. */
export const HeroAmountSkeleton = () => (
  <View className="items-center">
    <SkeletonBlock className="h-[34px] w-56 rounded" />
    <View className="mt-3 flex-row items-center gap-2.5">
      <SkeletonBlock className="h-[22px] w-11 rounded-full" />
      <SkeletonBlock className="h-4 w-24 rounded" />
    </View>
  </View>
)

/** The two currency columns with their divider, stacked as the card stacks them. */
export const PlacementStackSkeleton = () => (
  <View className="mt-3 gap-3">
    <PlacementSkeleton />
    <View className="border-t border-white/10 pt-3">
      <PlacementSkeleton />
    </View>
  </View>
)

/** Mirror of `Flow`: label on the left, amount (and its USD line) on the right. */
const FlowSkeleton = () => (
  <View className="flex-row items-center justify-between gap-3">
    <View className="flex-row items-center gap-1.5">
      <SkeletonBlock className="size-[7px] rounded-full" />
      <SkeletonBlock className="h-3 w-16 rounded" />
    </View>
    <SummaryAmountSkeleton />
  </View>
)

/**
 * Shape-matched skeleton for "Saldo disponible total" on native.
 *
 * ONE skeleton for the whole card — navy zone, "Dónde está" and "Resumen del
 * mes" — even though the zones come from two reads: they share a card, and
 * filling them in separately makes it assemble in jumps (spec `dashboard`).
 * Replaces `HeroSkeleton`, which covered only the hero amount and left the rest
 * of the card rendering zeros while it loaded.
 *
 * The eyebrow, the amount and the USD line are CENTRED, as they are in the card:
 * the real navy zone is `text-center` end to end, and the previous skeleton drew
 * them flush left.
 *
 * It draws the USD line and the second currency column even though the card
 * makes both conditional on there being dollars: that is the tall case, and
 * falling short makes the screen jump downwards when it resolves.
 */
export const BalanceCardSkeleton = () => {
  const t = useT()
  return (
    <View
      accessibilityState={{ busy: true }}
      accessibilityLabel={t('dashboard.hero_loading')}
      className="overflow-hidden rounded-2xl border border-border bg-card"
    >
      {/* Navy zone */}
      <View className="bg-navy px-[18px] pb-[17px] pt-5">
        <View className="items-center">
          <SkeletonBlock className="h-3 w-40 rounded" />
        </View>

        <View style={{ minHeight: SWAP_MIN_HEIGHT }} className="justify-center">
          <HeroAmountSkeleton />
        </View>

        {/* "Dónde está" + the accounts link */}
        <View className="mt-4 flex-row items-end justify-between border-t border-white/10 pt-3.5">
          <SkeletonBlock className="h-3 w-24 rounded" />
          <SkeletonBlock className="h-3.5 w-24 rounded" />
        </View>

        {/* Account columns, stacked with a divider between currencies. */}
        <PlacementStackSkeleton />
      </View>

      {/* Light zone — "Resumen del mes" */}
      <View className="px-4 pb-4 pt-3">
        <SkeletonBlock className="h-4 w-40 rounded" />
        <View className="mt-3 gap-2.5">
          <FlowSkeleton />
          <FlowSkeleton />
          <FlowSkeleton />
        </View>
      </View>
    </View>
  )
}
