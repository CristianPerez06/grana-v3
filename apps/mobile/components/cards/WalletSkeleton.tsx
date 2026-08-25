import { View } from 'react-native'
import { SkeletonBlock } from '../ui/SkeletonBlock'
import { useT } from '../../lib/locale-context'

// Loading skeleton for the `Wallet`. Mirrors its default "por banco" mode: the
// segmented control above bank-group cards, each with the two-line group header
// (chevron · dot · bank · total, then the summary line) and its expanded card
// rows (monogram tile · name over the CIERRE/VENCE/USO stats · amount · tone
// dot).

const CardRowSkeleton = ({ isFirst }: { isFirst?: boolean }) => (
  <View
    className={`flex-row items-center gap-3 px-4 py-3 ${
      isFirst ? '' : 'border-t border-border-soft'
    }`}
  >
    <SkeletonBlock className="h-8 w-8 rounded-[9px]" />
    <View className="min-w-0 flex-1">
      <SkeletonBlock className="h-3.5 w-2/5 rounded" />
      <View className="mt-1.5 flex-row items-end gap-3.5">
        <SkeletonBlock className="h-6 w-10 rounded" />
        <SkeletonBlock className="h-6 w-10 rounded" />
        <SkeletonBlock className="h-6 w-10 rounded" />
      </View>
    </View>
    <SkeletonBlock className="h-3.5 w-16 rounded" />
    <SkeletonBlock className="h-2.5 w-2.5 rounded-full" />
  </View>
)

const BankGroupSkeleton = ({ rows }: { rows: number }) => (
  <View className="overflow-hidden rounded-xl border border-border bg-card">
    <View className="flex-row items-center gap-2.5 px-4 py-3">
      <SkeletonBlock className="h-4 w-4 rounded" />
      <View className="min-w-0 flex-1 flex-col gap-1">
        <View className="flex-row items-center gap-2">
          <SkeletonBlock className="h-2.5 w-2.5 rounded-full" />
          <SkeletonBlock className="h-4 flex-1 rounded" />
          <SkeletonBlock className="h-3.5 w-20 rounded" />
        </View>
        <View className="flex-row items-center gap-2">
          <SkeletonBlock className="h-2.5 flex-1 rounded" />
          <SkeletonBlock className="h-5 w-20 rounded-full" />
        </View>
      </View>
    </View>
    <View className="border-t border-border">
      {Array.from({ length: rows }).map((_, i) => (
        <CardRowSkeleton key={i} isFirst={i === 0} />
      ))}
    </View>
  </View>
)

export const WalletSkeleton = () => {
  const t = useT()
  return (
    <View
      accessibilityState={{ busy: true }}
      accessibilityLabel={t('cards.route.wallet_loading')}
      className="flex-col gap-3"
    >
      <SkeletonBlock className="h-10 w-full rounded-xl" />
      <View className="flex-col gap-3">
        <BankGroupSkeleton rows={2} />
        <BankGroupSkeleton rows={1} />
      </View>
    </View>
  )
}
