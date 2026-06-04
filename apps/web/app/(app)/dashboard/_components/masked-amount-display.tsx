'use client'

import { cn } from '@/lib/utils'
import { formatARS, formatUSD } from '@grana/i18n-messages'
import { useShowCents } from '@/lib/preferences-context'
import { useEyeMask } from './eye-mask-context'

type Props = {
  amount: number
  currency: 'ARS' | 'USD'
  className?: string
  /** Rendered before the number when not masked (e.g. "+"). */
  signPrefix?: string
}

/**
 * Display-size variant of `MaskedAmount` for headline numbers (Hero, Balance
 * del mes): the decimal part renders at half size with reduced opacity, per
 * the dashboard design handoff. Respects the show-cents preference (no cents →
 * nothing to de-emphasize) and the eye-mask like its sibling.
 */
export const MaskedAmountDisplay = ({ amount, currency, className, signPrefix }: Props) => {
  const { masked } = useEyeMask()
  const showCents = useShowCents()

  if (masked) {
    return <span className={cn('font-mono tabular-nums', className)}>••••••</span>
  }

  const formatted =
    currency === 'ARS' ? formatARS(amount, showCents) : formatUSD(amount, showCents)

  // es-AR formatting uses "," as the decimal separator; everything after the
  // last comma is the cents part.
  const commaIndex = formatted.lastIndexOf(',')
  const integerPart = commaIndex === -1 ? formatted : formatted.slice(0, commaIndex)
  const decimalPart = commaIndex === -1 ? null : formatted.slice(commaIndex)

  return (
    <span className={cn('tabular-nums', className)}>
      {signPrefix}
      {integerPart}
      {decimalPart && <span className="text-[0.5em] opacity-55">{decimalPart}</span>}
    </span>
  )
}
