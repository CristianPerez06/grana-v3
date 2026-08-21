import { View } from 'react-native'
import { SkeletonBlock } from '../ui/SkeletonBlock'

/** Tarjetas and Gastos fijos: the two groups the card always offers. */
const GROUP_ROWS = 2

/**
 * Shape-matched skeleton for the BODY of "Compromisos del próximo mes": the
 * summary with its total and stacked bar, and the two group rows.
 *
 * Body only: the card, the title, the month and "Ver todos" are rendered by
 * `CommittedSection` from the first paint. This component used to replace the
 * WHOLE card — no border, no background, no header — so the chrome appeared all
 * at once when the read resolved.
 *
 * It draws the USD line and the bar legend even though the card makes both
 * conditional: that is the tall case, and falling short makes the screen jump
 * when it resolves.
 */
export const CommittedSkeleton = () => (
  <View className="mt-3">
    {/* Summary: label, total, USD line, stacked bar and legend. */}
    <View className="rounded-2xl border border-border bg-page p-3.5">
      <SkeletonBlock className="h-2.5 w-24 rounded" />
      <View className="mt-1">
        <SkeletonBlock className="h-7 w-40 rounded" />
      </View>
      <View className="mt-1">
        <SkeletonBlock className="h-3 w-24 rounded" />
      </View>
      <View className="mt-3">
        <SkeletonBlock className="h-2 w-full rounded-full" />
      </View>
      <View className="mt-2 flex-row gap-x-4">
        {Array.from({ length: 2 }).map((_, item) => (
          <View key={item} className="flex-row items-center gap-1.5">
            <SkeletonBlock className="size-2 rounded-[2px]" />
            <SkeletonBlock className="h-3 w-20 rounded" />
          </View>
        ))}
      </View>
    </View>

    {/* The two group rows, with their 44px touch target. */}
    <View className="mt-3 gap-2.5">
      {Array.from({ length: GROUP_ROWS }).map((_, row) => (
        <View
          key={row}
          style={{ minHeight: 44 }}
          className="flex-row items-center gap-3 rounded-2xl border border-border px-3 py-2.5"
        >
          <SkeletonBlock className="size-8 rounded-xl" />
          <View className="min-w-0 flex-1 gap-1">
            <SkeletonBlock className="h-3 w-24 rounded" />
            <SkeletonBlock className="h-2.5 w-32 rounded" />
          </View>
          <View className="items-end gap-1">
            <SkeletonBlock className="h-3.5 w-20 rounded" />
            <SkeletonBlock className="h-2.5 w-12 rounded" />
          </View>
          <SkeletonBlock className="size-[15px] rounded" />
        </View>
      ))}
    </View>
  </View>
)
