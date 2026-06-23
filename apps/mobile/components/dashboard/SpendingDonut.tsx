import { Text, View } from 'react-native'
import Svg, { Circle } from 'react-native-svg'
import type { CategorySlice } from '@grana/money-logic'
import { formatARS, formatUSD } from '@grana/i18n-messages'
import { catPalette, colors } from '../../lib/colors'
import { donutAmountFontSize } from '../../lib/donut-amount'
import { useShowCents } from '../../lib/preferences-context'
import { MaskedAmount } from './MaskedAmount'

export const sliceColor = (slice: CategorySlice, index: number): string =>
  slice.color ?? catPalette[index % catPalette.length]

type Props = {
  slices: CategorySlice[]
  /** Month total for the active currency, shown in the donut centre. */
  total: number
  currency: 'ARS' | 'USD'
  centerLabel: string
  size?: number
}

// SVG stroke-circle donut — mirror of the web SpendingDonut: each slice is a
// circle arc whose sweep/offset derive from the data (r=15.915 makes the
// circumference ≈100, so percentages map directly to dash lengths). The centre
// overlay shows the label + masked total.
export const SpendingDonut = ({ slices, total, currency, centerLabel, size = 150 }: Props) => {
  const showCents = useShowCents()
  // Auto-scale the centre amount so large totals don't overlap the ring.
  const formattedTotal =
    currency === 'ARS' ? formatARS(total, showCents) : formatUSD(total, showCents)
  const amountFontSize = donutAmountFontSize(formattedTotal, size, 17)
  return (
    <View style={{ width: size, height: size }}>
      <Svg viewBox="0 0 36 36" width={size} height={size}>
        <Circle
          cx="18"
          cy="18"
          r="15.915"
          fill="none"
          stroke={colors.borderSoft}
          strokeWidth="4"
        />
        {slices.map((s, i) => (
          <Circle
            key={s.categoryId ?? `otros-${i}`}
            cx="18"
            cy="18"
            r="15.915"
            fill="none"
            stroke={sliceColor(s, i)}
            strokeWidth="4"
            strokeDasharray={`${s.percentage} ${100 - s.percentage}`}
            strokeDashoffset={-s.offset}
            transform="rotate(-90 18 18)"
          />
        ))}
      </Svg>
      <View className="absolute inset-0 items-center justify-center gap-0.5">
        <Text className="text-[10px] font-extrabold uppercase text-text-soft">
          {centerLabel}
        </Text>
        <MaskedAmount
          amount={total}
          currency={currency}
          className="font-extrabold text-text"
          style={{ fontSize: amountFontSize, lineHeight: amountFontSize }}
        />
      </View>
    </View>
  )
}
