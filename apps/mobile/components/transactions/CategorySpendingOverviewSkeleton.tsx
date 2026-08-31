import { Text, View } from 'react-native'
import { Card } from '../ui/Card'
import { Segmented } from '../ui/Segmented'
import { SkeletonBlock } from '../ui/SkeletonBlock'
import { useT } from '../../lib/locale-context'

// Matches the real card's donut so the swap is a repaint, not a reflow.
// Expressed as a NativeWind utility because `SkeletonBlock` only takes
// `className` (it drives opacity on an Animated.View and sizes the inner one).
const DONUT_CLASS = 'h-[168px] w-[168px]'

/**
 * Loading state for the "En qué se fue" card.
 *
 * It calques the real card's geometry — eyebrow, mode tabs, donut ring, ranking
 * rows — so the screen does not jolt when the data lands. Two rules from
 * `route-loading-and-errors` are visible here:
 *
 *   - the CHROME is real from the first paint (the eyebrow text and the
 *     Egresos / Ingresos tabs render for real, inert until data arrives), and
 *   - the placeholders have the SHAPE of what is coming — a ring and rows, not
 *     a spinner, which would say "something is loading" and nothing else.
 *
 * "Sin gastos este mes" is the genuine empty state and belongs to the real card,
 * only after the queries resolve with no slices.
 */
export const CategorySpendingOverviewSkeleton = () => {
  const t = useT()

  return (
    <Card className="gap-4 px-4 py-5" accessibilityState={{ busy: true }}>
      <View className="flex-row items-start justify-between gap-3">
        <View className="min-w-0 flex-1 gap-1">
          <Text className="text-[15px] font-extrabold text-text">
            {t('transactions.spending.eyebrow')}
          </Text>
          <SkeletonBlock className="h-3 w-36 rounded bg-border-soft" />
        </View>
      </View>

      {/* Real tabs, inert: the user sees where the control is before it works. */}
      <View pointerEvents="none" className="opacity-60">
        <Segmented
          value="egresos"
          ariaLabel={t('transactions.spending.title')}
          options={[
            { value: 'egresos', label: t('transactions.spending.mode_egresos') },
            { value: 'ingresos', label: t('transactions.spending.mode_ingresos') },
          ]}
          onValueChange={() => {}}
        />
      </View>

      <View className="items-center">
        <SkeletonBlock className={`${DONUT_CLASS} rounded-full bg-border-soft`} />
      </View>

      <View className="gap-3 px-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <View key={i} className="flex-row items-center gap-3">
            <SkeletonBlock className="size-2.5 rounded-full bg-border-soft" />
            <View className="flex-1 gap-1.5">
              <View className="flex-row items-center gap-2">
                <SkeletonBlock className="h-3 flex-1 rounded bg-border-soft" />
                <SkeletonBlock className="h-2.5 w-8 rounded bg-border-soft" />
                <SkeletonBlock className="h-3 w-16 rounded bg-border-soft" />
              </View>
              <SkeletonBlock className="h-1 rounded-full bg-border-soft" />
            </View>
          </View>
        ))}
      </View>
    </Card>
  )
}
