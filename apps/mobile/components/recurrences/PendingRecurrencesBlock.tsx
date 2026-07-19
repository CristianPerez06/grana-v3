import { useState } from 'react'
import { Alert, Pressable, Text, View } from 'react-native'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { PendingRecurrenceInstance } from '@grana/recurrences'
import { getPendingRecurrences } from '../../lib/recurrences/queries'
import {
  confirmRecurrenceInstance,
  skipRecurrenceInstance,
} from '../../lib/recurrences/mutators'
import { invalidateAfterRecurrenceConfirm } from '../../lib/recurrences/invalidate'
import { useLocale, useT } from '../../lib/locale-context'
import { useShowCents } from '../../lib/preferences-context'
import { fmtMoney, formatShortDate } from '../transactions/detail/format'
import { amountSign, amountToneClass, categoryName, movementLabel } from './format'

function PendingRow({
  instance,
  onDone,
}: {
  instance: PendingRecurrenceInstance
  onDone: () => void
}) {
  const t = useT()
  const locale = useLocale()
  const showCents = useShowCents()
  const [busy, setBusy] = useState(false)

  const type = instance.recurrence.movement_type
  const title =
    instance.description || categoryName(instance.category, t) || movementLabel(type, t)

  const run = async (action: 'confirm' | 'skip') => {
    setBusy(true)
    const result =
      action === 'confirm'
        ? await confirmRecurrenceInstance(instance.id, {}, t)
        : await skipRecurrenceInstance(instance.id, t)
    setBusy(false)
    if (result.ok) {
      onDone()
    } else {
      Alert.alert(result.formError)
    }
  }

  return (
    <View className="gap-2.5 px-4 py-3.5">
      <View className="flex-row items-center justify-between">
        <View className="min-w-0 flex-1 pr-3">
          <View className="flex-row items-center gap-2">
            <Text numberOfLines={1} className="flex-shrink text-[15px] font-bold text-text">
              {title}
            </Text>
            {instance.household_id ? (
              <Text className="shrink-0 overflow-hidden rounded-md bg-border-soft px-2 py-0.5 text-[10px] font-extrabold uppercase text-text-muted">
                {t('transactions.list.shared_short')}
              </Text>
            ) : null}
          </View>
          <Text className="text-[12px] text-text-muted">
            {formatShortDate(instance.scheduled_date, locale)}
          </Text>
        </View>
        <Text className={`text-[15px] font-extrabold ${amountToneClass(type)}`}>
          {amountSign(type)}
          {fmtMoney(Number(instance.amount), instance.currency_code, showCents)}
        </Text>
      </View>

      <View className="flex-row gap-2">
        <Pressable
          onPress={() => run('confirm')}
          disabled={busy}
          className="flex-1 items-center rounded-xl bg-navy py-2.5 active:opacity-90 disabled:opacity-60"
        >
          <Text className="text-[13px] font-bold text-white">
            {busy ? t('recurrences.pending.confirming') : t('recurrences.pending.confirm')}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => run('skip')}
          disabled={busy}
          className="items-center justify-center rounded-xl border border-border px-4 py-2.5 active:bg-page disabled:opacity-60"
        >
          <Text className="text-[13px] font-semibold text-text-muted">
            {t('recurrences.pending.skip')}
          </Text>
        </Pressable>
      </View>
    </View>
  )
}

// Feed block listing recurrence instances awaiting confirmation, separate from
// the history. Confirm materializes the real movement (invalidating the feed +
// hub); skip omits it. Renders nothing when there are no pending instances. In
// this slice, confirm uses the instance snapshot — no inline amount/date override.
export function PendingRecurrencesBlock() {
  const t = useT()
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['recurrences', 'pending'] as const,
    queryFn: getPendingRecurrences,
  })

  const instances = query.data ?? []
  if (instances.length === 0) return null

  const onDone = () => invalidateAfterRecurrenceConfirm(queryClient)

  return (
    <View className="gap-2">
      <View className="flex-row items-center justify-between px-1">
        <Text className="text-[13px] font-extrabold uppercase tracking-wide text-text-muted">
          {t('recurrences.pending.title')}
        </Text>
        <Text className="text-[12px] font-semibold text-text-soft">
          {t('recurrences.pending.count', { count: instances.length })}
        </Text>
      </View>
      <View className="overflow-hidden rounded-2xl border border-border bg-card">
        {instances.map((instance, i) => (
          <View key={instance.id} className={i > 0 ? 'border-t border-border-soft' : ''}>
            <PendingRow instance={instance} onDone={onDone} />
          </View>
        ))}
      </View>
    </View>
  )
}
