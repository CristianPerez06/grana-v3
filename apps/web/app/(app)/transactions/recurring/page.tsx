import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { formatARS, formatUSD } from '@grana/i18n-messages'
import { PageHeader } from '@/components/ui/page-header'
import { formatDateISO, getTodayAR } from '@/lib/date'
import { getRecurrences } from '@/lib/recurrences/queries'
import type { RecurrenceSummary } from '@/lib/recurrences/types'

const formatRuleAmount = (rule: RecurrenceSummary) => {
  const amount = Number(rule.amount)
  return rule.currency_code === 'ARS'
    ? formatARS(amount, false)
    : formatUSD(amount, false)
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

const isFinished = (rule: RecurrenceSummary) => {
  if (!rule.end_date) return false
  return rule.end_date < formatDateISO(getTodayAR())
}

const RecurringPage = async () => {
  const rules = await getRecurrences({ statuses: ['active', 'paused'] })
  const tRec = await getTranslations('recurrences')
  const tTx = await getTranslations('transactions')

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

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <PageHeader
        title={tRec('title')}
        description={tRec('description')}
        backLink={{ href: '/transactions', label: tRec('back_label') }}
      />

      {rules.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {tRec('empty')}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {rules.map((rule) => {
            const finished = isFinished(rule)
            const movementLabel = getMovementLabel(rule.movement_type)
            const freqLabel = getFrequencyLabel(rule.frequency)
            const accountName = rule.account?.name ?? '—'
            const destinationName = rule.destination_account?.name

            return (
              <li
                key={rule.id}
                className="flex flex-col gap-1 rounded-md border border-border bg-background p-3"
              >
                <Link
                  href={`/transactions/recurring/${rule.id}`}
                  className="flex flex-wrap items-start justify-between gap-2 hover:underline"
                >
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">
                      {rule.description ||
                        rule.category?.name ||
                        movementLabel}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {rule.movement_type === 'transfer'
                        ? `${accountName} → ${destinationName ?? '—'}`
                        : accountName}
                      {' · '}
                      {freqLabel}
                      {rule.end_date && ` · ${tRec('until_template', { date: formatDate(rule.end_date) ?? rule.end_date })}`}
                    </span>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-sm font-semibold">
                      {formatRuleAmount(rule)}
                    </span>
                    <span className="text-xs uppercase tracking-wide text-muted-foreground">
                      {rule.status === 'paused'
                        ? tRec('statuses.paused')
                        : finished
                          ? tRec('statuses.finished')
                          : tRec('statuses.active')}
                      {rule.pending_instance && ` · ${tRec('pending_suffix')}`}
                    </span>
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

export default RecurringPage
