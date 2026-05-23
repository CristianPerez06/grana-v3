import Link from 'next/link'
import { formatARS, formatUSD } from '@grana/i18n-messages'
import { PageHeader } from '@/components/ui/page-header'
import { formatDateISO, getTodayAR } from '@/lib/date'
import { getRecurrences } from '@/lib/recurrences/queries'
import type { RecurrenceSummary } from '@/lib/recurrences/types'

const FREQUENCY_LABEL: Record<string, string> = {
  weekly: 'Semanal',
  biweekly: 'Quincenal',
  monthly: 'Mensual',
  annual: 'Anual',
}

const MOVEMENT_LABEL: Record<string, string> = {
  income: 'Ingreso',
  expense: 'Gasto',
  transfer: 'Transferencia',
}

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

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <PageHeader
        title="Recurrencias"
        description="Reglas que generan movimientos pendientes para que confirmes o omitas."
        backLink={{ href: '/transactions', label: 'Movimientos' }}
      />

      {rules.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Todavía no tenés reglas recurrentes. Activá el toggle &quot;Hacer recurrente&quot;
          cuando registres un movimiento.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {rules.map((rule) => {
            const finished = isFinished(rule)
            const movementLabel = MOVEMENT_LABEL[rule.movement_type] ?? '—'
            const freqLabel =
              FREQUENCY_LABEL[rule.frequency] ?? rule.frequency
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
                      {rule.end_date && ` · hasta ${formatDate(rule.end_date)}`}
                    </span>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-sm font-semibold">
                      {formatRuleAmount(rule)}
                    </span>
                    <span className="text-xs uppercase tracking-wide text-muted-foreground">
                      {rule.status === 'paused'
                        ? 'Pausada'
                        : finished
                          ? 'Finalizada'
                          : 'Activa'}
                      {rule.pending_instance && ' · pendiente'}
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
