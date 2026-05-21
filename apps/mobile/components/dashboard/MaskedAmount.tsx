import { Text } from 'react-native'
import { formatARS, formatUSD } from '@grana/i18n-messages'
import { useShowCents } from '../../lib/preferences-context'
import { useEyeMask } from './EyeMaskContext'

type Props = {
  amount: number
  currency: 'ARS' | 'USD'
  className?: string
  showCentsOverride?: boolean
  maskChar?: string
}

export const MaskedAmount = ({
  amount,
  currency,
  className,
  showCentsOverride,
  maskChar = '••••••',
}: Props) => {
  const { masked } = useEyeMask()
  const showCents = useShowCents()
  const effectiveShowCents = showCentsOverride ?? showCents

  if (masked) {
    return <Text className={`tabular-nums ${className ?? ''}`}>{maskChar}</Text>
  }

  const formatted =
    currency === 'ARS'
      ? formatARS(amount, effectiveShowCents)
      : formatUSD(amount, effectiveShowCents)

  return <Text className={`tabular-nums ${className ?? ''}`}>{formatted}</Text>
}
