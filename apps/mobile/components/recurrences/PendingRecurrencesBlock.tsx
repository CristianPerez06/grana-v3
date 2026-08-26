import { useState } from 'react'
import { Alert, Pressable, Text, View } from 'react-native'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, ChevronDown, Clock, X } from 'lucide-react-native'
import type { PendingRecurrenceInstance } from '@grana/recurrences'
import { getPendingRecurrences } from '../../lib/recurrences/queries'
import {
  confirmRecurrenceInstance,
  skipRecurrenceInstance,
} from '../../lib/recurrences/mutators'
import { invalidateAfterRecurrenceConfirm } from '../../lib/recurrences/invalidate'
import { useLocale, useT } from '../../lib/locale-context'
import { useShowCents } from '../../lib/preferences-context'
import { colors } from '../../lib/colors'
import { fmtMoney, formatShortDate } from '../transactions/detail/format'
import { amountSign, amountToneClass, categoryName, movementLabel } from './format'
import { Card } from '../ui/Card'

type DoneAction = 'confirmed' | 'skipped'

// The row reports WHICH action succeeded and nothing else: the success notice is
// owned by the block, because a notice living in the row would unmount with the
// row exactly when the list empties — which is the moment it exists to explain.
function PendingRow({
  instance,
  onDone,
}: {
  instance: PendingRecurrenceInstance
  onDone: (action: DoneAction) => void
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
      onDone(action === 'confirm' ? 'confirmed' : 'skipped')
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
// the history — a sibling of `PendingReimbursementsBlock`. Confirm materializes
// the real movement (invalidating the feed + hub); skip omits it. In this slice,
// confirm uses the instance snapshot — no inline amount/date override.
//
// The success notice doubles as the "acted in this session" flag — one piece of
// state, so the two can't drift apart. It is what keeps the block mounted after
// the last pending instance is resolved: without it, confirming made the whole
// block vanish, which from the screen is indistinguishable from a silent
// failure. Entering with an empty list still renders nothing (parity with web).
//
// The gold accent is deliberate and does NOT match the reimbursements block:
// this one talks about something that comes DUE, that one is informational.
export function PendingRecurrencesBlock() {
  const t = useT()
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['recurrences', 'pending'] as const,
    queryFn: getPendingRecurrences,
  })

  const [notice, setNotice] = useState<string | null>(null)
  // Derived, not synced: the list arrives via `useQuery`, so on first render it
  // is empty and a `useState(instances.length <= 1)` would freeze open forever.
  // An effect that reset it would instead stomp the user's choice on every
  // refetch-on-focus. Deriving does both: follow the data until the user picks.
  const [openOverride, setOpenOverride] = useState<boolean | null>(null)

  const instances = query.data ?? []
  const isOpen = openOverride ?? instances.length <= 1

  if (instances.length === 0 && !notice) return null

  const onDone = (action: DoneAction) => {
    setNotice(
      t(
        action === 'confirmed'
          ? 'recurrences.pending.confirmed_success'
          : 'recurrences.pending.skipped_success',
      ),
    )
    invalidateAfterRecurrenceConfirm(queryClient)
  }

  return (
    // RN has no `spread` on shadows, so web's 4px gold halo becomes a real ring:
    // an outer view painted `warning-bg` with the card inset by 1. The ring is
    // also what carries the gold accent — overriding the `Card`'s own border
    // color from `className` would be a coin flip, since two `border-*`
    // utilities resolve by their order in Tailwind's output, not in the string.
    <View className="rounded-2xl bg-warning-bg p-1">
      <Card className="overflow-hidden">
        <Pressable
          onPress={() => setOpenOverride(!isOpen)}
          accessibilityRole="button"
          accessibilityState={{ expanded: isOpen }}
          className="flex-row items-center gap-3 px-4 py-4 active:bg-page"
        >
          <View className="h-10 w-10 shrink-0 items-center justify-center rounded-[13px] bg-warning-bg">
            <Clock size={20} color={colors.warning} />
          </View>
          <View className="min-w-0 flex-1">
            <Text className="text-[15px] font-extrabold text-text">
              {t('recurrences.pending.title')}
            </Text>
            <Text className="mt-0.5 text-[12px] font-medium text-text-muted">
              {t('recurrences.pending.subtitle')}
            </Text>
          </View>
          {instances.length > 0 ? (
            <Text className="shrink-0 overflow-hidden rounded-full bg-warning-bg px-2.5 py-1 text-[12px] font-bold text-warning">
              {t('recurrences.pending.count', { count: instances.length })}
            </Text>
          ) : null}
          <ChevronDown
            size={20}
            color={colors.textMuted}
            style={{ transform: [{ rotate: isOpen ? '0deg' : '-90deg' }] }}
          />
        </Pressable>

        {isOpen && notice ? (
          <View className="mx-4 mb-3 flex-row items-center justify-between gap-2 rounded-xl border border-emerald/30 bg-emerald-soft px-3 py-2">
            <View className="min-w-0 flex-1 flex-row items-center gap-2">
              <Check size={16} color={colors.emeraldDeep} />
              <Text className="min-w-0 flex-1 text-[13px] font-medium text-emerald-deep">
                {notice}
              </Text>
            </View>
            <Pressable
              onPress={() => setNotice(null)}
              accessibilityRole="button"
              accessibilityLabel={t('recurrences.pending.close_notice')}
              hitSlop={10}
            >
              <X size={14} color={colors.emeraldDeep} />
            </Pressable>
          </View>
        ) : null}

        {isOpen ? (
          instances.length === 0 ? (
            <View className="flex-row items-center gap-3 border-t border-border-soft px-4 py-5">
              <Check size={20} color={colors.emeraldDeep} />
              <Text className="min-w-0 flex-1 text-[14px] font-semibold text-emerald-deep">
                {t('recurrences.pending.all_clear')}
              </Text>
            </View>
          ) : (
            instances.map((instance) => (
              <View key={instance.id} className="border-t border-border-soft">
                <PendingRow instance={instance} onDone={onDone} />
              </View>
            ))
          )
        ) : null}
      </Card>
    </View>
  )
}
