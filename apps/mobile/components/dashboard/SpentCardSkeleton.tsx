import { View } from 'react-native'
import { SkeletonBlock } from '../ui/SkeletonBlock'

/** Same fixed height as `SpentTile`, so the row does not change when it resolves. */
const TILE_HEIGHT = 150

/** Mirror of `SpentTile`'s front face: icon, label, amount, USD line and caption. */
const TileSkeleton = () => (
  <View
    style={{ height: TILE_HEIGHT }}
    className="flex-1 overflow-hidden rounded-2xl border border-border bg-card"
  >
    <View className="flex-1 items-center px-2 pt-2.5">
      <SkeletonBlock className="size-8 rounded-xl" />
      <View className="mt-2">
        <SkeletonBlock className="h-3 w-14 rounded" />
      </View>
      <View className="mt-1.5">
        <SkeletonBlock className="h-[15px] w-16 rounded" />
      </View>
      <View className="mt-0.5">
        <SkeletonBlock className="h-2.5 w-12 rounded" />
      </View>
      {/* The same fixed-height slot the caption and the flip invitation share. */}
      <View className="mt-2 items-center gap-1" style={{ minHeight: 26 }}>
        <SkeletonBlock className="h-2.5 w-16 rounded" />
        <SkeletonBlock className="h-2.5 w-12 rounded" />
      </View>
    </View>
    {/* The accent rule at the foot, which carries the tile's tone in the real card. */}
    <SkeletonBlock className="h-1 w-full" />
  </View>
)

/**
 * Shape-matched skeleton for the BODY of "Cuánto gastaste": the three tiles in a
 * row and the pace strip under them.
 *
 * Replaces `SpendingSkeleton`, the leftover from the retired "En qué se fue" — a
 * 150px ring and five legend rows — which kept anticipating a section that no
 * longer exists while the card rendered something else entirely.
 *
 * Body only: the card header (title and link to Movimientos) is rendered by
 * `SpentCard` from the first paint, because it does not depend on the read
 * (spec `dashboard`).
 */
export const SpentCardSkeleton = () => (
  <>
    <View className="mt-3 flex-row gap-2">
      <TileSkeleton />
      <TileSkeleton />
      <TileSkeleton />
    </View>

    {/* Pace strip: ring, label, bar and foot. */}
    <View className="mt-3 flex-row items-center gap-3 rounded-2xl border border-border bg-page p-3.5">
      <SkeletonBlock className="size-[46px] rounded-full" />
      <View className="min-w-0 flex-1">
        <SkeletonBlock className="h-3 w-40 rounded" />
        <View className="mt-2">
          <SkeletonBlock className="h-1.5 w-full rounded-full" />
        </View>
        <View className="mt-1.5">
          <SkeletonBlock className="h-2.5 w-48 rounded" />
        </View>
      </View>
    </View>
  </>
)
