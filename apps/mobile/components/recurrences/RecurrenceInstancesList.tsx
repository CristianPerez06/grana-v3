import { useState } from 'react'
import { Text, View } from 'react-native'
import {
  canUnlink,
  type EnrichedRecurrenceInstance,
  type RecurrenceInstanceStatus,
} from '@grana/recurrences'
import { useQueryClient } from '@tanstack/react-query'
import { Button } from '../ui/Button'
import { invalidateAfterRecurrenceResolution } from '../../lib/recurrences/invalidate'
import { unlinkMovementFromRecurrence } from '../../lib/recurrences/mutators'
import { useLocale, useT } from '../../lib/locale-context'
import { useShowCents } from '../../lib/preferences-context'
import { fmtMoney, formatShortDate } from '../transactions/detail/format'

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
  const [done, setDone] = useState(false)
  const queryClient = useQueryClient()

  const unlink = async (instanceId: string) => {
    setError(null)
    setDone(false)
    setPendingId(instanceId)
    const result = await unlinkMovementFromRecurrence(instanceId, t)
    setPendingId(null)
    if (!result.ok) {
      setError(result.formError)
      return
    }
    setDone(true)
    // Desvincular suelta un movimiento real y puede devolverlo a personal: el
    // saldo, el feed y la deuda del hogar cambian con él.
    invalidateAfterRecurrenceResolution(queryClient)
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
              <View className="items-end">
                <Text className="text-[14px] font-bold text-text">
                  {fmtMoney(Number(instance.amount), instance.currency_code, showCents)}
                </Text>
                <Text className={`text-[11px] font-bold ${STATUS_TONE[instance.status]}`}>
                  {t(`recurrences.instance_statuses.${instance.status}`)}
                </Text>
              </View>
              </View>
              {/* Sólo sobre lo que el usuario vinculó: sobre un pago que creó
                  la recurrencia, deshacer sería BORRAR ese movimiento. */}
              {canUnlink(instance) ? (
                <View className="flex-row justify-end">
                  <View>
                    <Button
                      variant="secondary"
                      size="xs"
                      onPress={() => unlink(instance.id)}
                      disabled={pendingId === instance.id}
                    >
                      {pendingId === instance.id
                        ? t('recurrences.link.unlinking')
                        : t('recurrences.link.unlink')}
                    </Button>
                  </View>
                </View>
              ) : null}
            </View>
          ))}
        </View>
      )}
      {error ? <Text className="text-[13px] text-terracotta">{error}</Text> : null}
      {/* El acuse: la ocurrencia se queda en pantalla, vuelta a «por revisar». */}
      {done ? (
        <Text className="text-[13px] text-emerald-deep">
          {t('recurrences.link.unlinked_success')}
        </Text>
      ) : null}
    </View>
  )
}
