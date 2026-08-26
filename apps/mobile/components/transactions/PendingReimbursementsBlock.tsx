import { useState } from 'react'
import { Alert, Pressable, Text, View } from 'react-native'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, ChevronDown, Undo2, X } from 'lucide-react-native'
import { parseMoneyInput } from '@grana/validation'
import { getPendingReimbursementsFeed, type PendingReimbursementVM } from '../../lib/transactions/queries'
import { confirmReimbursement, cancelReimbursement } from '../../lib/transactions/mutators'
import { invalidateAfterReimbursementMutation } from '../../lib/transactions/invalidate'
import { useT } from '../../lib/locale-context'
import { useShowCents } from '../../lib/preferences-context'
import { colors } from '../../lib/colors'
import { fmtMoney } from './detail/format'
import { Card } from '../ui/Card'
import { Label } from '../ui/Label'
import { MoneyAmountInput } from '../ui/MoneyAmountInput'
import { DateField } from '../ui/DateField'

type DoneAction = 'confirmed' | 'cancelled'

// One pending reintegro row. Collapsed it shows the category chip + title + estimated
// amount and the [Confirmar] / [Cancelar] actions; tapping Confirmar expands the
// reconcile inputs in place (real amount defaulted to the estimate, real date to the
// consumption date), and a second Confirmar commits `{ id, amount, date }`.
// Confirm reconciles amount + date only — no account/period picker (parity with
// web); a `statement` reintegro derives its period server-side from the date.
//
// The row reports WHICH action succeeded and nothing else: the success notice is
// owned by the block, because a notice living in the row would unmount with the
// row exactly when the list empties — which is the moment it exists to explain.
function PendingRow({
  item,
  todayISO,
  onDone,
}: {
  item: PendingReimbursementVM
  todayISO: string
  onDone: (action: DoneAction) => void
}) {
  const t = useT()
  const showCents = useShowCents()

  const [expanded, setExpanded] = useState(false)
  const [amount, setAmount] = useState(String(item.estimatedAmount))
  const [date, setDate] = useState(item.expenseDate ?? todayISO)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const categoryLabel = item.categoryIsSystem
    ? item.categoryCanonicalName
      ? t(`categories.${item.categoryCanonicalName}`)
      : null
    : item.categoryName
  const title =
    item.expenseDescription?.trim() || categoryLabel || t('transactions.reimbursement.label')

  const commit = async () => {
    setError('')
    const parsed = parseMoneyInput(amount)
    if (parsed === null || parsed <= 0) {
      setError(t('transactions.reimbursement.errors.amount_positive'))
      return
    }
    setBusy(true)
    const result = await confirmReimbursement({ id: item.id, amount: parsed, date }, t)
    setBusy(false)
    if (result.ok) onDone('confirmed')
    else setError(result.formError)
  }

  const confirmCancel = () => {
    Alert.alert(
      t('transactions.reimbursement.pending.cancel_confirm_title'),
      t('transactions.reimbursement.pending.cancel_confirm_message'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('transactions.reimbursement.pending.cancel_confirm_cta'),
          style: 'destructive',
          onPress: async () => {
            setBusy(true)
            const result = await cancelReimbursement(item.id, t)
            setBusy(false)
            if (result.ok) onDone('cancelled')
            else Alert.alert(result.formError)
          },
        },
      ],
    )
  }

  return (
    <View className="gap-2.5 px-4 py-3.5">
      <View className="flex-row items-center justify-between">
        <View className="min-w-0 flex-1 flex-row items-center gap-2.5 pr-3">
          {/* The category tint is the only color the row carries, so it does the
              work the amount can't: telling two reintegros apart at a glance. */}
          {item.categoryIcon ? (
            <View
              className="h-8 w-8 shrink-0 items-center justify-center rounded-md"
              style={{ backgroundColor: `${item.categoryColor ?? colors.textSoft}1A` }}
            >
              <Text className="text-[15px]">{item.categoryIcon}</Text>
            </View>
          ) : null}
          <View className="min-w-0 flex-1">
            <Text numberOfLines={1} className="text-[15px] font-bold text-text">
              {title}
            </Text>
            {categoryLabel && categoryLabel !== title ? (
              <Text numberOfLines={1} className="text-[12px] text-text-muted">
                {categoryLabel}
              </Text>
            ) : null}
          </View>
        </View>
        <Text className="text-[15px] font-extrabold text-emerald-deep">
          + {fmtMoney(item.estimatedAmount, item.currencyCode, showCents)}
        </Text>
      </View>

      {expanded ? (
        <View className="gap-2.5">
          <View className="flex-row gap-2.5">
            <View className="flex-1 gap-1.5">
              <Label>{t('transactions.reimbursement.pending.real_amount')}</Label>
              <MoneyAmountInput value={amount} onChangeText={setAmount} invalid={Boolean(error)} />
            </View>
            <View className="flex-1 gap-1.5">
              <Label>{t('transactions.reimbursement.pending.real_date')}</Label>
              <DateField value={date} onChange={setDate} />
            </View>
          </View>
          {error ? <Text className="text-[12px] text-error">{error}</Text> : null}
        </View>
      ) : null}

      <View className="flex-row gap-2">
        <Pressable
          onPress={expanded ? commit : () => setExpanded(true)}
          disabled={busy}
          className="flex-1 items-center rounded-xl bg-navy py-2.5 active:opacity-90 disabled:opacity-60"
        >
          <Text className="text-[13px] font-bold text-white">
            {busy
              ? t('transactions.reimbursement.pending.confirming')
              : t('transactions.reimbursement.confirm')}
          </Text>
        </Pressable>
        <Pressable
          onPress={confirmCancel}
          disabled={busy}
          className="items-center justify-center rounded-xl border border-border px-4 py-2.5 active:bg-page disabled:opacity-60"
        >
          <Text className="text-[13px] font-semibold text-text-muted">
            {t('transactions.reimbursement.cancel')}
          </Text>
        </Pressable>
      </View>
    </View>
  )
}

// Feed block listing reimbursements awaiting confirmation, separate from the
// history — a sibling of `PendingRecurrencesBlock`. Confirm reconciles the real
// amount/date and moves the reintegro into the ledger; cancel drops it. Unscoped
// read (all accounts); the account detail uses its own scoped, read-only card.
//
// The success notice doubles as the "acted in this session" flag — one piece of
// state, so the two can't drift apart. It is what keeps the block mounted after
// the last pending one is resolved: without it, confirming made the whole block
// vanish, which from the screen is indistinguishable from a silent failure.
// Entering with an empty list still renders nothing (parity with web).
export function PendingReimbursementsBlock({ todayISO }: { todayISO: string }) {
  const t = useT()
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['transactions', 'pending-reimbursements'] as const,
    queryFn: getPendingReimbursementsFeed,
  })

  const [notice, setNotice] = useState<string | null>(null)
  // Derived, not synced: the list arrives via `useQuery`, so on first render it
  // is empty and a `useState(items.length <= 1)` would freeze open forever. An
  // effect that reset it would instead stomp the user's choice on every
  // refetch-on-focus. Deriving does both: follow the data until the user picks.
  const [openOverride, setOpenOverride] = useState<boolean | null>(null)

  const items = query.data ?? []
  const isOpen = openOverride ?? items.length <= 1

  if (items.length === 0 && !notice) return null

  const onDone = (action: DoneAction) => {
    setNotice(
      t(
        action === 'confirmed'
          ? 'transactions.reimbursement.pending.confirmed_success'
          : 'transactions.reimbursement.pending.cancelled_success',
      ),
    )
    invalidateAfterReimbursementMutation(queryClient)
  }

  return (
    // RN has no `spread` on shadows, so web's 4px slate halo becomes a real
    // ring: an outer view painted `slate-soft` with the card inset by 1. The
    // ring is also what carries the slate accent — overriding the `Card`'s own
    // border color from `className` would be a coin flip, since two `border-*`
    // utilities resolve by their order in Tailwind's output, not in the string.
    <View className="rounded-2xl bg-slate-soft p-1">
      <Card className="overflow-hidden">
        <Pressable
          onPress={() => setOpenOverride(!isOpen)}
          accessibilityRole="button"
          accessibilityState={{ expanded: isOpen }}
          className="flex-row items-center gap-3 px-4 py-4 active:bg-page"
        >
          <View className="h-10 w-10 shrink-0 items-center justify-center rounded-[13px] bg-slate-soft">
            <Undo2 size={20} color={colors.slate} />
          </View>
          <View className="min-w-0 flex-1">
            <Text className="text-[15px] font-extrabold text-text">
              {t('transactions.reimbursement.pending.title')}
            </Text>
            <Text className="mt-0.5 text-[12px] font-medium text-text-muted">
              {t('transactions.reimbursement.pending.subtitle')}
            </Text>
          </View>
          {items.length > 0 ? (
            <Text className="shrink-0 overflow-hidden rounded-full bg-slate-soft px-2.5 py-1 text-[12px] font-bold text-slate">
              {t('transactions.reimbursement.pending.count', { count: items.length })}
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
              accessibilityLabel={t('transactions.reimbursement.pending.close_notice')}
              hitSlop={10}
            >
              <X size={14} color={colors.emeraldDeep} />
            </Pressable>
          </View>
        ) : null}

        {isOpen ? (
          items.length === 0 ? (
            <View className="flex-row items-center gap-3 border-t border-border-soft px-4 py-5">
              <Check size={20} color={colors.emeraldDeep} />
              <Text className="min-w-0 flex-1 text-[14px] font-semibold text-emerald-deep">
                {t('transactions.reimbursement.pending.all_clear')}
              </Text>
            </View>
          ) : (
            items.map((item) => (
              <View key={item.id} className="border-t border-border-soft">
                <PendingRow item={item} todayISO={todayISO} onDone={onDone} />
              </View>
            ))
          )
        ) : null}
      </Card>
    </View>
  )
}
