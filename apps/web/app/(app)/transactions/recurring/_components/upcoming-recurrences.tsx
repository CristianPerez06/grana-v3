import { getTranslations } from 'next-intl/server'
import { Repeat } from 'lucide-react'
import { formatARS, formatUSD } from '@grana/i18n-messages'
import {
  projectUpcomingOccurrences,
  type IntervalUnit,
  type RuleForProjection,
} from '@grana/money-logic'
import { formatDateISO, getTodayAR } from '@/lib/date'
import { recurrenceTitle } from '@grana/recurrences'
import { getCategoryName, getSubcategoryName } from '@/lib/categories/display'
import type { RecurrenceSummary } from '@/lib/recurrences/types'
import { UpcomingCard } from './upcoming-card'
import { ResolveAheadActions } from './resolve-ahead-actions'

type Props = {
  rules: RecurrenceSummary[]
}

const addDaysISO = (iso: string, days: number) => {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  dt.setDate(dt.getDate() + days)
  return formatDateISO(dt)
}

/**
 * Informational projection of upcoming recurrence occurrences. Two buckets:
 * the next 7 days and the next 30. Amounts are shown per
 * occurrence in their own currency — never summed (bimoneda invariant). Pure
 * projection via @grana/money-logic; no DB writes, no instance generation.
 */
export const UpcomingRecurrences = async ({ rules }: Props) => {
  const tRec = await getTranslations('recurrences')
  const tTx = await getTranslations('transactions')
  const tRoot = await getTranslations()

  const today = formatDateISO(getTodayAR())
  const in7 = addDaysISO(today, 7)
  const in30 = addDaysISO(today, 30)

  const ruleById = new Map(rules.map((r) => [r.id, r]))
  const forProjection: RuleForProjection[] = rules.map((r) => ({
    id: r.id,
    start_date: r.start_date,
    end_date: r.end_date,
    interval_count: r.interval_count,
    interval_unit: r.interval_unit as IntervalUnit,
    max_occurrences: r.max_occurrences,
    // Since when the current schedule rules. A corrected reference date opens a
    // stretch where the old calendar has stopped and the new one has not begun;
    // without this floor "Próximas recurrencias" lists a date for that stretch,
    // which the generator is never going to create.
    schedule_effective_from: r.schedule_effective_from,
    // The cap counts positions from the rule's start, and this screen only sees
    // the current anchor: without it a finished rule keeps listing a next one.
    schedule_positions_before: r.schedule_positions_before,
    // An occurrence that already exists — covered by the rule's seed movement, or
    // materialized as an instance in any state — is not "próxima": it is already
    // in the review block or already a movement. The read computes this set.
    covered: r.covered_occurrences,
  }))

  // Next 7 days, then days 8 → 30. The second window is measured in DAYS FROM
  // TODAY, never clipped to the end of the calendar month: a window ending on the
  // last day of the month empties itself as the month advances — from the day
  // `today + 8` lands in the next month, its range starts after it ends — and
  // leaves the user with no horizon past a week exactly when what is coming is
  // closest. Asked on the 25th, "lo que viene" meant nothing at all.
  const next7 = projectUpcomingOccurrences(forProjection, today, in7)
  const laterStart = addDaysISO(in7, 1)
  const later = projectUpcomingOccurrences(forProjection, laterStart, in30)

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
    // Same order, and the same last step, as the hub and the review block: this
    // card used to end at the ACCOUNT's name, so a transfer with no description
    // read "Billetera" here and "Transferencia" one card below it.
    const name =
      recurrenceTitle({
        description: rule.description,
        subcategory: rule.subcategory ? getSubcategoryName(rule.subcategory, tRoot) : null,
        category: rule.category ? getCategoryName(rule.category, tRoot) : null,
        type: tTx(`types.${rule.movement_type}` as 'types.income'),
      }) ?? '—'

    return (
      <div
        key={`${occ.rule_id}-${occ.scheduled_date}-${i}`}
        className="[&+&]:border-t [&+&]:border-[var(--border-soft)]"
      >
      <div className="flex items-center gap-3.5 px-5 pb-1.5 pt-3">
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
        <div className="flex shrink-0 flex-col items-end">
          <span className={`text-[15px] font-bold tracking-[-0.02em] tabular-nums ${amtClass}`}>
            {sign}{formatted}
          </span>
          <span className="text-[12px] font-semibold text-text-soft">{formatWhen(occ.scheduled_date)}</span>
        </div>
      </div>
      {/* Las dos salidas para un vencimiento que todavía no llegó. Van debajo de
          la fila y no al lado del importe: a ancho de teléfono, dos botones
          compitiendo con el monto por la misma línea dejan los tres ilegibles. */}
      <div className="px-5 pb-3 pl-[66px]">
        <ResolveAheadActions
          recurrenceId={rule.id}
          dueDate={occ.scheduled_date}
          ruleAmount={amount}
          ruleCurrency={rule.currency_code}
          movementType={rule.movement_type as 'expense' | 'income' | 'transfer'}
          ruleAccountId={rule.account?.id ?? null}
          transferDestinationAccountId={rule.transfer_destination_account_id ?? null}
          shared={rule.household_id != null}
        />
      </div>
    </div>
    )
  }

  // The rows are rendered here, on the server; `UpcomingCard` only decides how
  // many of them show at once.
  const renderCard = (title: string, rows: { rule_id: string; scheduled_date: string }[]) => (
    <UpcomingCard
      title={title}
      // Ya no es «solo informativo»: cada fila ofrece registrar o vincular. La
      // proyección sigue siendo una lectura pura; las acciones escriben por su
      // cuenta, a través de las server actions.
      note={tRec('upcoming.note_actions')}
      rows={rows.map(renderRow)}
      emptyLabel={tRec('upcoming.empty')}
    />
  )

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {renderCard(tRec('upcoming.next_7_days'), next7)}
      {renderCard(tRec('upcoming.next_30_days'), later)}
    </div>
  )
}
