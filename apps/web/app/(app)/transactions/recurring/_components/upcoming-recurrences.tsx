import { getTranslations } from 'next-intl/server'
import { Repeat } from 'lucide-react'
import { formatARS, formatUSD } from '@grana/i18n-messages'
import {
  projectUpcomingOccurrences,
  type IntervalUnit,
  type RuleForProjection,
} from '@grana/money-logic'
import { formatDateISO, getTodayAR } from '@/lib/date'
import type { RecurrenceSummary } from '@/lib/recurrences/types'

type Props = {
  rules: RecurrenceSummary[]
}

const addDaysISO = (iso: string, days: number) => {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  dt.setDate(dt.getDate() + days)
  return formatDateISO(dt)
}

const endOfMonthISO = (iso: string) => {
  const [y, m] = iso.split('-').map(Number)
  return formatDateISO(new Date(y, m, 0))
}

/**
 * Informational projection of upcoming recurrence occurrences. Two buckets:
 * the next 7 days and the rest of the current month. Amounts are shown per
 * occurrence in their own currency — never summed (bimoneda invariant). Pure
 * projection via @grana/money-logic; no DB writes, no instance generation.
 */
export const UpcomingRecurrences = async ({ rules }: Props) => {
  const tRec = await getTranslations('recurrences')

  const today = formatDateISO(getTodayAR())
  const in7 = addDaysISO(today, 7)
  const monthEnd = endOfMonthISO(today)

  const ruleById = new Map(rules.map((r) => [r.id, r]))
  const forProjection: RuleForProjection[] = rules.map((r) => ({
    id: r.id,
    start_date: r.start_date,
    end_date: r.end_date,
    interval_count: r.interval_count,
    interval_unit: r.interval_unit as IntervalUnit,
    max_occurrences: r.max_occurrences,
  }))

  // Next 7 days, then the remainder of the month (day 8 → month end).
  const next7 = projectUpcomingOccurrences(forProjection, today, in7)
  const laterStart = addDaysISO(in7, 1)
  const later =
    laterStart <= monthEnd
      ? projectUpcomingOccurrences(forProjection, laterStart, monthEnd)
      : []

  if (next7.length === 0 && later.length === 0) return null

  const formatWhen = (iso: string) => {
    const [y, m, d] = iso.split('-').map(Number)
    return new Date(y, m - 1, d).toLocaleDateString('es-AR', {
      day: 'numeric',
      month: 'short',
    })
  }

  const renderRow = (occ: { rule_id: string; scheduled_date: string }, i: number) => {
    const rule = ruleById.get(occ.rule_id)
    if (!rule) return null
    const amount = Number(rule.amount)
    const formatted = rule.currency_code === 'ARS' ? formatARS(amount, false) : formatUSD(amount, false)
    const sign = rule.movement_type === 'income' ? '+' : rule.movement_type === 'transfer' ? '' : '−'
    const amtClass =
      rule.movement_type === 'income'
        ? 'text-emerald-deep'
        : rule.movement_type === 'transfer'
          ? 'text-navy'
          : 'text-terracotta'
    const tileColor = rule.category?.color ?? '#8C97A4'
    const tileIcon = rule.category?.icon
    const name = rule.description || rule.category?.name || rule.account?.name || '—'

    return (
      <div
        key={`${occ.rule_id}-${occ.scheduled_date}-${i}`}
        className="flex items-center gap-3.5 px-5 py-3 [&+&]:border-t [&+&]:border-[var(--border-soft)]"
      >
        <span
          className="flex size-[38px] shrink-0 items-center justify-center rounded-[11px] text-[18px]"
          style={{ backgroundColor: `${tileColor}1A` }}
        >
          {tileIcon ?? <Repeat className="size-4" style={{ color: tileColor }} aria-hidden />}
        </span>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-[15px] font-bold tracking-[-0.01em] text-text">{name}</span>
          <span className="truncate text-[13px] font-medium text-text-muted">
            {rule.account?.name ?? '—'}
          </span>
        </div>
        <div className="flex flex-col items-end">
          <span className={`text-[15px] font-bold tracking-[-0.02em] tabular-nums ${amtClass}`}>
            {sign}{formatted}
          </span>
          <span className="text-[12px] font-semibold text-text-soft">{formatWhen(occ.scheduled_date)}</span>
        </div>
      </div>
    )
  }

  const renderCard = (
    title: string,
    note: string,
    rows: { rule_id: string; scheduled_date: string }[],
  ) => (
    <div className="overflow-hidden rounded-[18px] border border-border bg-card">
      <div className="flex items-baseline justify-between px-5 pb-2.5 pt-4">
        <span className="text-[14px] font-bold tracking-[-0.01em] text-text">{title}</span>
        <span className="text-[12.5px] font-medium text-text-soft">{note}</span>
      </div>
      {rows.length === 0 ? (
        <p className="px-5 pb-4 text-[13px] text-text-muted">{tRec('upcoming.empty')}</p>
      ) : (
        <div className="pb-1.5">{rows.map(renderRow)}</div>
      )}
    </div>
  )

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {renderCard(tRec('upcoming.next_7_days'), tRec('upcoming.info_only'), next7)}
      {renderCard(tRec('upcoming.later_this_month'), tRec('upcoming.info_only'), later)}
    </div>
  )
}
