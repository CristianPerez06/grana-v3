import { View } from 'react-native'
import { SkeletonBlock } from '../../ui/SkeletonBlock'
import { useT } from '../../../lib/locale-context'

// Loading skeleton for the card detail body. Mirrors `CardDetailView` top to
// bottom: lifecycle timeline, the period card (the "a pagar" hero is the tall
// case), the credit-limit panel, the movements/cuotas segmented control, a few
// movement rows and the "ver todos los períodos" link.
//
// The header is NOT part of this: `CardDetailHeader` renders its own placeholder
// title and a disabled edit action from the first paint.

const TimelineSkeleton = () => (
  <View className="flex-row items-center gap-2">
    <SkeletonBlock className="h-12 flex-1 rounded-xl" />
    <SkeletonBlock className="h-12 flex-1 rounded-xl" />
    <SkeletonBlock className="h-12 flex-1 rounded-xl" />
  </View>
)

const PeriodCardSkeleton = () => (
  <View className="gap-3 rounded-2xl border border-border bg-card p-4">
    <View className="flex-row items-center justify-between gap-2">
      <SkeletonBlock className="h-3 w-24 rounded" />
      <SkeletonBlock className="h-5 w-20 rounded-full" />
    </View>
    <SkeletonBlock className="h-8 w-40 rounded" />
    <SkeletonBlock className="h-3 w-2/3 rounded" />
    <SkeletonBlock className="h-11 w-full rounded-xl" />
  </View>
)

const LimitPanelSkeleton = () => (
  <View className="gap-3 rounded-2xl border border-border bg-card p-4">
    <View className="flex-row items-center justify-between gap-2">
      <SkeletonBlock className="h-3 w-20 rounded" />
      <SkeletonBlock className="h-3 w-16 rounded" />
    </View>
    <SkeletonBlock className="h-2 w-full rounded-full" />
    <View className="flex-row items-center justify-between gap-2">
      <SkeletonBlock className="h-2.5 w-24 rounded" />
      <SkeletonBlock className="h-2.5 w-20 rounded" />
    </View>
  </View>
)

const MovementRowSkeleton = ({ isFirst }: { isFirst?: boolean }) => (
  <View
    className={`flex-row items-center gap-2.5 px-4 py-3 ${
      isFirst ? '' : 'border-t border-border-soft'
    }`}
  >
    <SkeletonBlock className="h-9 w-9 rounded-xl" />
    <View className="min-w-0 flex-1 gap-2">
      <SkeletonBlock className="h-3.5 w-2/3 rounded" />
      <SkeletonBlock className="h-2.5 w-1/3 rounded" />
    </View>
    <SkeletonBlock className="h-3.5 w-16 rounded" />
  </View>
)

export const CardDetailSkeleton = () => {
  const t = useT()
  return (
    <View
      accessibilityState={{ busy: true }}
      accessibilityLabel={t('cards.route.detail_loading')}
      className="flex-col gap-5"
    >
      <TimelineSkeleton />
      <PeriodCardSkeleton />
      <LimitPanelSkeleton />
      <SkeletonBlock className="h-10 w-full rounded-xl" />
      <View className="overflow-hidden rounded-2xl border border-border bg-card">
        <MovementRowSkeleton isFirst />
        <MovementRowSkeleton />
        <MovementRowSkeleton />
      </View>
      <SkeletonBlock className="h-11 w-full rounded-xl" />
    </View>
  )
}
