import { View } from 'react-native'
import { detailColors } from './format'

/**
 * Installment progress dots: paid in accent, the next one in faded accent, future
 * ones in border-gray. `paid` = installments already paid; the next is `paid + 1`.
 */
type Props = {
  paid: number
  total: number
  accent: string
}

export const CuotaProgressDots = ({ paid, total, accent }: Props) => (
  <View className="flex-row flex-wrap gap-1.5">
    {Array.from({ length: total }, (_, i) => {
      const n = i + 1
      const isPaid = n <= paid
      const isNext = n === paid + 1
      // `${accent}66` ≈ 40% alpha, matching the web `color-mix(... 40%)` next dot.
      const backgroundColor = isPaid ? accent : isNext ? `${accent}66` : detailColors.border
      return <View key={n} className="h-2 w-2 rounded-full" style={{ backgroundColor }} />
    })}
  </View>
)
