import { Text } from 'react-native'
import { formatARS, formatUSD } from '@grana/i18n-messages'
import { useShowCents } from '../../lib/preferences-context'
import { useEyeMask } from './EyeMaskContext'

type Props = {
  amount: number
  currency: 'ARS' | 'USD'
  /** Styles for the headline number (integer part + symbol). */
  className?: string
  /** Styles for the decimal part (smaller/dimmer); RN has no `em`, so the
   *  caller passes the reduced size explicitly. */
  decimalClassName?: string
  /** Rendered before the number when not masked (e.g. "+"). */
  signPrefix?: string
}

/**
 * Display-size variant of `MaskedAmount` for headline numbers (Hero, Balance
 * del mes) — mirror of the web component: the decimal part renders smaller and
 * dimmer via a nested `Text`. Respects the show-cents preference and the
 * eye-mask like its sibling.
 */
export const MaskedAmountDisplay = ({
  amount,
  currency,
  className,
  decimalClassName,
  signPrefix,
}: Props) => {
  const { masked } = useEyeMask()
  const showCents = useShowCents()

  if (masked) {
    return <Text className={`tabular-nums ${className ?? ''}`}>••••••</Text>
  }

  const formatted =
    currency === 'ARS' ? formatARS(amount, showCents) : formatUSD(amount, showCents)

  // es-AR formatting uses "," as the decimal separator; everything after the
  // last comma is the cents part.
  const commaIndex = formatted.lastIndexOf(',')
  const integerPart = commaIndex === -1 ? formatted : formatted.slice(0, commaIndex)
  const decimalPart = commaIndex === -1 ? null : formatted.slice(commaIndex)

  return (
    <Text className={`tabular-nums ${className ?? ''}`}>
      {signPrefix}
      {integerPart}
      {decimalPart && (
        <Text className={`tabular-nums ${decimalClassName ?? ''}`}>{decimalPart}</Text>
      )}
    </Text>
  )
}
