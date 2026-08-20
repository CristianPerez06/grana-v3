import { Text, View } from 'react-native'
import { MaskedAmount } from './MaskedAmount'

type Props = {
  label: string
  amount: number
  currency: 'ARS' | 'USD'
}

/** One listed commitment inside a group panel: name on the left, amount right. */
export const CommittedRow = ({ label, amount, currency }: Props) => (
  <View className="flex-row items-center justify-between gap-3 border-t border-border-soft py-[7px]">
    <Text numberOfLines={1} className="flex-1 text-[12px] font-semibold text-text-muted">
      {label}
    </Text>
    <MaskedAmount
      amount={amount}
      currency={currency}
      showCentsOverride={currency === 'USD'}
      className="text-[12px] font-extrabold text-text"
    />
  </View>
)
