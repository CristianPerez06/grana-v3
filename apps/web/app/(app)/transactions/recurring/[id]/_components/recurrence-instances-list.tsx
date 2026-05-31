import { getTranslations } from 'next-intl/server'
import { formatARS, formatUSD } from '@grana/i18n-messages'
import type { PendingRecurrenceInstance } from '@/lib/recurrences/types'

type Props = {
  instances: PendingRecurrenceInstance[]
  currencyCode: 'ARS' | 'USD'
}

const formatDate = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('es-AR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

const statusClass: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  confirmed: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
  skipped: 'bg-muted text-text-muted',
}

/**
 * Read-only history of every instance a rule has produced (pending, confirmed or
 * skipped). The data already comes from getRecurrenceDetail; this just surfaces
 * it so a skipped/confirmed occurrence leaves a visible trace.
 */
export const RecurrenceInstancesList = async ({ instances, currencyCode }: Props) => {
  const tRec = await getTranslations('recurrences')

  const fmtAmount = (amount: number) =>
    currencyCode === 'ARS' ? formatARS(amount, false) : formatUSD(amount, false)

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold text-text">{tRec('history.title')}</h2>

      {instances.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted-foreground">
          {tRec('history.empty')}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {instances.map((instance) => (
            <li
              key={instance.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3"
            >
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="text-sm font-semibold text-text">
                  {formatDate(instance.scheduled_date)}
                </span>
                {instance.description && (
                  <span className="truncate text-xs text-text-muted">
                    {instance.description}
                  </span>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-2.5">
                {(() => {
                  // Amount tone mirrors the rest of the app: income emerald (+),
                  // expense terracotta (−), transfer navy (no sign).
                  const type = instance.recurrence.movement_type
                  const sign = type === 'income' ? '+' : type === 'transfer' ? '' : '−'
                  const amtClass =
                    type === 'income'
                      ? 'text-emerald-deep'
                      : type === 'transfer'
                        ? 'text-navy'
                        : 'text-terracotta'
                  return (
                    <span className={`text-sm font-bold tabular-nums tracking-tight ${amtClass}`}>
                      {sign}
                      {fmtAmount(Number(instance.amount))}
                    </span>
                  )
                })()}
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                    statusClass[instance.status] ?? statusClass.skipped
                  }`}
                >
                  {tRec(`instance_statuses.${instance.status}`)}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
