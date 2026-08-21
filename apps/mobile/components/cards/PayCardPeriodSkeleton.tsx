import { View } from 'react-native'
import { SkeletonBlock } from '../ui/SkeletonBlock'
import { useT } from '../../lib/locale-context'

// Loading skeleton for `/cards/[id]/periods/[periodId]/pay` while the card, the
// period and the debit accounts resolve. Mirrors `PayCardPeriodForm`: the card
// that holds the amount fields (label + helper + input, three times), the
// divider, the debit-account selector, the date field and the submit button.
//
// The FX field only exists when the period carries USD debt — it is drawn here
// because that is the tall case.

const FieldSkeleton = ({ withHelper }: { withHelper?: boolean }) => (
  <View className="flex-col gap-1.5">
    <SkeletonBlock className="h-3 w-28 rounded" />
    {withHelper && <SkeletonBlock className="h-2.5 w-3/4 rounded" />}
    <SkeletonBlock className="h-11 w-full rounded-lg" />
  </View>
)

export const PayCardPeriodSkeleton = () => {
  const t = useT()
  return (
    <View
      accessibilityState={{ busy: true }}
      accessibilityLabel={t('cards.route.pay_loading')}
      className="flex-col gap-5"
    >
      <View className="flex-col gap-5 rounded-2xl border border-border bg-card p-5">
        <SkeletonBlock className="h-2.5 w-32 rounded" />
        <FieldSkeleton withHelper />
        <FieldSkeleton withHelper />
        <FieldSkeleton withHelper />

        <View className="h-px bg-border" />

        <FieldSkeleton />
        <FieldSkeleton />
      </View>

      <SkeletonBlock className="h-11 w-full rounded-xl" />
    </View>
  )
}
