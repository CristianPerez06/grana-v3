'use client'

import type { ReactNode } from 'react'
import { useShowCents } from '@/lib/preferences-context'
import { fmtAmountParts, toneToClass, type Tone } from '@/lib/transactions/components/tone'

// Editorial hero block for the transaction detail. Vertically centered. The
// amount is the protagonist — currency symbol opaque and decimals as
// superscript, both treatments inherited from v2's `TxHero`. No type chips
// above the amount; the description and context line carry the narrative.

type Props = {
  /** Circle bg color (CSS value: token, hex, or `var(--…)`). */
  iconBg: string
  /** Element rendered inside the circle (emoji string, lucide icon, …). */
  icon: ReactNode
  /** Absolute amount; sign is derived from `tone`. */
  amount: number
  currency: 'ARS' | 'USD'
  tone: Tone
  /** Primary description line, bold, navy. */
  desc: string
  /** Optional context line below the desc, small muted. */
  context?: ReactNode
}

export const TxHero = ({ iconBg, icon, amount, currency, tone, desc, context }: Props) => {
  const showCents = useShowCents()
  const parts = fmtAmountParts(amount, currency, tone, showCents)

  return (
    <div className="flex flex-col items-center text-center px-6 pt-3.5 pb-6">
      {/* Circle icon */}
      <div
        className="size-16 rounded-full text-white flex items-center justify-center"
        style={{
          backgroundColor: iconBg,
          boxShadow: '0 8px 22px rgba(11,26,43,0.10)',
        }}
      >
        {icon}
      </div>

      {/* Amount: sign + opaque symbol + integer + superscript decimals */}
      <div
        className={`mt-4 flex items-baseline justify-center font-bold tabular-nums ${toneToClass(tone)}`}
        style={{
          fontSize: 38,
          letterSpacing: '-1.2px',
          lineHeight: 1.05,
        }}
      >
        {parts.sign && <span style={{ marginRight: 3 }}>{parts.sign}</span>}
        <span
          style={{
            fontSize: 24,
            fontWeight: 600,
            marginRight: 4,
            opacity: 0.6,
            letterSpacing: '-0.4px',
          }}
        >
          {parts.symbol}
        </span>
        {parts.int}
        {parts.dec && (
          <span
            style={{
              fontSize: '0.55em',
              verticalAlign: '0.65em',
              letterSpacing: 0,
              marginLeft: 1,
              opacity: 0.85,
            }}
          >
            ,{parts.dec}
          </span>
        )}
      </div>

      {/* Description */}
      <div className="mt-3 max-w-[300px] text-[18px] font-bold tracking-[-0.3px] text-text">
        {desc}
      </div>

      {/* Context line */}
      {context && (
        <div className="mt-1 text-[12px] font-medium text-text-muted tracking-[-0.05px]">
          {context}
        </div>
      )}
    </div>
  )
}
