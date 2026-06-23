'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { ChevronRight } from 'lucide-react'
import type { BalanceCurrency } from '@grana/money-logic'
import { fmtMoney } from '../_components/money'

export type BreakdownSlice = { key: string; label: string; color: string; value: number; pct: number }
export type BreakdownMovement = {
  id: string
  key: string
  currency: BalanceCurrency
  description: string | null
  amount: number
}

const CURRENCIES: BalanceCurrency[] = ['ARS', 'USD']

/**
 * "En qué gastaron" inside the navy hero: stacked bar + per-category inline drill,
 * with an ARS/USD toggle (matches the mockup — one currency at a time, never
 * merged). Client-only for the toggle/drill state.
 */
export function SpendingBreakdown({
  slices,
  movements,
  fallbackLabel,
}: {
  slices: Record<BalanceCurrency, BreakdownSlice[]>
  movements: BreakdownMovement[]
  fallbackLabel: string
}) {
  const t = useTranslations('shared')
  const hasAny = CURRENCIES.some((c) => slices[c].length > 0)
  const firstWith = CURRENCIES.find((c) => slices[c].length > 0) ?? 'ARS'
  const [currency, setCurrency] = useState<BalanceCurrency>(firstWith)
  if (!hasAny) return null
  const active = slices[currency]

  return (
    <div className="mt-5 border-t border-navy-border pt-4">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-extrabold uppercase tracking-[0.07em] text-navy-muted">
          {t('dashboard.spent_on')}
        </p>
        {/* Compact dark toggle (the form Segmented is full-width — too big here). */}
        <div className="inline-flex items-center gap-0.5 rounded-full bg-white/10 p-0.5">
          {CURRENCIES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCurrency(c)}
              aria-pressed={currency === c}
              className={`rounded-full px-2.5 py-0.5 text-[11px] font-extrabold transition-colors ${
                currency === c ? 'bg-white text-[#142231]' : 'text-navy-muted hover:text-white'
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {active.length === 0 ? (
        <p className="mt-3 text-xs font-medium text-navy-muted">{t('dashboard.no_spend_currency')}</p>
      ) : (
        <>
          <div className="mt-3 flex h-[11px] overflow-hidden rounded-md bg-white/10">
            {active.map((s) => (
              <span key={s.key} style={{ width: `${s.pct}%`, backgroundColor: s.color }} />
            ))}
          </div>
          <div className="mt-3 flex flex-col gap-0.5">
            {active.map((s) => {
              const movs = movements.filter((m) => m.key === s.key && m.currency === currency)
              return (
                <details key={s.key} className="group">
                  <summary className="-mx-2 flex cursor-pointer list-none items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-white/5">
                    <span
                      className="size-2.5 shrink-0 rounded-[3px]"
                      style={{ backgroundColor: s.color }}
                      aria-hidden
                    />
                    <span className="truncate text-[12.5px] font-bold text-white">{s.label}</span>
                    <span className="ml-auto text-[12.5px] font-extrabold tabular-nums text-white">
                      {fmtMoney(s.value, currency)}
                    </span>
                    <span className="w-8 text-right text-[11px] font-semibold text-navy-muted">
                      {Math.round(s.pct)}%
                    </span>
                    <ChevronRight
                      size={13}
                      className="text-navy-muted transition-transform group-open:rotate-90"
                    />
                  </summary>
                  {movs.length > 0 && (
                    <div className="mb-1 ml-[18px] border-l border-navy-border pl-3">
                      {movs.map((m) => (
                        <div
                          key={m.id}
                          className="flex items-center justify-between gap-3 py-1 text-[11.5px]"
                        >
                          <span className="truncate text-navy-muted">{m.description || s.label || fallbackLabel}</span>
                          <span className="shrink-0 font-bold tabular-nums text-white">
                            {fmtMoney(m.amount, currency)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </details>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
