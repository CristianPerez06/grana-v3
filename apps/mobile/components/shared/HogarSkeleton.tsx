import { View } from 'react-native'
import { SkeletonBlock } from '../ui/SkeletonBlock'
import { CARD } from './ui'

// Hero-shaped skeleton on the navy surface (the light block reads as translucent
// white over navy, matching the dashboard's HeroSkeleton).
export function HeroSkeleton() {
  return (
    <View className="overflow-hidden rounded-3xl bg-navy p-5">
      <SkeletonBlock className="h-3 w-40 rounded" />
      <View className="mt-3">
        <SkeletonBlock className="h-9 w-52 rounded" />
      </View>
      <View className="mt-3 border-t border-white/10 pt-4">
        <SkeletonBlock className="h-3 w-24 rounded" />
        <View className="mt-3">
          <SkeletonBlock className="h-9 w-44 rounded" />
        </View>
      </View>
      <View className="mt-4 border-t border-white/10 pt-4">
        <SkeletonBlock className="h-2.5 w-full rounded-md" />
        <View className="mt-3 gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <View key={i} className="flex-row items-center gap-2">
              <SkeletonBlock className="h-2.5 w-2.5 rounded-sm" />
              <SkeletonBlock className="h-3.5 flex-1 rounded" />
              <SkeletonBlock className="h-3.5 w-16 rounded" />
            </View>
          ))}
        </View>
      </View>
    </View>
  )
}

// A generic list card skeleton (header + rows), for the recents / ledger.
export function ListCardSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <View className={CARD}>
      <View className="border-b border-border-soft px-4 py-3.5">
        <SkeletonBlock className="h-4 w-40 rounded" />
      </View>
      {Array.from({ length: rows }).map((_, i) => (
        <View
          key={i}
          className={`flex-row items-center gap-3 px-4 py-3 ${i > 0 ? 'border-t border-border-soft' : ''}`}
        >
          <SkeletonBlock className="h-9 w-9 rounded-xl" />
          <View className="flex-1 gap-1.5">
            <SkeletonBlock className="h-3.5 w-32 rounded" />
            <SkeletonBlock className="h-3 w-48 rounded" />
          </View>
          <SkeletonBlock className="h-3.5 w-16 rounded" />
        </View>
      ))}
    </View>
  )
}

// Full skeleton shell for the Hogar home while the household state resolves.
export function HogarHomeSkeleton() {
  return (
    <View className="flex-col gap-4">
      <SkeletonBlock className="h-9 w-full rounded-xl" />
      <HeroSkeleton />
      <ListCardSkeleton />
    </View>
  )
}
