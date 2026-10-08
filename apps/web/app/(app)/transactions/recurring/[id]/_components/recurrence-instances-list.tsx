import { getTranslations } from 'next-intl/server'
import { formatARS, formatUSD } from '@grana/i18n-messages'
import { formatShortDate } from '@/lib/date'
import { canUndo, canUnlink, recurrenceLinkLabelKey } from '@grana/recurrences'
import type { EnrichedRecurrenceInstance } from '@/lib/recurrences/types'
import { UndoInstanceButton } from './undo-instance-button'
import { UnlinkInstanceButton } from './unlink-instance-button'

type Props = {
  /**
   * The whole history, so `due_date` may be NULL — an occurrence resolved before
   * 0064 has no recoverable vencimiento. This list renders `scheduled_date`,
   * which is what it has for those rows.
   */
  instances: EnrichedRecurrenceInstance[]
  currencyCode: 'ARS' | 'USD'
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
  const tLink = await getTranslations('recurrences.link')

  const fmtAmount = (amount: number) =>
    currencyCode === 'ARS' ? formatARS(amount, false) : formatUSD(amount, false)

  const fmtSigned = (instance: EnrichedRecurrenceInstance) => {
    const type = instance.recurrence.movement_type
    const sign = type === 'income' ? '+' : type === 'transfer' ? '' : '−'
    return `${sign}${fmtAmount(Number(instance.amount))}`
  }

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold text-text">{tRec('history.title')}</h2>

      {instances.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted-foreground">
          {tRec('history.empty')}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {instances.map((instance) => {
            const undoable = canUndo(instance) && instance.confirmed_transaction_id != null
            const unlinkable = canUnlink(instance)
            return (
            // DOS RENGLONES, iguales en cualquier ancho y en nativo.
            //
            //   1 · la fecha (y la descripción) | el estado y el importe
            //   2 · cómo se resolvió             | cómo se deshace
            //
            // El segundo sólo existe sobre una ocurrencia resuelta con un
            // movimiento, y pone el rótulo AL LADO del botón que le corresponde:
            // «Vinculado» con «Desvincular», «Generado por la regla» con
            // «Deshacer». Es la distinción que el spec exige visible, y es lo que
            // explica por qué dos filas confirmadas ofrecen cosas distintas.
            //
            // Antes el rótulo vivía bajo la fecha y peleaba el ancho con el
            // importe: a 360 px se partía en dos renglones y el botón caía solo
            // a un tercero.
            <li
              key={instance.id}
              className="flex flex-col gap-2 rounded-xl border border-border bg-card px-4 py-3"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="whitespace-nowrap text-sm font-semibold text-text">
                    {formatShortDate(instance.scheduled_date)}
                  </span>
                  {instance.description && (
                    <span className="truncate text-xs text-text-muted">
                      {instance.description}
                    </span>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-2.5">
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      statusClass[instance.status] ?? statusClass.skipped
                    }`}
                  >
                    {tRec(`instance_statuses.${instance.status}`)}
                  </span>
                  {(() => {
                    // Amount tone mirrors the rest of the app: income emerald (+),
                    // expense terracotta (−), transfer navy (no sign).
                    const type = instance.recurrence.movement_type
                    const amtClass =
                      type === 'income'
                        ? 'text-emerald-deep'
                        : type === 'transfer'
                          ? 'text-navy'
                          : 'text-terracotta'
                    return (
                      <span className={`text-sm font-bold tabular-nums tracking-tight ${amtClass}`}>
                        {fmtSigned(instance)}
                      </span>
                    )
                  })()}
                </div>
              </div>
              {(undoable || unlinkable) && (
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                  <span className="min-w-0 flex-1 text-[11px] font-medium text-text-soft">
                    {tLink(`label_${recurrenceLinkLabelKey(instance.resolution_kind)}`)}
                  </span>
                  {/* Cada resolución se deshace a su manera: lo vinculado se
                      SUELTA (el movimiento queda), lo que creó la recurrencia se
                      BORRA (#104). `canUndo`/`canUnlink` deciden. */}
                  {unlinkable && <UnlinkInstanceButton instanceId={instance.id} />}
                  {undoable && instance.confirmed_transaction_id && (
                    <UndoInstanceButton
                      transactionId={instance.confirmed_transaction_id}
                      amount={fmtSigned(instance)}
                      account={instance.account?.name ?? '—'}
                      dueDate={instance.due_date ? formatShortDate(instance.due_date) : null}
                      leavesHistory={
                        instance.recurrence.status === 'deleted'
                          ? 'deleted_rule'
                          : instance.due_date == null
                            ? 'unknown_due_date'
                            : null
                      }
                    />
                  )}
                </div>
              )}
            </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
