'use client'

import { cn } from '@/lib/utils'
import { formatARS, formatUSD } from '@grana/i18n-messages'
import { useShowCents } from '@/lib/preferences-context'
import { useEyeMask } from './eye-mask-context'

type Props = {
  amount: number
  currency: 'ARS' | 'USD'
  className?: string
  showCentsOverride?: boolean
  maskChar?: string
  /**
   * Rendered before the number when not masked (e.g. "+" / "−"). Hidden while
   * masked, like the amount it qualifies: a lone sign next to dots would leak
   * the direction the mask is there to hide.
   */
  signPrefix?: string
}

export const MaskedAmount = ({
  amount,
  currency,
  className,
  showCentsOverride,
  maskChar = '••••••',
  signPrefix,
}: Props) => {
  const { masked } = useEyeMask()
  const showCents = useShowCents()
  const effectiveShowCents = showCentsOverride ?? showCents

  if (masked) {
    return <span className={cn('font-mono tabular-nums', className)}>{maskChar}</span>
  }

  const formatted =
    currency === 'ARS'
      ? formatARS(amount, effectiveShowCents)
      : formatUSD(amount, effectiveShowCents)

  return (
    <span className={cn('tabular-nums', className)}>
      {signPrefix}
      {formatted}
    </span>
  )
}
