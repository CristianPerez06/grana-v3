import { View } from 'react-native'
import { SkeletonBlock } from '../../ui/SkeletonBlock'
import { useT } from '../../../lib/locale-context'

// Loading skeleton for the movement detail. Mirrors the anatomy of
// `MovementDetailView` (tone hero card — icon tile, title, big amount, flow line,
// chips row — followed by a stack of tiles) so the screen does not jolt when the
// real data lands. The tone is unknown until the read resolves, so the hero band
// stays neutral (`bg-card`) with pale blocks for contrast, rather than tinted.
// Sits below the always-visible PageHeader, never covering the topbar.

const TileSkeleton = ({ rows }: { rows: number }) => (
  <View className="flex-col gap-3 rounded-2xl border border-border bg-card p-4">
    <SkeletonBlock className="h-4 w-28 rounded" />
    {Array.from({ length: rows }).map((_, i) => (
      <View
        key={i}
        className={`flex-row items-center justify-between ${
          i > 0 ? 'border-t border-border-soft pt-3' : ''
        }`}
      >
        <SkeletonBlock className="h-3.5 w-24 rounded" />
        <SkeletonBlock className="h-3.5 w-16 rounded" />
      </View>
    ))}
  </View>
)

export const MovementDetailSkeleton = () => {
  const t = useT()
  return (
    <View
      accessibilityState={{ busy: true }}
      accessibilityLabel={t('transactions.route.detail_loading')}
      className="flex-col gap-3.5"
    >
      {/* Hero card */}
      <View className="overflow-hidden rounded-3xl border border-border bg-card">
        <View className="items-center px-6 pb-7 pt-8">
          <SkeletonBlock className="mb-3.5 h-[72px] w-[72px] rounded-[22px]" />
          <SkeletonBlock className="h-5 w-44 rounded" />
          <SkeletonBlock className="mt-3 h-11 w-52 rounded-lg" />
          <SkeletonBlock className="mt-2 h-3.5 w-32 rounded" />
        </View>
        {/* Chips row */}
        <View className="flex-row flex-wrap justify-center gap-1.5 border-t border-border px-4 pb-5 pt-4">
          <SkeletonBlock className="h-6 w-24 rounded-full" />
          <SkeletonBlock className="h-6 w-16 rounded-full" />
          <SkeletonBlock className="h-6 w-20 rounded-full" />
        </View>
      </View>

      {/* Tiles */}
      <TileSkeleton rows={2} />
      <TileSkeleton rows={3} />
    </View>
  )
}
