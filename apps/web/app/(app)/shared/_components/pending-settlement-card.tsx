'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { assignSettlementAccount } from '@/app/_actions/shared'
import type { PendingSettlement } from '@/lib/shared/types'
import { fmtMoney } from './money'

// Native <select> styled to match the Input primitive (no Select primitive yet).
const SELECT_CLASS =
  'flex h-11 w-full rounded-[var(--radius-md)] border border-border bg-card px-3 py-2 text-sm text-text transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background'

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
    <div className="flex flex-col gap-3 rounded-2xl border border-warning/30 bg-warning-soft p-4 shadow-sm">
      <p className="text-sm font-semibold text-text">
        {t('settle.pending_from', {
          amount: fmtMoney(settlement.amount, settlement.currencyCode),
          name: settlement.fromName,
        })}
      </p>
      {error && <Alert variant="error">{error}</Alert>}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`pending-account-${settlement.id}`} className="text-xs text-text-muted">
          {t('settle.receiver_account_label')}
        </Label>
        <select
          id={`pending-account-${settlement.id}`}
          value={accountId}
          onChange={(e) => setAccountId(e.target.value)}
          className={SELECT_CLASS}
        >
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </div>
      <Button
        type="button"
        onClick={onConfirm}
        loading={submitting}
        disabled={!accountId}
        className="w-auto self-start px-4"
      >
        {t('settle.receiver_confirm')}
      </Button>
    </div>
  )
}
