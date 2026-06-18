'use client'

import { useState, type ReactNode } from 'react'
import {
  ArrowLeftRight,
  Banknote,
  Calendar,
  CalendarClock,
  Repeat,
  Tag,
  Wallet,
} from 'lucide-react'
import { useTranslations } from 'next-intl'
import { formatARS, formatUSD } from '@grana/i18n-messages'
import { useShowCents } from '@/lib/preferences-context'
import { getCategoryName } from '@/lib/categories/display'
import type { RecurrenceDetail as RecurrenceDetailType } from '@/lib/recurrences/types'
import { RecurrenceActions } from './recurrence-actions'
import { RecurrenceEditDrawer } from './recurrence-edit-drawer'

type Props = {
  rule: RecurrenceDetailType
}

// Parse a 'YYYY-MM-DD' calendar date locally (avoids the UTC shift a bare
// `new Date(iso)` would introduce).
const formatCalendarDate = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('es-AR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

const iconFor = (key: string): ReactNode => {
  switch (key) {
    case 'frequency':
      return <Repeat size={16} strokeWidth={2} />
    case 'account':
    case 'destination':
      return <Wallet size={16} strokeWidth={2} />
    case 'category':
      return <Tag size={16} strokeWidth={2} />
    case 'next_date':
    case 'end_date':
      return <CalendarClock size={16} strokeWidth={2} />
    case 'amount':
      return <Banknote size={16} strokeWidth={2} />
    default:
      return <Calendar size={16} strokeWidth={2} />
  }
}

/**
 * Read-only summary of a recurring rule, in the interaction language of the
 * transaction detail (`/transactions/[txId]`): the amount leads, actions live
 * in the header, and editing happens in a drawer. The generated-instances list
 * renders below this (owned by the page).
 */
export const RecurrenceDetail = ({ rule }: Props) => {
  const showCents = useShowCents()
  const t = useTranslations('recurrences')
  const tTx = useTranslations('transactions')
  const tRoot = useTranslations()
  const [editOpen, setEditOpen] = useState(false)

  const fmt = (amount: number) =>
    rule.currency_code === 'ARS'
      ? formatARS(amount, showCents)
      : formatUSD(amount, showCents)

  const { movement_type: type } = rule
  const sign = type === 'income' ? '+' : type === 'transfer' ? '' : '−'
  const amountClass =
    type === 'income' ? 'text-emerald-deep' : type === 'transfer' ? 'text-navy' : 'text-terracotta'

  const typeLabel =
    type === 'income' || type === 'expense' || type === 'transfer'
      ? tTx(`types.${type}`)
      : type

  const frequencyLabel =
    rule.frequency === 'weekly' ||
    rule.frequency === 'biweekly' ||
    rule.frequency === 'monthly' ||
    rule.frequency === 'annual'
      ? t(`frequencies.${rule.frequency}`)
      : rule.frequency

  const heroDesc = rule.description || rule.category?.name || typeLabel

  type Row = { key: string; label: string; value: string }
  const rows: Row[] = [{ key: 'frequency', label: t('labels.frequency'), value: frequencyLabel }]

  if (type === 'transfer') {
    rows.push(
      { key: 'account', label: t('labels.account'), value: rule.account?.name ?? '—' },
      {
        key: 'destination',
        label: t('labels.destination'),
        value: rule.destination_account?.name ?? '—',
      },
    )
  } else {
    rows.push({ key: 'account', label: t('labels.account'), value: rule.account?.name ?? '—' })
    if (rule.category) {
      rows.push({
        key: 'category',
        label: t('labels.category'),
        value: getCategoryName(rule.category, tRoot),
      })
    }
  }

  if (rule.pending_instance?.scheduled_date) {
    rows.push({
      key: 'next_date',
      label: t('labels.next_date'),
      value: formatCalendarDate(rule.pending_instance.scheduled_date),
    })
  }
  if (rule.end_date) {
    rows.push({
      key: 'end_date',
      label: t('labels.end_date'),
      value: formatCalendarDate(rule.end_date),
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <RecurrenceActions rule={rule} onEdit={() => setEditOpen(true)} />

      {/* Hero: amount leads, with the rule's narrative and type/frequency below */}
      <div className="flex flex-col items-center gap-2 px-4 pt-2 text-center">
        <div className="flex flex-wrap items-center justify-center gap-1.5">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-muted/50 px-2.5 py-1 text-[11px] font-semibold text-text-muted">
            {type === 'transfer' ? (
              <ArrowLeftRight size={13} aria-hidden />
            ) : (
              <Repeat size={13} aria-hidden />
            )}
            {frequencyLabel}
          </span>
          {rule.status !== 'active' && (
            <span className="inline-flex items-center rounded-full bg-warning-soft px-2.5 py-1 text-[11px] font-semibold text-warning-deep">
              {t(`statuses.${rule.status}`)}
            </span>
          )}
        </div>
        <span className={`text-[32px] font-bold tabular-nums tracking-tight ${amountClass}`}>
          {sign}
          {fmt(rule.amount)}
        </span>
        <span className="text-sm text-text-muted">{heroDesc}</span>
      </div>

      {/* Detail rows */}
      <div className="flex flex-col overflow-hidden rounded-[15px] border border-border bg-card">
        {rows.map((row) => (
          <div
            key={row.key}
            className="flex items-center justify-between gap-3 border-b border-border px-4 py-3 last:border-b-0"
          >
            <span className="flex items-center gap-2 text-sm text-text-muted">
              {iconFor(row.key)}
              {row.label}
            </span>
            <span className="text-sm font-semibold text-text">{row.value}</span>
          </div>
        ))}
      </div>

      <RecurrenceEditDrawer rule={rule} open={editOpen} onClose={() => setEditOpen(false)} />
    </div>
  )
}
