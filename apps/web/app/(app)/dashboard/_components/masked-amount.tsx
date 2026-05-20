'use client'

import { cn } from '@/lib/utils'
import { formatARS, formatUSD } from '@/lib/format'
import { useShowCents } from '@/lib/preferences-context'
import { useEyeMask } from './eye-mask-context'

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
    return <span className={cn('font-mono tabular-nums', className)}>{maskChar}</span>
  }

  const formatted =
    currency === 'ARS'
      ? formatARS(amount, effectiveShowCents)
      : formatUSD(amount, effectiveShowCents)

  return <span className={cn('tabular-nums', className)}>{formatted}</span>
}
