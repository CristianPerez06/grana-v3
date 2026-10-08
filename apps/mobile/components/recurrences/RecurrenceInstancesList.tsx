import { useState } from 'react'
import { Alert, Text, View } from 'react-native'
import {
  canUndo,
  canUnlink,
  type EnrichedRecurrenceInstance,
  type RecurrenceInstanceStatus,
} from '@grana/recurrences'
import { useQueryClient } from '@tanstack/react-query'
import { Button } from '../ui/Button'
import { invalidateAfterRecurrenceResolution } from '../../lib/recurrences/invalidate'
import { unlinkMovementFromRecurrence } from '../../lib/recurrences/mutators'
import { deleteMovement } from '../../lib/transactions/mutators'
import { useLocale, useT } from '../../lib/locale-context'
import { useShowCents } from '../../lib/preferences-context'
import { fmtMoney, formatShortDate } from '../transactions/detail/format'
import { amountSign } from './format'

// Status pill tone: confirmed → emerald, skipped → muted, pending → amber.
const STATUS_TONE: Record<RecurrenceInstanceStatus, string> = {
  confirmed: 'text-emerald-deep',
  skipped: 'text-text-soft',
  pending: 'text-amber-700',
}

// The generated-instance history under the rule detail (pending/confirmed/skipped),
// newest first. Read-only — confirming/omitting a pending instance happens from
// the feed's pending block, not here.
export function RecurrenceInstancesList({
  instances,
}: {
  /**
   * The whole history, so `due_date` may be NULL — an occurrence resolved before
   * 0064 has no recoverable vencimiento. This list renders `scheduled_date`,
   * which is what it has for those rows.
   */
  instances: EnrichedRecurrenceInstance[]
}) {
  const t = useT()
  const locale = useLocale()
  const showCents = useShowCents()
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  // El acuse de la última acción, que se lee debajo de la lista: la fila deja de
  // ofrecer el botón que se tocó, así que el mensaje no puede vivir en ella.
  const [doneMessage, setDoneMessage] = useState<string | null>(null)
  const queryClient = useQueryClient()

  const unlink = async (instanceId: string) => {
    setError(null)
    setDoneMessage(null)
    setPendingId(instanceId)
    const result = await unlinkMovementFromRecurrence(instanceId, t)
    setPendingId(null)
    if (!result.ok) {
      setError(result.formError)
      return
    }
    setDoneMessage(t('recurrences.link.unlinked_success'))
    // Desvincular suelta un movimiento real y puede devolverlo a personal: el
    // saldo, el feed y la deuda del hogar cambian con él.
    invalidateAfterRecurrenceResolution(queryClient)
  }

  // «DESHACER» UN PAGO QUE LA RECURRENCIA CREÓ (#104): borra ese movimiento y el
  // vencimiento vuelve a «por revisar» con los datos de la regla. Es la MISMA
  // operación que «Eliminar» en el detalle del movimiento —mismo mutator, mismas
  // guardas, mismos rechazos—, y la base reabre la ocurrencia en los dos (0075).
  // Pide confirmación porque borra: el saldo cambia. Web's twin is
  // `UndoInstanceButton`.
  const undo = (instance: EnrichedRecurrenceInstance) => {
    const transactionId = instance.confirmed_transaction_id
    if (!transactionId) return
    const leavesHistory =
      instance.recurrence.status === 'deleted'
        ? 'deleted_rule'
        : instance.due_date == null
          ? 'unknown_due_date'
          : null
    const amount = `${amountSign(instance.recurrence.movement_type)}${fmtMoney(
      Number(instance.amount),
      instance.currency_code,
      showCents,
    )}`
    const outcome =
      leavesHistory === 'deleted_rule'
        ? t('recurrences.link.undo_leaves_history_deleted_rule')
        : leavesHistory === 'unknown_due_date' || instance.due_date == null
          ? t('recurrences.link.undo_leaves_history')
          : t('recurrences.link.undo_back_to_review', {
              dueDate: formatShortDate(instance.due_date, locale),
            })
    const body = `${t('recurrences.link.undo_body', {
      amount,
      account: instance.account?.name ?? '—',
    })}\n\n${outcome}`

    Alert.alert(t('recurrences.link.undo_title'), body, [
      { text: t('recurrences.link.undo_cancel'), style: 'cancel' },
      {
        text: t('recurrences.link.undo_confirm'),
        style: 'destructive',
        onPress: async () => {
          setError(null)
          setDoneMessage(null)
          setPendingId(instance.id)
          const result = await deleteMovement(transactionId, t)
          setPendingId(null)
          if (!result.ok) {
            // Dice qué resolver primero: el pago del resumen, la liquidación.
            setError('formError' in result ? result.formError : t('transactions.errors.generic'))
            return
          }
          setDoneMessage(
            t(
              leavesHistory
                ? 'recurrences.link.undone_success_left_history'
                : 'recurrences.link.undone_success',
            ),
          )
          // Borra un movimiento real: saldo, feed, por revisar y deuda del hogar.
          invalidateAfterRecurrenceResolution(queryClient)
        },
      },
    ])
  }

  return (
    <View className="gap-3">
      <Text className="text-[13px] font-extrabold uppercase tracking-wide text-text-muted">
        {t('recurrences.history.title')}
      </Text>
      {instances.length === 0 ? (
        <View className="rounded-2xl border border-dashed border-border p-6">
          <Text className="text-center text-sm text-text-muted">
            {t('recurrences.history.empty')}
          </Text>
        </View>
      ) : (
        <View className="overflow-hidden rounded-2xl border border-border bg-card">
          {instances.map((instance, i) => (
            // DOS PISOS, como en web: el botón abajo, no disputando el ancho
            // con la fecha y el importe.
            <View
              key={instance.id}
              className={`gap-2 px-4 py-3 ${i > 0 ? 'border-t border-border-soft' : ''}`}
            >
              <View className="flex-row items-center justify-between">
              <View className="min-w-0 flex-1 pr-3">
                <Text className="text-[14px] font-semibold text-text">
                  {formatShortDate(instance.scheduled_date, locale)}
                </Text>
                {instance.description ? (
                  <Text numberOfLines={1} className="text-[12px] text-text-muted">
                    {instance.description}
                  </Text>
                ) : null}
                {/* Vinculado, no originado: el movimiento existía antes. */}
                {instance.resolution_kind === 'linked' ? (
                  <Text className="text-[11px] text-text-soft">
                    {t('recurrences.link.label_linked')}
                  </Text>
                ) : null}
              </View>
              {/* Estado e importe en UNA línea, y el importe ÚLTIMO: apilados
                  hacían la fila el doble de alta, y con el estado al final los
                  números dejaban de alinearse entre sí —que es lo único que se
                  compara de un vistazo en una lista de importes—. */}
              <View className="flex-row items-center gap-2">
                <Text className={`text-[11px] font-bold ${STATUS_TONE[instance.status]}`}>
                  {t(`recurrences.instance_statuses.${instance.status}`)}
                </Text>
                <Text className="text-[14px] font-bold text-text">
                  {fmtMoney(Number(instance.amount), instance.currency_code, showCents)}
                </Text>
              </View>
              </View>
              {/* Cada resolución se deshace a su manera, en el mismo lugar de la
                  fila: lo vinculado se SUELTA (el movimiento queda), lo que creó
                  la recurrencia se BORRA (#104). `canUndo`/`canUnlink` deciden. */}
              {canUndo(instance) && instance.confirmed_transaction_id ? (
                <View className="flex-row justify-end">
                  <Button
                    variant="secondary"
                    size="2xs"
                    onPress={() => undo(instance)}
                    disabled={pendingId === instance.id}
                  >
                    {pendingId === instance.id
                      ? t('recurrences.link.undoing')
                      : t('recurrences.link.undo')}
                  </Button>
                </View>
              ) : null}
              {canUnlink(instance) ? (
                <View className="flex-row justify-end">
                  <Button
                    variant="secondary"
                    size="2xs"
                    onPress={() => unlink(instance.id)}
                    disabled={pendingId === instance.id}
                  >
                    {pendingId === instance.id
                      ? t('recurrences.link.unlinking')
                      : t('recurrences.link.unlink')}
                  </Button>
                </View>
              ) : null}
            </View>
          ))}
        </View>
      )}
      {error ? <Text className="text-[13px] text-terracotta">{error}</Text> : null}
      {/* El acuse: la ocurrencia se queda en pantalla, vuelta a «por revisar»
          (o, si era un pago viejo, ya fuera del historial). */}
      {doneMessage ? <Text className="text-[13px] text-emerald-deep">{doneMessage}</Text> : null}
    </View>
  )
}
