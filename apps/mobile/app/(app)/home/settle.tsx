import { useMemo, useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { parseMoneyInput } from '@grana/validation'
import type { BalanceCurrency } from '@grana/money-logic'
import { getHousehold, getHouseholdDebt } from '../../../lib/shared/queries'
import { useAccountsList } from '../../../lib/accounts/queries'
import { registerSettlement } from '../../../lib/shared/mutators'
import { FormScreen } from '../../../components/layout/FormScreen'
import { MoneyAmountInput } from '../../../components/ui/MoneyAmountInput'
import { Segmented } from '../../../components/ui/Segmented'
import { SelectSheet } from '../../../components/ui/SelectSheet'
import { Button } from '../../../components/ui/Button'
import { Alert } from '../../../components/ui/Alert'
import { SkeletonBlock } from '../../../components/ui/SkeletonBlock'
import { useT } from '../../../lib/locale-context'
import { fmtMoney } from '../../../components/shared/money'
import { CARD } from '../../../components/shared/ui'

const CURRENCIES: BalanceCurrency[] = ['ARS', 'USD']

export default function SettleScreen() {
  const t = useT()
  const router = useRouter()
  const queryClient = useQueryClient()

  const householdQuery = useQuery({ queryKey: ['shared', 'household'], queryFn: getHousehold })
  const debtQuery = useQuery({ queryKey: ['shared', 'debt'], queryFn: () => getHouseholdDebt() })
  const accountsQuery = useAccountsList()

  const household = householdQuery.data ?? null
  const youId = household?.members[0]?.userId
  const partnerName = household?.members[1]?.fullName ?? ''

  const owed = useMemo(() => {
    const out: Partial<Record<BalanceCurrency, number>> = {}
    const debt = debtQuery.data
    if (debt && youId) {
      for (const cur of CURRENCIES) {
        const e = debt[cur]
        if (e.kind === 'owes' && e.from === youId) out[cur] = e.amount
      }
    }
    return out
  }, [debtQuery.data, youId])

  const currencies = Object.keys(owed) as BalanceCurrency[]
  const [currency, setCurrency] = useState<BalanceCurrency | null>(null)
  const activeCurrency = currency ?? currencies[0] ?? 'ARS'
  const owedNow = owed[activeCurrency] ?? 0

  const [amount, setAmount] = useState('')
  const [accountId, setAccountId] = useState<string | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [sent, setSent] = useState<{ amount: number; currency: BalanceCurrency } | null>(null)

  const accounts = useMemo(() => {
    const g = accountsQuery.data
    return [...(g?.cash ?? []), ...(g?.bank ?? [])].map((a) => ({
      id: a.id,
      name: a.name,
      balance: a.balances[activeCurrency] ?? 0,
    }))
  }, [accountsQuery.data, activeCurrency])
  const selected = accounts.find((a) => a.id === accountId) ?? null

  const amt = parseMoneyInput(amount) ?? 0
  const accAfter = selected ? selected.balance - amt : 0
  const remaining = Math.max(owedNow - amt, 0)
  const goesNegative = selected != null && accAfter < 0

  const submit = async () => {
    if (!accountId || amt <= 0) return
    setError(null)
    setSubmitting(true)
    try {
      const res = await registerSettlement(queryClient, {
        currency_code: activeCurrency,
        amount: amt,
        account_id: accountId,
      })
      if (res.ok) setSent({ amount: amt, currency: activeCurrency })
      else
        setError(res.formError ?? Object.values(res.fieldErrors ?? {})[0] ?? 'No se pudo registrar.')
    } finally {
      setSubmitting(false)
    }
  }

  const backLink = { href: '/home', label: t('common.back') }

  if (sent) {
    return (
      <FormScreen
        title={t('shared.settle.title')}
        backLink={backLink}
        contentClassName="px-6 pt-6"
      >
        <View className="flex-col gap-3 rounded-2xl border border-border bg-card shadow-sm p-5">
          <Text className="text-lg font-semibold text-text">
            {t('shared.settle.sent_title', { amount: fmtMoney(sent.amount, sent.currency) })}
          </Text>
          <Text className="text-sm text-text-muted">
            {t('shared.settle.sent_waiting', { name: partnerName })}
          </Text>
          <Button variant="primary" onPress={() => router.back()}>
            {t('shared.settle.sent_done')}
          </Button>
        </View>
      </FormScreen>
    )
  }

  const loading = householdQuery.isPending || debtQuery.isPending

  return (
    <FormScreen
      title={t('shared.settle.title')}
      backLink={backLink}
      contentClassName="px-6 pt-6 pb-16"
    >
        {loading ? (
          <View className="flex-col gap-4">
            <View className={`${CARD} p-5`}>
              <SkeletonBlock className="h-4 w-24 rounded" />
              <View className="mt-3">
                <SkeletonBlock className="h-10 w-40 rounded" />
              </View>
            </View>
            <View className={`${CARD} p-5`}>
              <SkeletonBlock className="h-5 w-full rounded" />
            </View>
          </View>
        ) : currencies.length === 0 ? (
          <View className="rounded-2xl border border-border bg-card shadow-sm p-5">
            <Text className="text-sm text-text-muted">{t('shared.dashboard.settled')}</Text>
          </View>
        ) : (
          <View className="flex-col gap-4">
            {currencies.length > 1 && (
              <Segmented
                ariaLabel={t('shared.settle.currency_label')}
                value={activeCurrency}
                onValueChange={(v) => {
                  setCurrency(v as BalanceCurrency)
                  setAmount('')
                }}
                options={currencies.map((c) => ({ value: c, label: c }))}
              />
            )}

            <Text className="text-sm text-text-muted">
              {t('shared.settle.you_owe_total', {
                amount: fmtMoney(owedNow, activeCurrency),
                name: partnerName,
              })}
            </Text>

            <View className="flex-col gap-2 rounded-2xl border border-border bg-card shadow-sm p-5">
              <Text className="text-xs font-medium uppercase text-text-soft">
                {t('shared.settle.amount_label')}
              </Text>
              <MoneyAmountInput value={amount} onChangeText={setAmount} placeholder="0.00" />
              <View className="flex-row gap-2">
                <Button variant="secondary" size="sm" onPress={() => setAmount(String(owedNow))}>
                  {t('shared.settle.quick_total')}
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onPress={() => setAmount(String(Math.round((owedNow / 2) * 100) / 100))}
                >
                  {t('shared.settle.quick_half')}
                </Button>
              </View>
            </View>

            <Pressable
              onPress={() => setPickerOpen(true)}
              className="flex-row items-center justify-between rounded-2xl border border-border bg-card shadow-sm px-5 py-4"
            >
              <Text className="text-sm text-text">
                {selected ? selected.name : t('shared.settle.account_label')}
              </Text>
              {selected && (
                <Text className="text-xs text-text-soft">
                  {t('shared.settle.available', {
                    amount: fmtMoney(selected.balance, activeCurrency),
                  })}
                </Text>
              )}
            </Pressable>

            {amt > 0 && selected && (
              <View className="flex-col gap-2 rounded-2xl border border-border bg-card shadow-sm p-5">
                <Text className="text-xs font-medium uppercase text-text-soft">
                  {t('shared.settle.what_happens')}
                </Text>
                <View className="flex-row justify-between">
                  <Text className="text-sm text-text-muted">{selected.name}</Text>
                  <Text className="text-sm text-text">{fmtMoney(accAfter, activeCurrency)}</Text>
                </View>
                <View className="flex-row justify-between">
                  <Text className="text-sm text-text-muted">
                    {t('shared.settle.debt_with', { name: partnerName })}
                  </Text>
                  <Text className="text-sm text-text">{fmtMoney(remaining, activeCurrency)}</Text>
                </View>
                <Text className="text-xs text-text-soft">
                  {remaining < 0.01
                    ? t('shared.settle.after_settled', { name: partnerName })
                    : t('shared.settle.after_remaining', {
                        amount: fmtMoney(remaining, activeCurrency),
                        name: partnerName,
                      })}
                </Text>
              </View>
            )}

            {goesNegative && <Alert variant="warning">{fmtMoney(accAfter, activeCurrency)}</Alert>}

            {error ? <Alert variant="error">{error}</Alert> : null}

            <Button
              variant="primary"
              onPress={submit}
              loading={submitting}
              disabled={!accountId || amt <= 0}
            >
              {t('shared.settle.pay_to', {
                amount: fmtMoney(amt, activeCurrency),
                name: partnerName,
              })}
            </Button>
          </View>
        )}

      {/* Renders into its own native window (RN Modal), so sitting inside the
          scroll content has no layout effect — it just keeps the picker next to
          the field that opens it. */}
      <SelectSheet
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        title={t('shared.settle.account_label')}
        items={accounts}
        keyExtractor={(a) => a.id}
        renderRow={(a) => (
          <Pressable
            onPress={() => {
              setAccountId(a.id)
              setPickerOpen(false)
            }}
            className="flex-row items-center justify-between px-4 py-3"
          >
            <Text className="text-base text-text">{a.name}</Text>
            <Text className="text-sm text-text-soft">{fmtMoney(a.balance, activeCurrency)}</Text>
          </Pressable>
        )}
      />
    </FormScreen>
  )
}
