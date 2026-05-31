'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { ChevronRight, Repeat } from 'lucide-react'
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
    if (freq === 'weekly' || freq === 'biweekly' || freq === 'monthly' || freq === 'annual' || freq === 'custom') {
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
  const emptyMessage =
    tab === 'active'
      ? tRec('empty_active')
      : tab === 'paused'
        ? tRec('empty_paused')
        : tRec('empty_finished')

  return (
    <div className="flex flex-col gap-4">
      {/* Segmented tabs */}
      <div className="inline-flex w-fit gap-1 rounded-[11px] border border-border bg-[#F1F3F6] p-1">
        {tabs.map((t) => {
          const on = tab === t.id
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`inline-flex items-center gap-2 rounded-[8px] px-4 py-2 text-sm font-bold transition-colors ${
                on ? 'bg-card text-navy shadow-[0_1px_3px_rgba(11,26,43,0.1)]' : 'text-text-muted hover:text-text'
              }`}
            >
              {t.label}
              {t.count > 0 && <span className="text-xs tabular-nums opacity-60">{t.count}</span>}
            </button>
          )
        })}
      </div>

      {/* List */}
      {rules.length === 0 ? (
        <div className="rounded-[18px] border border-border bg-card p-6">
          <p className="text-center text-sm text-text-muted">{emptyMessage}</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-[18px] border border-border bg-card p-1.5 [&>a+a]:border-t [&>a+a]:border-[#EEF1F4]">
          {rules.map((rule) => {
            const movementLabel = getMovementLabel(rule.movement_type)
            const freqLabel = getFrequencyLabel(rule.frequency)
            const accountName = rule.account?.name ?? '—'
            const destinationName = rule.destination_account?.name
            const isInactive = rule.status === 'paused' || tab === 'finished'

            // Tone → amount sign + color (income emerald, expense/transfer navy).
            const sign =
              rule.movement_type === 'income' ? '+' : rule.movement_type === 'expense' ? '−' : ''
            const amtClass =
            rule.movement_type === 'income'
              ? 'text-emerald-deep'
              : rule.movement_type === 'transfer'
                ? 'text-navy'
                : 'text-terracotta'

            // Category-tinted tile with its emoji icon; transfers fall back to a repeat glyph.
            const tileColor = rule.category?.color ?? '#8C97A4'
            const tileIcon = rule.category?.icon

            // Meta line: active → next occurrence + account; otherwise status hint.
            const nextDate = rule.pending_instance
              ? formatDate(rule.pending_instance.scheduled_date)
              : formatDate(rule.start_date)
            const accountLine =
              rule.movement_type === 'transfer'
                ? `${accountName} → ${destinationName ?? '—'}`
                : accountName
            const meta =
              tab === 'finished'
                ? rule.end_date
                  ? tRec('until_template', { date: formatDate(rule.end_date) ?? rule.end_date })
                  : accountLine
                : rule.status === 'paused'
                  ? `${tRec('statuses.paused')} · ${accountLine}`
                  : accountLine

            return (
              <Link
                key={rule.id}
                href={`/transactions/recurring/${rule.id}`}
                className="flex items-center gap-4 rounded-[14px] px-3.5 py-3.5 transition-colors hover:bg-page"
              >
                <span
                  className={`flex size-[46px] shrink-0 items-center justify-center rounded-[13px] text-[22px] ${
                    isInactive ? 'opacity-60' : ''
                  }`}
                  style={{ backgroundColor: `${tileColor}1A` }}
                >
                  {tileIcon ?? <Repeat className="size-5" style={{ color: tileColor }} aria-hidden />}
                </span>

                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-[15px] font-bold tracking-[-0.01em] text-text">
                      {rule.description || rule.category?.name || movementLabel}
                    </span>
                    <span className="shrink-0 rounded-[6px] bg-[#F1F3F6] px-2 py-0.5 text-[10.5px] font-extrabold uppercase tracking-[0.05em] text-text-muted">
                      {freqLabel}
                    </span>
                  </div>
                  <span className="truncate text-[13px] font-medium text-text-muted">{meta}</span>
                </div>

                <div className="flex shrink-0 items-center gap-4">
                  <div className="flex flex-col items-end">
                    <span className={`text-[16px] font-extrabold tracking-[-0.02em] tabular-nums ${amtClass}`}>
                      {sign}
                      {formatRuleAmount(rule)}
                    </span>
                    {tab === 'active' && nextDate && (
                      <span className="text-[12px] font-semibold text-text-soft">
                        {tRec('next_prefix')} {nextDate}
                      </span>
                    )}
                  </div>
                  <ChevronRight className="size-5 shrink-0 text-text-soft/50" aria-hidden />
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
