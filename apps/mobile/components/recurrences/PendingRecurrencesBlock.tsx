import { useState } from 'react'
import { Alert, Pressable, Text, View } from 'react-native'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, ChevronDown, Clock, X } from 'lucide-react-native'
import { formatDateISO, getTodayAR } from '@grana/money-logic'
import {
  resolutionPreview,
  reviewFeedState,
  reviewUrgency,
  shouldOpenReviewBlock,
} from '@grana/recurrences'
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
import { RecurrenceFailureNotice } from './MaterializationNotice'

type DoneAction = 'confirmed' | 'skipped'

// Spelled out rather than interpolated, so a renamed message key still turns up
// in a grep and in the i18n key suite.
const WILL_CREATE_KEY = {
  expense: 'recurrences.pending.will_create.expense',
  income: 'recurrences.pending.will_create.income',
  transfer: 'recurrences.pending.will_create.transfer',
} as const

// The row reports WHICH action succeeded and nothing else: the success notice is
// owned by the block, because a notice living in the row would unmount with the
// row exactly when the list empties — which is the moment it exists to explain.
function PendingRow({
  instance,
  today,
  onDone,
}: {
  instance: PendingRecurrenceInstance
  today: string
  onDone: (action: DoneAction) => void
}) {
  const t = useT()
  const locale = useLocale()
  const showCents = useShowCents()
  const [busy, setBusy] = useState(false)

  const type = instance.recurrence.movement_type
  const title =
    instance.description || categoryName(instance.category, t) || movementLabel(type, t)
  const amount = fmtMoney(Number(instance.amount), instance.currency_code, showCents)
  const urgency = reviewUrgency(instance.due_date, today)
  const urgencyLabel =
    urgency.kind === 'due_today'
      ? t('recurrences.pending.due_today')
      : t(
          urgency.kind === 'overdue'
            ? 'recurrences.pending.overdue'
            : 'recurrences.pending.due_in',
          { count: urgency.days },
        )
  // WHAT RESOLVING IT WILL DO, spelled out — the same sentence web shows. The
  // native row used to stop at title, date and amount, so confirming meant
  // guessing which movement, on which date, in which account.
  const preview = resolutionPreview(instance)

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
            {formatShortDate(instance.due_date, locale)}
          </Text>
          <Text
            className={`mt-0.5 text-[11px] font-extrabold uppercase ${
              urgency.kind === 'due_in' ? 'text-warning' : 'text-negative'
            }`}
          >
            {urgencyLabel}
          </Text>
          <Text className="mt-1 text-[12px] text-text-soft">
            {t(WILL_CREATE_KEY[preview.kind], {
              amount,
              date: formatShortDate(preview.date, locale),
              account: preview.account ?? '—',
              destination: preview.destination ?? '—',
            })}
          </Text>
        </View>
        <Text className={`text-[15px] font-extrabold ${amountToneClass(type)}`}>
          {amountSign(type)}
          {amount}
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

  // A FAILED READ IS NOT AN EMPTY LIST. `query.data ?? []` made the block
  // disappear on error, which tells the user they have nothing to review when
  // the truth is that nobody knows — the same defect as a swallowed
  // materialization error, one layer up. `reviewFeedState` is shared with web so
  // the two platforms cannot answer this differently.
  const feed = reviewFeedState(query)
  const instances = feed.kind === 'list' ? (query.data ?? []) : []
  const todayISO = formatDateISO(getTodayAR())
  const isOpen = openOverride ?? shouldOpenReviewBlock(instances, todayISO)

  if (feed.kind === 'unreadable') {
    return (
      <RecurrenceFailureNotice
        title={t('recurrences.materialization.read_failed_title')}
        body={t('recurrences.materialization.read_failed_body')}
        onRetry={() => void query.refetch()}
        retrying={query.isFetching}
      />
    )
  }

  if (instances.length === 0 && !notice) return null

  // Rows are already on screen and a refresh failed. They stay: making
  // vencimientos the user was looking at vanish over a transient failure is a
  // worse answer than showing them slightly stale and saying so.
  const staleNotice =
    feed.kind === 'list' && feed.refreshFailed ? (
      <View className="mb-3">
        <RecurrenceFailureNotice
          title={t('recurrences.materialization.refresh_failed_title')}
          body={t('recurrences.materialization.refresh_failed_body')}
          onRetry={() => void query.refetch()}
          retrying={query.isFetching}
        />
      </View>
    ) : null

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

  // RN has no `spread` on shadows, so web's 4px gold halo becomes a real ring:
  // an outer view painted `warning-bg` with the card inset by 1. The ring is
  // also what carries the gold accent — overriding the `Card`'s own border
  // color from `className` would be a coin flip, since two `border-*`
  // utilities resolve by their order in Tailwind's output, not in the string.
  return (
    <>
      {staleNotice}
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
            {/* The pill is `shrink-0`, so whatever it says it takes from the
                title column first. With the old sentence in it — "2 vencimientos
                por revisar", the whole phrase — the column was left so narrow on
                a phone that the title broke one word per line. It says the count
                and nothing else now, like the reimbursements block beside it; the
                title next to it already names what is being counted. */}
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
                  <PendingRow instance={instance} today={todayISO} onDone={onDone} />
                </View>
              ))
            )
          ) : null}
        </Card>
      </View>
    </>
  )
}
