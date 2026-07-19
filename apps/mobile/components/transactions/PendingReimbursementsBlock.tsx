import { useState } from 'react'
import { Alert, Pressable, Text, View } from 'react-native'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { parseMoneyInput } from '@grana/validation'
import { getPendingReimbursementsFeed, type PendingReimbursementVM } from '../../lib/transactions/queries'
import { confirmReimbursement, cancelReimbursement } from '../../lib/transactions/mutators'
import { invalidateAfterReimbursementMutation } from '../../lib/transactions/invalidate'
import { useT } from '../../lib/locale-context'
import { useShowCents } from '../../lib/preferences-context'
import { fmtMoney } from './detail/format'
import { Label } from '../ui/Label'
import { MoneyAmountInput } from '../ui/MoneyAmountInput'
import { DateField } from '../ui/DateField'

// One pending reintegro row. Collapsed it shows the title + estimated amount and
// the [Confirmar] / [Cancelar] actions; tapping Confirmar expands the reconcile
// inputs in place (real amount defaulted to the estimate, real date to the
// consumption date), and a second Confirmar commits `{ id, amount, date }`.
// Confirm reconciles amount + date only — no account/period picker (parity with
// web); a `statement` reintegro derives its period server-side from the date.
function PendingRow({
  item,
  todayISO,
  onDone,
}: {
  item: PendingReimbursementVM
  todayISO: string
  onDone: () => void
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
    if (result.ok) onDone()
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
            if (result.ok) onDone()
            else Alert.alert(result.formError)
          },
        },
      ],
    )
  }

  return (
    <View className="gap-2.5 px-4 py-3.5">
      <View className="flex-row items-center justify-between">
        <View className="min-w-0 flex-1 pr-3">
          <Text numberOfLines={1} className="text-[15px] font-bold text-text">
            {title}
          </Text>
          {categoryLabel && categoryLabel !== title ? (
            <Text numberOfLines={1} className="text-[12px] text-text-muted">
              {categoryLabel}
            </Text>
          ) : null}
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
// amount/date and moves the reintegro into the ledger; cancel drops it. Renders
// nothing when there are none. Unscoped read (all accounts); the account detail
// uses its own scoped, read-only card.
export function PendingReimbursementsBlock({ todayISO }: { todayISO: string }) {
  const t = useT()
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['transactions', 'pending-reimbursements'] as const,
    queryFn: getPendingReimbursementsFeed,
  })

  const items = query.data ?? []
  if (items.length === 0) return null

  const onDone = () => invalidateAfterReimbursementMutation(queryClient)

  return (
    <View className="gap-2">
      <View className="flex-row items-center justify-between px-1">
        <Text className="text-[13px] font-extrabold uppercase tracking-wide text-text-muted">
          {t('transactions.reimbursement.pending.title')}
        </Text>
        <Text className="text-[12px] font-semibold text-text-soft">
          {t('transactions.reimbursement.pending.count', { count: items.length })}
        </Text>
      </View>
      <View className="overflow-hidden rounded-2xl border border-border bg-card">
        {items.map((item, i) => (
          <View key={item.id} className={i > 0 ? 'border-t border-border-soft' : ''}>
            <PendingRow item={item} todayISO={todayISO} onDone={onDone} />
          </View>
        ))}
      </View>
    </View>
  )
}
