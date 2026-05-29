'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { formatARS, formatUSD } from '@grana/i18n-messages'
import type { RecurrenceSummary } from '@/lib/recurrences/types'

type Tab = 'active' | 'paused' | 'finished'

type Props = {
  active: RecurrenceSummary[]
  paused: RecurrenceSummary[]
  finished: RecurrenceSummary[]
}

const formatRuleAmount = (rule: RecurrenceSummary) => {
  const amount = Number(rule.amount)
  return rule.currency_code === 'ARS' ? formatARS(amount, false) : formatUSD(amount, false)
}

const formatDate = (iso: string | null) => {
  if (!iso) return null
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('es-AR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export const RecurringTabs = ({ active, paused, finished }: Props) => {
  const [tab, setTab] = useState<Tab>('active')
  const tRec = useTranslations('recurrences')
  const tTx = useTranslations('transactions')

  const getMovementLabel = (type: string) => {
    if (type === 'income' || type === 'expense' || type === 'transfer' || type === 'adjustment') {
      return tTx(`types.${type}`)
    }
    return '—'
  }

  const getFrequencyLabel = (freq: string) => {
    if (freq === 'weekly' || freq === 'biweekly' || freq === 'monthly' || freq === 'annual') {
      return tRec(`frequencies.${freq}`)
    }
    return freq
  }

  const tabs: Array<{ id: Tab; label: string; count: number }> = [
    { id: 'active', label: tRec('statuses.active'), count: active.length },
    { id: 'paused', label: tRec('statuses.paused'), count: paused.length },
    { id: 'finished', label: tRec('statuses.finished'), count: finished.length },
  ]

  const rules = tab === 'active' ? active : tab === 'paused' ? paused : finished

  return (
    <div className="flex flex-col gap-4">
      {/* Tabs */}
      <div className="flex items-center gap-1 rounded-[12px] border border-border bg-card p-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-[9px] py-2 px-3 text-sm font-semibold transition-colors ${
              tab === t.id
                ? 'bg-page text-text shadow-sm'
                : 'text-text-muted hover:text-text'
            }`}
          >
            {t.label}
            {t.count > 0 && (
              <span
                className={`inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] font-semibold ${
                  tab === t.id ? 'bg-primary text-primary-foreground' : 'bg-muted/60 text-text-muted'
                }`}
              >
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* List */}
      {rules.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          {tRec('empty')}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {rules.map((rule) => {
            const movementLabel = getMovementLabel(rule.movement_type)
            const freqLabel = getFrequencyLabel(rule.frequency)
            const accountName = rule.account?.name ?? '—'
            const destinationName = rule.destination_account?.name

            const typeColorClass =
              rule.movement_type === 'income'
                ? 'text-positive'
                : rule.movement_type === 'expense'
                  ? 'text-negative'
                  : 'text-text-muted'

            return (
              <li
                key={rule.id}
                className="rounded-2xl border border-border bg-card"
              >
                <Link
                  href={`/transactions/recurring/${rule.id}`}
                  className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 hover:bg-muted/30 rounded-2xl transition-colors"
                >
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <span className="text-sm font-semibold text-text truncate">
                      {rule.description || rule.category?.name || movementLabel}
                    </span>
                    <span className="text-xs text-text-muted">
                      {rule.movement_type === 'transfer'
                        ? `${accountName} → ${destinationName ?? '—'}`
                        : accountName}
                      {' · '}
                      {freqLabel}
                      {rule.end_date &&
                        ` · hasta ${formatDate(rule.end_date) ?? rule.end_date}`}
                    </span>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className={`text-sm font-bold tabular-nums tracking-tight ${typeColorClass}`}>
                      {rule.movement_type === 'income' ? '+' : rule.movement_type === 'expense' ? '−' : ''}
                      {formatRuleAmount(rule)}
                    </span>
                    {rule.pending_instance && (
                      <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                        {tRec('pending_suffix')}
                      </span>
                    )}
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
