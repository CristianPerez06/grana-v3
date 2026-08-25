import { View } from 'react-native'
import { SkeletonBlock } from '../ui/SkeletonBlock'

// Rows of the account movements list, shaped like `MovementRow` (primary line +
// meta line on the left, signed amount on the right, rows split by a top
// border). Bleeds out of the card padding with `-mx-5`, exactly as the real
// list does. No accessibility node of its own: the caller owns the busy state.
export const MovementRowsSkeleton = ({ rows = 4 }: { rows?: number }) => (
  <View className="-mx-5">
    {Array.from({ length: rows }).map((_, i) => (
      <View
        key={i}
        className={`flex-row items-center gap-3 px-[18px] py-[13px] ${
          i === 0 ? '' : 'border-t border-border-soft'
        }`}
      >
        <View className="min-w-0 flex-1 gap-2">
          <SkeletonBlock className="h-3.5 w-3/5 rounded" />
          <SkeletonBlock className="h-2.5 w-2/5 rounded" />
        </View>
        <SkeletonBlock className="h-3.5 w-20 rounded" />
      </View>
    ))}
  </View>
)
