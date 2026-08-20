import { Text, type StyleProp, type TextStyle } from 'react-native'
import { formatARS, formatUSD } from '@grana/i18n-messages'
import { useShowCents } from '../../lib/preferences-context'
import { useEyeMask } from './EyeMaskContext'

type Props = {
  amount: number
  currency: 'ARS' | 'USD'
  className?: string
  /** Inline style — used when a value must be computed at runtime (e.g. the
   *  donut centre auto-scales its font size). NativeWind classes can't. */
  style?: StyleProp<TextStyle>
  showCentsOverride?: boolean
  maskChar?: string
  /** Rendered before the number when not masked (e.g. "+" / "−"). */
  signPrefix?: string
}

export const MaskedAmount = ({
  amount,
  currency,
  className,
  style,
  showCentsOverride,
  maskChar = '••••••',
  signPrefix,
}: Props) => {
  const { masked } = useEyeMask()
  const showCents = useShowCents()
  const effectiveShowCents = showCentsOverride ?? showCents

  if (masked) {
    return (
      <Text className={`tabular-nums ${className ?? ''}`} style={style}>
        {maskChar}
      </Text>
    )
  }

  const formatted =
    currency === 'ARS'
      ? formatARS(amount, effectiveShowCents)
      : formatUSD(amount, effectiveShowCents)

  return (
    <Text className={`tabular-nums ${className ?? ''}`} style={style}>
      {signPrefix}
      {formatted}
    </Text>
  )
}
