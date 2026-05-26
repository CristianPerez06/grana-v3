'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import type { TransactionWithDetails } from '@/lib/transactions/types'
import { updateExchange } from '@/app/_actions/transactions'
import { Money, parseMoneyInput } from '@grana/validation'
import { MoneyAmountInput } from '@/components/ui/money-amount-input'
import { checkNegativeBalance } from '@/lib/transactions/negative-balance-warning'
import { NegativeBalanceNotice } from '@/lib/transactions/components/negative-balance-notice'

const CURRENCY_SYMBOL: Record<'ARS' | 'USD', string> = { ARS: '$', USD: 'U$D' }

type Props = {
  transaction: TransactionWithDetails
  returnHref: string
  /** Available balance of the SOURCE account, per currency (for the soft warning). */
  availableBalances: Record<'ARS' | 'USD', number>
}

/**
 * Dedicated editor for a currency exchange. Only the two amounts, the date and
 * the description are editable; accounts and currencies are immutable (like a
 * transfer). The source-leg negative-balance warning uses the projected balance
 * that excludes this exchange's own current outflow.
 */
export const EditExchangeForm = ({ transaction, returnHref, availableBalances }: Props) => {
  const router = useRouter()
  const t = useTranslations('transactions')
  const tCommon = useTranslations('common')
  const [isPending, startTransition] = useTransition()
  const [formError, setFormError] = useState<string | null>(null)

  const sourceCurrency = transaction.currency_code
  const destCurrency = (transaction.destination_currency ?? 'USD') as 'ARS' | 'USD'

  const [amount, setAmount] = useState(String(Math.abs(transaction.amount)))
  const [destinationAmount, setDestinationAmount] = useState(
    String(transaction.destination_amount ?? ''),
  )
  const [date, setDate] = useState(transaction.date)
  const [description, setDescription] = useState(transaction.description ?? '')

  const negativeWarning = ((): { projected: number; currency: 'ARS' | 'USD' } | null => {
    const parsed = parseMoneyInput(amount)
    if (parsed === null || parsed <= 0) return null
    // Baseline excludes this exchange's own current outflow.
    const baseline = Money.toNumber(
      Money.add(Money.from(availableBalances[sourceCurrency] ?? 0), Money.from(transaction.amount)),
    )
    const check = checkNegativeBalance(baseline, parsed)
    return check.negative ? { projected: check.projected, currency: sourceCurrency } : null
  })()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)
    const parsedAmount = parseMoneyInput(amount)
    const parsedDest = parseMoneyInput(destinationAmount)
    if (parsedAmount === null || parsedAmount <= 0) {
      setFormError('El monto debe ser mayor a cero.')
      return
    }
    if (parsedDest === null || parsedDest <= 0) {
      setFormError('El monto recibido debe ser mayor a cero.')
      return
    }

    startTransition(async () => {
      const result = await updateExchange(
        transaction.id,
        transaction.account_id ?? '',
        transaction.transfer_destination_account_id ?? '',
        {
          amount: parsedAmount,
          destination_amount: parsedDest,
          date,
          description: description || null,
        },
      )
      if (!result.ok) {
        setFormError(result.formError ?? tCommon('save_changes'))
        return
      }
      router.push(returnHref)
    })
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      {/* Read-only: accounts + currencies */}
      <div className="flex flex-col gap-3 rounded-md border border-border bg-muted/30 p-4 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">{t('labels.source_account')}</span>
          <span>
            {transaction.source_account?.name ?? '—'} ({sourceCurrency})
            <span className="ml-2 text-xs text-muted-foreground">{tCommon('not_editable')}</span>
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">{t('labels.destination_account')}</span>
          <span>
            {transaction.destination_account?.name ?? '—'} ({destCurrency})
            <span className="ml-2 text-xs text-muted-foreground">{tCommon('not_editable')}</span>
          </span>
        </div>
      </div>

      {/* Source amount (what goes out) */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="amount" className="text-sm font-medium">{t('labels.amount')}</label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
            {CURRENCY_SYMBOL[sourceCurrency]}
          </span>
          <MoneyAmountInput
            id="amount"
            required
            value={amount}
            onChange={setAmount}
            className="w-full rounded-md border border-input bg-background pl-9 pr-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        {negativeWarning && (
          <NegativeBalanceNotice projected={negativeWarning.projected} currency={negativeWarning.currency} />
        )}
      </div>

      {/* Destination amount (what comes in) */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="dest-amount" className="text-sm font-medium">
          {t('labels.exchange_received')} ({destCurrency})
        </label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
            {CURRENCY_SYMBOL[destCurrency]}
          </span>
          <MoneyAmountInput
            id="dest-amount"
            required
            value={destinationAmount}
            onChange={setDestinationAmount}
            className="w-full rounded-md border border-input bg-background pl-9 pr-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
      </div>

      {/* Date */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="date" className="text-sm font-medium">{t('labels.date')}</label>
        <input
          id="date"
          type="date"
          required
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      {/* Description */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="description" className="text-sm font-medium">{t('labels.description')}</label>
        <input
          id="description"
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      {formError && <p className="text-sm text-destructive">{formError}</p>}

      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
      >
        {isPending ? tCommon('saving') : tCommon('save_changes')}
      </button>
    </form>
  )
}
