'use client'

import { AlertTriangle } from 'lucide-react'
import { formatARS, formatUSD } from '@grana/i18n-messages'
import { useShowCents } from '@/lib/preferences-context'

type Props = {
  /** Resulting available balance after the operation (negative when shown). */
  projected: number
  currency: 'ARS' | 'USD'
}

/**
 * Non-blocking notice shown when an operation would leave a single account's
 * available balance below zero (Fase 0 decision: negatives are allowed). It
 * informs — it never prevents the entry. Styled as a warning, not an error,
 * and the copy makes clear the movement can still be registered. This is a
 * deliberate departure from grana-v2, which hard-blocked the operation.
 */
export const NegativeBalanceNotice = ({ projected, currency }: Props) => {
  const showCents = useShowCents()
  const abs = Math.abs(projected)
  const formatted = currency === 'ARS' ? formatARS(abs, showCents) : formatUSD(abs, showCents)

  return (
    <div
      role="status"
      className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900"
    >
      <AlertTriangle className="mt-0.5 shrink-0" size={16} aria-hidden />
      <div>
        <p className="font-medium">El saldo de la cuenta quedaría en negativo</p>
        <p>
          El disponible en {currency} pasaría a −{formatted}. Podés registrarlo igual.
        </p>
      </div>
    </div>
  )
}
