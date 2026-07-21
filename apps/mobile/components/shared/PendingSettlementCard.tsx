import { useMemo, useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { useQueryClient } from '@tanstack/react-query'
import type { PendingSettlement } from '../../lib/shared/queries'
import { useAccountsList } from '../../lib/accounts/queries'
import { assignSettlementAccount } from '../../lib/shared/mutators'
import { Button } from '../ui/Button'
import { Alert } from '../ui/Alert'
import { SelectSheet } from '../ui/SelectSheet'
import { useT } from '../../lib/locale-context'
import { fmtMoney } from './money'

type AccountRow = { id: string; name: string; balance: number }

// Receiver side of a settlement: confirm in which account the money landed.
// Mirror of web's pending-settlement-card — the atomic `confirm_settlement`
// creates the receiver's credit leg and marks the settlement completed.
export function PendingSettlementCard({ settlement }: { settlement: PendingSettlement }) {
  const t = useT()
  const queryClient = useQueryClient()
  const accountsQuery = useAccountsList()
  const [accountId, setAccountId] = useState<string | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const accounts: AccountRow[] = useMemo(() => {
    const groups = accountsQuery.data
    const flat = [...(groups?.cash ?? []), ...(groups?.bank ?? [])]
    return flat.map((a) => ({
      id: a.id,
      name: a.name,
      balance: a.balances[settlement.currencyCode] ?? 0,
    }))
  }, [accountsQuery.data, settlement.currencyCode])

  const selected = accounts.find((a) => a.id === accountId) ?? null

  const confirm = async () => {
    if (!accountId) return
    setError(null)
    setSubmitting(true)
    try {
      const res = await assignSettlementAccount(queryClient, {
        settlement_id: settlement.id,
        account_id: accountId,
      })
      if (!res.ok) setError(res.formError ?? 'No se pudo confirmar.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <View className="flex-col gap-3 rounded-2xl border border-border bg-card shadow-sm p-5">
      <View className="flex-col gap-1">
        <Text className="text-sm font-semibold text-text">
          {t('shared.settle.pending_from', {
            amount: fmtMoney(settlement.amount, settlement.currencyCode),
            name: settlement.fromName,
          })}
        </Text>
        <Text className="text-xs text-text-muted">{t('shared.settle.pending_confirm_hint')}</Text>
      </View>

      <Pressable
        onPress={() => setPickerOpen(true)}
        className="flex-row items-center justify-between rounded-xl border border-border-soft bg-page px-4 py-3"
      >
        <Text className="text-sm text-text">
          {selected ? selected.name : t('shared.settle.receiver_account_label')}
        </Text>
        {selected && (
          <Text className="text-xs text-text-soft">
            {t('shared.settle.balance_label')} {fmtMoney(selected.balance, settlement.currencyCode)}
          </Text>
        )}
      </Pressable>

      {error ? <Alert variant="error">{error}</Alert> : null}

      <Button variant="primary" onPress={confirm} loading={submitting} disabled={!accountId}>
        {t('shared.settle.receiver_confirm')}
      </Button>

      <SelectSheet
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        title={t('shared.settle.receiver_account_label')}
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
            <Text className="text-sm text-text-soft">
              {fmtMoney(a.balance, settlement.currencyCode)}
            </Text>
          </Pressable>
        )}
      />
    </View>
  )
}
