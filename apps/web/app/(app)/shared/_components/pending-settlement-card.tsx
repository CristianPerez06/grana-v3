'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Alert } from '@/components/ui/alert'
import { assignSettlementAccount } from '@/app/_actions/shared'
import type { PendingSettlement } from '@/lib/shared/types'
import { fmtMoney } from './money'

type Props = {
  settlement: PendingSettlement
  accounts: { id: string; name: string }[]
}

export function PendingSettlementCard({ settlement, accounts }: Props) {
  const t = useTranslations('shared')
  const router = useRouter()
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? '')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const onConfirm = async () => {
    if (!accountId) return
    setSubmitting(true)
    setError(null)
    try {
      const r = await assignSettlementAccount({
        settlement_id: settlement.id,
        account_id: accountId,
      })
      if (!r.ok) {
        setError(r.formError ?? r.fieldErrors?.account_id ?? 'Error')
        return
      }
      router.refresh()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4">
      <p className="text-sm font-medium text-foreground">
        {t('settle.pending_from', {
          amount: fmtMoney(settlement.amount, settlement.currencyCode),
          name: settlement.fromName,
        })}
      </p>
      {error && <Alert variant="error">{error}</Alert>}
      <label className="text-xs font-medium text-muted-foreground">
        {t('settle.receiver_account_label')}
      </label>
      <select
        value={accountId}
        onChange={(e) => setAccountId(e.target.value)}
        className="rounded-md border border-input bg-background px-3 py-2 text-sm"
      >
        {accounts.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={onConfirm}
        disabled={submitting || !accountId}
        className="inline-flex w-fit items-center rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {t('settle.receiver_confirm')}
      </button>
    </div>
  )
}
