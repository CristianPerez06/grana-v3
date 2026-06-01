'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Alert } from '@/components/ui/alert'
import { MoneyAmountInput } from '@/components/ui/money-amount-input'
import { parseMoneyInput } from '@grana/validation'
import type { BalanceCurrency } from '@grana/money-logic'
import { registerSettlement } from '@/app/_actions/shared'

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
      <p className="text-sm text-muted-foreground">{t('settle.receiver_info', { name: partnerName })}</p>

      {error && <Alert variant="error">{error}</Alert>}

      {currencies.length > 1 && (
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-foreground">{t('settle.currency_label')}</label>
          <div className="flex rounded-md border border-input overflow-hidden">
            {currencies.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => onCurrencyChange(c)}
                className={`flex-1 px-3 py-2 text-sm font-medium ${
                  currency === c ? 'bg-primary text-primary-foreground' : 'bg-background'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-foreground">{t('settle.amount_label')}</label>
        <MoneyAmountInput value={amount} onChange={setAmount} />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-foreground">{t('settle.account_label')}</label>
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
      </div>

      <button
        type="submit"
        disabled={submitting || !accountId}
        className="inline-flex w-fit items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
      >
        {t('settle.submit')}
      </button>
    </form>
  )
}
