'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { getTodayAR } from '@/lib/date'
import {
  createIncome,
  createExpense,
  createTransfer,
  createAdjustment,
  createExchange,
} from '@/app/_actions/transactions'
import { registerCardPurchase, registerInstallments } from '@/app/_actions/credit-cards'
import { createRecurrenceFromMovement } from '@/app/_actions/recurrences'
import { parseMoneyInput } from '@grana/validation'
import { MoneyAmountInput } from '@/components/ui/money-amount-input'
import { checkNegativeBalance } from '@/lib/transactions/negative-balance-warning'
import { NegativeBalanceNotice } from '@/lib/transactions/components/negative-balance-notice'
import type { CategoryWithSubcategories } from '@/lib/categories/types'

const todayStr = () => {
  const d = getTodayAR()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

type Tab = 'income' | 'expense' | 'transfer' | 'adjustment' | 'exchange'

export type MovementFormAccount = {
  id: string
  name: string
  type: 'cash' | 'bank' | 'credit'
  activeCurrencies: ('ARS' | 'USD')[]
  /** Current available balance per currency. {0,0} for credit (off-ledger). */
  balances: Record<'ARS' | 'USD', number>
}

type Props = {
  accounts: MovementFormAccount[]
  categories: CategoryWithSubcategories[]
}

const CURRENCY_SYMBOL: Record<'ARS' | 'USD', string> = { ARS: '$', USD: 'U$D' }

const INSTALLMENT_OPTIONS = [1, 2, 3, 6, 9, 12, 18, 24]

// Accounts eligible per type: only Gasto can target a credit card.
const eligibleFor = (accounts: MovementFormAccount[], tab: Tab) =>
  tab === 'expense' ? accounts : accounts.filter((a) => a.type !== 'credit')

export const MovementForm = ({ accounts, categories }: Props) => {
  const router = useRouter()
  const t = useTranslations('transactions')
  const tCommon = useTranslations('common')
  const TAB_LABELS: Record<Tab, string> = {
    income: t('tabs.income'),
    expense: t('tabs.expense'),
    transfer: t('tabs.transfer'),
    adjustment: t('tabs.adjustment'),
    exchange: t('tabs.exchange'),
  }
  const [isPending, startTransition] = useTransition()
  const [tab, setTab] = useState<Tab>('income')
  const [formError, setFormError] = useState<string | null>(null)

  const firstFor = (t: Tab) => eligibleFor(accounts, t)[0]

  const [accountId, setAccountId] = useState(firstFor('income')?.id ?? accounts[0]?.id ?? '')
  const [currencyCode, setCurrencyCode] = useState<'ARS' | 'USD'>(
    firstFor('income')?.activeCurrencies[0] ?? 'ARS',
  )
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(todayStr())
  const [description, setDescription] = useState('')

  const [categoryId, setCategoryId] = useState('')
  const [subcategoryId, setSubcategoryId] = useState('')

  const [destinationAccountId, setDestinationAccountId] = useState('')
  // Exchange: received-leg amount. Destination currency is derived (the other
  // currency the destination account holds, ≠ source currency).
  const [destinationAmount, setDestinationAmount] = useState('')

  const [adjustmentDirection, setAdjustmentDirection] = useState<'increase' | 'decrease'>('increase')

  const [installments, setInstallments] = useState('1')
  const [fxRate, setFxRate] = useState('')

  const [isRecurrent, setIsRecurrent] = useState(false)
  const [frequency, setFrequency] = useState<'weekly' | 'biweekly' | 'monthly' | 'annual'>('monthly')

  if (accounts.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">{t('empty.no_accounts')}</p>
    )
  }

  const eligibleAccounts = eligibleFor(accounts, tab)
  const selectedAccount = accounts.find((a) => a.id === accountId) ?? eligibleAccounts[0]
  const isCredit = selectedAccount?.type === 'credit'
  const activeCurrencies = selectedAccount?.activeCurrencies ?? ['ARS']

  const cashBank = accounts.filter((a) => a.type !== 'credit')
  const creditCards = accounts.filter((a) => a.type === 'credit')

  // Transfer destinations: the other cash/bank accounts.
  const otherAccounts = cashBank.filter((a) => a.id !== selectedAccount?.id)
  const destinationAccount = otherAccounts.find((a) => a.id === destinationAccountId)
  const sharedCurrencies = destinationAccount
    ? activeCurrencies.filter((c) => destinationAccount.activeCurrencies.includes(c))
    : []

  // Exchange: destination account may be ANY cash/bank (including the source
  // account itself). The destination currency is derived as the other currency
  // that account holds (≠ source currency).
  const exchangeDestAccount = cashBank.find((a) => a.id === destinationAccountId)
  const exchangeDestCurrency =
    exchangeDestAccount?.activeCurrencies.find((c) => c !== currencyCode) ?? null

  const isInstallments = isCredit && currencyCode === 'ARS' && parseInt(installments) >= 2
  const isUSDCard = isCredit && currencyCode === 'USD'

  const expenseCategories = categories.filter((c) => c.type === 'expense' || c.type === 'both')
  const incomeCategories = categories.filter((c) => c.type === 'income' || c.type === 'both')
  const transactionCategories = tab === 'income' ? incomeCategories : expenseCategories
  const selectedCategory = transactionCategories.find((c) => c.id === categoryId)

  const effectiveCurrency = tab === 'transfer'
    ? (sharedCurrencies.includes(currencyCode) ? currencyCode : sharedCurrencies[0] ?? currencyCode)
    : currencyCode

  // Soft, non-blocking warning. Outflows only, cash/bank only (credit is off-ledger).
  // Plain computation (not a hook): it runs after the early return above.
  const negativeWarning = ((): { projected: number; currency: 'ARS' | 'USD' } | null => {
    if (!selectedAccount || selectedAccount.type === 'credit') return null
    const parsed = parseMoneyInput(amount)
    if (parsed === null || parsed <= 0) return null

    let currency: 'ARS' | 'USD'
    if (tab === 'expense') currency = currencyCode
    else if (tab === 'transfer') currency = effectiveCurrency
    else if (tab === 'exchange') currency = currencyCode
    else if (tab === 'adjustment' && adjustmentDirection === 'decrease') currency = currencyCode
    else return null

    const check = checkNegativeBalance(selectedAccount.balances[currency] ?? 0, parsed)
    return check.negative ? { projected: check.projected, currency } : null
  })()

  const handleTabChange = (t: Tab) => {
    setTab(t)
    setCategoryId('')
    setSubcategoryId('')
    setFormError(null)
    setInstallments('1')
    setFxRate('')
    // Keep the account if still eligible, otherwise jump to the first eligible one.
    const eligible = eligibleFor(accounts, t)
    const srcId = eligible.some((a) => a.id === accountId) ? accountId : eligible[0]?.id ?? ''
    if (srcId !== accountId) {
      setAccountId(srcId)
      const next = accounts.find((a) => a.id === srcId)
      if (next && !next.activeCurrencies.includes(currencyCode)) {
        setCurrencyCode(next.activeCurrencies[0] ?? 'ARS')
      }
    }
    if (t === 'exchange') {
      // Default to converting within the same account (the common case).
      setDestinationAccountId(srcId)
      setDestinationAmount('')
    }
  }

  const handleAccountChange = (id: string) => {
    setAccountId(id)
    setInstallments('1')
    setFxRate('')
    const account = accounts.find((a) => a.id === id)
    if (account && !account.activeCurrencies.includes(currencyCode)) {
      setCurrencyCode(account.activeCurrencies[0] ?? 'ARS')
    }
  }

  const handleDestinationChange = (id: string) => {
    setDestinationAccountId(id)
    const dest = otherAccounts.find((a) => a.id === id)
    if (dest) {
      const shared = activeCurrencies.filter((c) => dest.activeCurrencies.includes(c))
      if (shared.length > 0 && !shared.includes(currencyCode)) setCurrencyCode(shared[0])
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)

    const parsedAmount = parseMoneyInput(amount)
    if (parsedAmount === null || parsedAmount <= 0) {
      setFormError(t('errors.amount_positive'))
      return
    }
    if ((tab === 'income' || tab === 'expense') && !categoryId) {
      setFormError(t('errors.category_required_short'))
      return
    }
    if (tab === 'transfer' && !destinationAccountId) {
      setFormError(t('errors.destination_required_short'))
      return
    }
    let parsedDestinationAmount: number | null = null
    if (tab === 'exchange') {
      if (!destinationAccountId) {
        setFormError('Seleccioná la cuenta destino.')
        return
      }
      if (!exchangeDestCurrency) {
        setFormError('La cuenta destino no tiene otra moneda para el cambio.')
        return
      }
      parsedDestinationAmount = parseMoneyInput(destinationAmount)
      if (parsedDestinationAmount === null || parsedDestinationAmount <= 0) {
        setFormError('El monto recibido debe ser mayor a cero.')
        return
      }
    }
    const parsedFxRate = fxRate ? parseMoneyInput(fxRate, { decimalPlaces: 6 }) : undefined
    if (isUSDCard && (parsedFxRate === null || parsedFxRate === undefined || parsedFxRate <= 0)) {
      setFormError(t('errors.exchange_rate_invalid'))
      return
    }

    startTransition(async () => {
      let result

      if (tab === 'income') {
        result = await createIncome({
          account_id: accountId,
          currency_code: currencyCode,
          amount: parsedAmount,
          date,
          category_id: categoryId,
          subcategory_id: subcategoryId || undefined,
          description: description || undefined,
        })
      } else if (tab === 'transfer') {
        result = await createTransfer({
          account_id: accountId,
          transfer_destination_account_id: destinationAccountId,
          currency_code: effectiveCurrency,
          amount: parsedAmount,
          date,
          description: description || undefined,
        })
      } else if (tab === 'adjustment') {
        const signedAmount =
          adjustmentDirection === 'decrease' ? -Math.abs(parsedAmount) : Math.abs(parsedAmount)
        result = await createAdjustment({
          account_id: accountId,
          currency_code: currencyCode,
          amount: signedAmount,
          date,
          description: description || undefined,
        })
      } else if (tab === 'exchange') {
        result = await createExchange({
          account_id: accountId,
          currency_code: currencyCode,
          amount: parsedAmount,
          transfer_destination_account_id: destinationAccountId,
          destination_currency: exchangeDestCurrency!,
          destination_amount: parsedDestinationAmount!,
          date,
          description: description || undefined,
        })
      } else if (isCredit) {
        // Gasto en tarjeta de crédito → consumo.
        if (isInstallments) {
          result = await registerInstallments({
            account_id: accountId,
            currency_code: 'ARS',
            amount: parsedAmount,
            date,
            category_id: categoryId,
            subcategory_id: subcategoryId || undefined,
            description: description || undefined,
            installments_total: parseInt(installments),
          })
        } else {
          result = await registerCardPurchase({
            account_id: accountId,
            currency_code: currencyCode,
            amount: parsedAmount,
            date,
            category_id: categoryId,
            subcategory_id: subcategoryId || undefined,
            description: description || undefined,
            fx_rate_to_ars: parsedFxRate ?? undefined,
          })
        }
      } else {
        result = await createExpense({
          account_id: accountId,
          currency_code: currencyCode,
          amount: parsedAmount,
          date,
          category_id: categoryId || undefined,
          subcategory_id: subcategoryId || undefined,
          description: description || undefined,
        })
      }

      if (!result.ok) {
        setFormError(result.formError ?? t('errors.save_failed'))
        return
      }

      // Recurrence: not for adjustments nor for installment purchases.
      if (isRecurrent && tab !== 'adjustment' && tab !== 'exchange' && !isInstallments && 'id' in result && result.id) {
        const recurrenceResult = await createRecurrenceFromMovement({
          transaction_id: result.id,
          frequency,
        })
        if (!recurrenceResult.ok) {
          setFormError(
            t('errors.recurrence_failed', {
              detail: recurrenceResult.formError ?? t('errors.recurrence_unknown_error'),
            }),
          )
          return
        }
      }

      router.push('/transactions')
    })
  }

  const currencyOptions = tab === 'transfer'
    ? (sharedCurrencies.length > 0 ? sharedCurrencies : activeCurrencies)
    : activeCurrencies

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      {/* ── Type tabs ──────────────────────────────────────────────────────── */}
      <div className="flex rounded-md border border-border p-0.5 w-fit flex-wrap gap-y-1">
        {(['income', 'expense', 'transfer', 'adjustment', 'exchange'] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => handleTabChange(t)}
            className={`px-4 py-1.5 text-sm font-medium rounded transition-colors ${
              tab === t ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>

      {/* ── Account (after the type, v2-style) ─────────────────────────────── */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="account" className="text-sm font-medium">
          {tab === 'transfer' || tab === 'exchange' ? t('labels.source_account') : t('labels.account')}
        </label>
        <select
          id="account"
          value={selectedAccount?.id ?? ''}
          onChange={(e) => handleAccountChange(e.target.value)}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {cashBank.length > 0 && (
            <optgroup label={t('account_groups.cash_bank')}>
              {cashBank.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </optgroup>
          )}
          {tab === 'expense' && creditCards.length > 0 && (
            <optgroup label={t('account_groups.credit_cards')}>
              {creditCards.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </optgroup>
          )}
        </select>
      </div>

      {/* ── Transfer: destination account ──────────────────────────────────── */}
      {tab === 'transfer' && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="destination" className="text-sm font-medium">
            {t('labels.destination_account')} <span className="text-destructive">*</span>
          </label>
          {otherAccounts.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('errors.no_other_accounts')}</p>
          ) : (
            <select
              id="destination"
              required
              value={destinationAccountId}
              onChange={(e) => handleDestinationChange(e.target.value)}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">{t('placeholders.destination_account')}</option>
              {otherAccounts.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          )}
        </div>
      )}

      {/* ── Currency ───────────────────────────────────────────────────────── */}
      {currencyOptions.length > 1 && (
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">{t('labels.currency')}</label>
          <div className="flex gap-2">
            {currencyOptions.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => { setCurrencyCode(c); setInstallments('1'); setFxRate('') }}
                className={`px-3 py-1.5 text-sm rounded border transition-colors ${
                  effectiveCurrency === c
                    ? 'border-primary bg-primary/10 text-primary font-medium'
                    : 'border-border text-muted-foreground hover:border-foreground'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Adjustment direction ───────────────────────────────────────────── */}
      {tab === 'adjustment' && (
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">{t('labels.direction')}</label>
          <div className="flex gap-3">
            {(['increase', 'decrease'] as const).map((dir) => (
              <label key={dir} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="direction"
                  value={dir}
                  checked={adjustmentDirection === dir}
                  onChange={() => setAdjustmentDirection(dir)}
                  className="accent-primary"
                />
                <span className="text-sm">{dir === 'increase' ? t('directions.increase') : t('directions.decrease')}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* ── Amount ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="amount" className="text-sm font-medium">{t('labels.amount')}</label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
            {CURRENCY_SYMBOL[effectiveCurrency]}
          </span>
          <MoneyAmountInput
            id="amount"
            required
            value={amount}
            onChange={setAmount}
            placeholder={t('placeholders.amount')}
            className="w-full rounded-md border border-input bg-background pl-9 pr-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        {negativeWarning && (
          <NegativeBalanceNotice projected={negativeWarning.projected} currency={negativeWarning.currency} />
        )}
      </div>

      {/* ── Exchange: destination leg ──────────────────────────────────────── */}
      {tab === 'exchange' && (
        <>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="exchange-dest" className="text-sm font-medium">
              Cuenta destino <span className="text-destructive">*</span>
            </label>
            <select
              id="exchange-dest"
              required
              value={destinationAccountId}
              onChange={(e) => setDestinationAccountId(e.target.value)}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">Seleccioná la cuenta destino</option>
              {cashBank.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.id === accountId ? `${a.name} (misma cuenta)` : a.name}
                </option>
              ))}
            </select>
          </div>

          {exchangeDestCurrency ? (
            <div className="flex flex-col gap-1.5">
              <label htmlFor="exchange-dest-amount" className="text-sm font-medium">
                Monto recibido ({exchangeDestCurrency})
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                  {CURRENCY_SYMBOL[exchangeDestCurrency]}
                </span>
                <MoneyAmountInput
                  id="exchange-dest-amount"
                  required
                  value={destinationAmount}
                  onChange={setDestinationAmount}
                  placeholder="0,00"
                  className="w-full rounded-md border border-input bg-background pl-9 pr-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Esa cuenta no tiene activada otra moneda. Elegí una cuenta con{' '}
              {currencyCode === 'ARS' ? 'USD' : 'ARS'} para poder cambiar.
            </p>
          )}
        </>
      )}

      {/* ── Installments (Gasto + tarjeta + ARS) ───────────────────────────── */}
      {tab === 'expense' && isCredit && currencyCode === 'ARS' && (
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">{t('labels.installments')}</label>
          <div className="flex gap-2 flex-wrap">
            {INSTALLMENT_OPTIONS.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setInstallments(String(n))}
                className={`px-3 py-1.5 text-sm rounded border transition-colors ${
                  installments === String(n)
                    ? 'border-primary bg-primary/10 text-primary font-medium'
                    : 'border-border text-muted-foreground hover:border-foreground'
                }`}
              >
                {n === 1 ? t('installments_options.none') : t('installments_options.count', { n })}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">{t('installments_options.ars_only_hint')}</p>
        </div>
      )}

      {/* ── FX rate (Gasto + tarjeta + USD) ────────────────────────────────── */}
      {tab === 'expense' && isUSDCard && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="fx_rate" className="text-sm font-medium">{t('labels.fx_rate_label')}</label>
          <MoneyAmountInput
            id="fx_rate"
            required
            value={fxRate}
            onChange={setFxRate}
            placeholder={t('labels.fx_rate_daily')}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
      )}

      {/* ── Date ───────────────────────────────────────────────────────────── */}
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

      {/* ── Category (income/expense) ──────────────────────────────────────── */}
      {(tab === 'income' || tab === 'expense') && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="category" className="text-sm font-medium">
            {t('labels.category')} <span className="text-destructive">*</span>
          </label>
          <select
            id="category"
            required
            value={categoryId}
            onChange={(e) => { setCategoryId(e.target.value); setSubcategoryId('') }}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="">{t('placeholders.category')}</option>
            {transactionCategories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* ── Subcategory ────────────────────────────────────────────────────── */}
      {selectedCategory && selectedCategory.subcategories.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="subcategory" className="text-sm font-medium">
            {t('labels.subcategory')} <span className="text-muted-foreground text-xs">{tCommon('optional')}</span>
          </label>
          <select
            id="subcategory"
            value={subcategoryId}
            onChange={(e) => setSubcategoryId(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="">{t('placeholders.no_subcategory')}</option>
            {selectedCategory.subcategories.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* ── Description ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="description" className="text-sm font-medium">
          {t('labels.description')} <span className="text-muted-foreground text-xs">{tCommon('optional')}</span>
        </label>
        <input
          id="description"
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={t('placeholders.description')}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      {/* ── Recurrente (no en ajuste, cambio ni cuotas) ────────────────────── */}
      {tab !== 'adjustment' && tab !== 'exchange' && !isInstallments && (
        <div className="flex flex-col gap-2 rounded-md border border-border p-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isRecurrent}
              onChange={(e) => setIsRecurrent(e.target.checked)}
              className="accent-primary"
            />
            <span className="text-sm font-medium">{t('labels.make_recurrent')}</span>
          </label>
          {isRecurrent && (
            <div className="flex flex-col gap-1.5">
              <label htmlFor="frequency" className="text-xs text-muted-foreground">{t('labels.frequency')}</label>
              <select
                id="frequency"
                value={frequency}
                onChange={(e) => setFrequency(e.target.value as typeof frequency)}
                className="rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="weekly">{t('frequencies.weekly')}</option>
                <option value="biweekly">{t('frequencies.biweekly')}</option>
                <option value="monthly">{t('frequencies.monthly')}</option>
                <option value="annual">{t('frequencies.annual')}</option>
              </select>
            </div>
          )}
        </div>
      )}

      {formError && <p className="text-sm text-destructive">{formError}</p>}

      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
      >
        {isPending
          ? tCommon('saving')
          : isInstallments
            ? t('actions.register_installments', { count: parseInt(installments) })
            : tab === 'exchange'
              ? t('actions.register_exchange')
              : t('actions.create')}
      </button>
    </form>
  )
}
