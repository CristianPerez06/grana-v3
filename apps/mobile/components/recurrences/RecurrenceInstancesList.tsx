import { Text, View } from 'react-native'
import type {
  PendingRecurrenceInstance,
  RecurrenceInstanceStatus,
} from '@grana/recurrences'
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
  instances: PendingRecurrenceInstance[]
}) {
  const t = useT()
  const locale = useLocale()
  const showCents = useShowCents()

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
            <View
              key={instance.id}
              className={`flex-row items-center justify-between px-4 py-3 ${
                i > 0 ? 'border-t border-border-soft' : ''
              }`}
            >
              <View className="min-w-0 flex-1 pr-3">
                <Text className="text-[14px] font-semibold text-text">
                  {formatShortDate(instance.scheduled_date, locale)}
                </Text>
                {instance.description ? (
                  <Text numberOfLines={1} className="text-[12px] text-text-muted">
                    {instance.description}
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
          ))}
        </View>
      )}
    </View>
  )
}
