'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Segmented } from '@/components/ui/segmented'
import { MoneyAmountInput } from '@/components/ui/money-amount-input'
import { parseMoneyInput } from '@grana/validation'
import type { BalanceCurrency } from '@grana/money-logic'
import { registerSettlement } from '@/app/_actions/shared'

// Native <select> styled to match the Input primitive (no Select primitive yet).
const SELECT_CLASS =
  'flex h-11 w-full rounded-[var(--radius-md)] border border-border bg-card px-3 py-2 text-sm text-text transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background'

type Props = {
  owed: Partial<Record<BalanceCurrency, number>>
  accounts: { id: string; name: string }[]
  partnerName: string
}

export function SettleForm({ owed, accounts, partnerName }: Props) {
  const t = useTranslations('shared')
  const router = useRouter()

  const currencies = Object.keys(owed) as BalanceCurrency[]
  const [currency, setCurrency] = useState<BalanceCurrency>(currencies[0])
  const [amount, setAmount] = useState(String(owed[currencies[0]] ?? ''))
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? '')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const onCurrencyChange = (c: BalanceCurrency) => {
    setCurrency(c)
    setAmount(String(owed[c] ?? ''))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const parsed = parseMoneyInput(amount)
    if (parsed === null || parsed <= 0 || !accountId) return
    setSubmitting(true)
    setError(null)
    try {
      const result = await registerSettlement({
        currency_code: currency,
        amount: parsed,
        account_id: accountId,
      })
      if (!result.ok) {
        const fieldError =
          'fieldErrors' in result ? Object.values(result.fieldErrors ?? {})[0] : undefined
        setError(result.formError ?? fieldError ?? 'Error')
        return
      }
      router.push('/shared')
      router.refresh()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
      <p className="text-sm text-text-muted">{t('settle.receiver_info', { name: partnerName })}</p>

      {error && <Alert variant="error">{error}</Alert>}

      {currencies.length > 1 && (
        <div className="flex flex-col gap-1.5">
          <Label>{t('settle.currency_label')}</Label>
          <Segmented
            value={currency}
            onValueChange={(c) => onCurrencyChange(c as BalanceCurrency)}
            ariaLabel={t('settle.currency_label')}
            options={currencies.map((c) => ({ value: c, label: c }))}
          />
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="settle-amount">{t('settle.amount_label')}</Label>
        <MoneyAmountInput id="settle-amount" value={amount} onChange={setAmount} />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="settle-account">{t('settle.account_label')}</Label>
        <select
          id="settle-account"
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

      <Button type="submit" loading={submitting} disabled={!accountId}>
        {t('settle.submit')}
      </Button>
    </form>
  )
}
