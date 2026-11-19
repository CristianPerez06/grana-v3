'use client'

import type { BalanceCurrency } from '@grana/money-logic'

/**
 * ARS | USD pills — the same control and look as the currency switch of
 * «¿En qué gasté?» in /transactions, so the two lenses read as one app.
 */
export function CurrencyLensPills({
  value,
  onChange,
}: {
  value: BalanceCurrency
  onChange: (currency: BalanceCurrency) => void
}) {
  return (
    <div className="flex shrink-0 items-center gap-0.5" role="tablist">
      {(['ARS', 'USD'] as const).map((code) => {
        const active = value === code
        return (
          <button
            key={code}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(code)}
            className={`rounded-full px-2 py-1 text-[11px] font-semibold transition-colors ${
              active
                ? 'bg-primary text-primary-foreground'
                : 'border border-border bg-card text-text-muted hover:text-text'
            }`}
          >
            {code}
          </button>
        )
      })}
    </div>
  )
}
