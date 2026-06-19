'use client'

import type { CategorySlice } from '@grana/money-logic'
import { formatARS, formatUSD } from '@grana/i18n-messages'
import { useShowCents } from '@/lib/preferences-context'
import { donutAmountFontSize } from '@/lib/donut-amount'
import { MaskedAmount } from './masked-amount'

// Positional fallback when a category has no DB color (mirrors the donut in
// the Movimientos breakdown: DB color first, palette as a safety net).
const FALLBACK_PALETTE = [
  'var(--cat-1)',
  'var(--cat-3)',
  'var(--cat-6)',
  'var(--cat-5)',
  'var(--cat-7)',
  'var(--cat-4)',
  'var(--cat-2)',
]

export const sliceColor = (slice: CategorySlice, index: number): string =>
  slice.color ?? FALLBACK_PALETTE[index % FALLBACK_PALETTE.length]

type Props = {
  slices: CategorySlice[]
  /** Month total for the active currency, shown in the donut centre. */
  total: number
  currency: 'ARS' | 'USD'
  centerLabel: string
  size?: number
}

// SVG stroke-circle donut (same technique as the Movimientos breakdown donut):
// each slice is a circle arc whose sweep/offset derive from the data — never
// hardcoded. The centre overlay shows the label + masked total.
export const SpendingDonut = ({ slices, total, currency, centerLabel, size = 150 }: Props) => {
  const showCents = useShowCents()
  // Auto-scale the centre amount so large totals don't overlap the ring.
  const formattedTotal =
    currency === 'ARS' ? formatARS(total, showCents) : formatUSD(total, showCents)
  const amountFontSize = donutAmountFontSize(formattedTotal, size, 17)
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg viewBox="0 0 36 36" width={size} height={size} role="img" aria-hidden>
        <circle
          cx="18"
          cy="18"
          r="15.915"
          fill="none"
          stroke="var(--border-soft)"
          strokeWidth="4"
        />
        {slices.map((s, i) => (
          <circle
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
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5">
        <span className="text-[10px] font-extrabold uppercase tracking-wide text-text-soft">
          {centerLabel}
        </span>
        <span
          className="font-extrabold tracking-tight text-text leading-none"
          style={{ fontSize: amountFontSize }}
        >
          <MaskedAmount amount={total} currency={currency} />
        </span>
      </div>
    </div>
  )
}
