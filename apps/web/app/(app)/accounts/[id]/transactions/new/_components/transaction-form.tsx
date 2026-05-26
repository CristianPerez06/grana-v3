'use client'

import { useState, useTransition, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { getTodayAR } from '@/lib/date'
import {
  createIncome,
  createExpense,
  createTransfer,
  createAdjustment,
} from '@/app/_actions/transactions'
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

type Tab = 'income' | 'expense' | 'transfer' | 'adjustment'

type OtherAccount = {
  id: string
  name: string
  currencies: ('ARS' | 'USD')[]
}

type Props = {
  accountId: string
  activeCurrencies: ('ARS' | 'USD')[]
  categories: CategoryWithSubcategories[]
  otherAccounts: OtherAccount[]
  /** Current available balance of this account, per currency (for the soft warning). */
  availableBalances: Record<'ARS' | 'USD', number>
}

const CURRENCY_SYMBOL: Record<'ARS' | 'USD', string> = { ARS: '$', USD: 'U$D' }

export const TransactionForm = ({
  accountId,
  activeCurrencies,
  categories,
  otherAccounts,
  availableBalances,
}: Props) => {
  const t = useTranslations('transactions')
  const tCommon = useTranslations('common')
  const TAB_LABELS: Record<Tab, string> = {
    income: t('types.income'),
    expense: t('types.expense'),
    transfer: t('types.transfer'),
    adjustment: t('types.adjustment'),
  }
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [tab, setTab] = useState<Tab>('income')
  const [formError, setFormError] = useState<string | null>(null)

  // Shared fields
  const [currencyCode, setCurrencyCode] = useState<'ARS' | 'USD'>(activeCurrencies[0] ?? 'ARS')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(todayStr())
  const [description, setDescription] = useState('')

  // Income/Expense fields
  const [categoryId, setCategoryId] = useState('')
  const [subcategoryId, setSubcategoryId] = useState('')

  // Transfer fields
  const [destinationAccountId, setDestinationAccountId] = useState('')
  const [transferCurrencyCode, setTransferCurrencyCode] = useState<'ARS' | 'USD'>(
    activeCurrencies[0] ?? 'ARS',
  )

  // Adjustment fields
  const [adjustmentDirection, setAdjustmentDirection] = useState<'increase' | 'decrease'>(
    'increase',
  )

  // Recurrence fields (not available on adjustments — out of scope)
  const [isRecurrent, setIsRecurrent] = useState(false)
  const [frequency, setFrequency] = useState<'weekly' | 'biweekly' | 'monthly' | 'annual'>(
    'monthly',
  )

  const expenseCategories = categories.filter((c) => c.type === 'expense' || c.type === 'both')
  const incomeCategories = categories.filter((c) => c.type === 'income' || c.type === 'both')
  const transactionCategories = tab === 'income' ? incomeCategories : expenseCategories
  const selectedCategory = transactionCategories.find((c) => c.id === categoryId)

  // Currencies shared between this account and the selected destination
  const sharedCurrencies = useMemo<('ARS' | 'USD')[]>(() => {
    if (!destinationAccountId) return []
    const dest = otherAccounts.find((a) => a.id === destinationAccountId)
    if (!dest) return []
    return activeCurrencies.filter((c) => dest.currencies.includes(c))
  }, [destinationAccountId, activeCurrencies, otherAccounts])

  // Soft, non-blocking warning: would this operation leave THIS account's
  // available balance (for the operation's currency) below zero? Only outflows
  // count — income and upward adjustments never warn. Compared per account and
  // per currency, never a cross-account total (spec).
  const negativeWarning = useMemo(() => {
    const parsed = parseMoneyInput(amount)
    if (parsed === null || parsed <= 0) return null

    let currency: 'ARS' | 'USD'
    if (tab === 'expense') {
      currency = currencyCode
    } else if (tab === 'transfer') {
      currency = transferCurrencyCode
    } else if (tab === 'adjustment' && adjustmentDirection === 'decrease') {
      currency = currencyCode
    } else {
      return null
    }

    const check = checkNegativeBalance(availableBalances[currency] ?? 0, parsed)
    return check.negative ? { projected: check.projected, currency } : null
  }, [amount, tab, currencyCode, transferCurrencyCode, adjustmentDirection, availableBalances])

  // Auto-select transfer currency when destination changes
  const handleDestinationChange = (newDestId: string) => {
    setDestinationAccountId(newDestId)
    const dest = otherAccounts.find((a) => a.id === newDestId)
    if (!dest) return
    const shared = activeCurrencies.filter((c) => dest.currencies.includes(c))
    if (shared.length > 0) setTransferCurrencyCode(shared[0])
  }

  const handleTabChange = (t: Tab) => {
    setTab(t)
    setCategoryId('')
    setSubcategoryId('')
    setFormError(null)
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
      } else if (tab === 'expense') {
        result = await createExpense({
          account_id: accountId,
          currency_code: currencyCode,
          amount: parsedAmount,
          date,
          category_id: categoryId || undefined,
          subcategory_id: subcategoryId || undefined,
          description: description || undefined,
        })
      } else if (tab === 'transfer') {
        result = await createTransfer({
          account_id: accountId,
          transfer_destination_account_id: destinationAccountId,
          currency_code: transferCurrencyCode,
          amount: parsedAmount,
          date,
          description: description || undefined,
        })
      } else {
        // adjustment
        const signedAmount =
          adjustmentDirection === 'decrease' ? -Math.abs(parsedAmount) : Math.abs(parsedAmount)
        result = await createAdjustment({
          account_id: accountId,
          currency_code: currencyCode,
          amount: signedAmount,
          date,
          description: description || undefined,
        })
      }

      if (!result.ok) {
        setFormError(result.formError ?? t('errors.save_failed'))
        return
      }

      if (isRecurrent && tab !== 'adjustment' && result.id) {
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

      router.push(`/accounts/${accountId}`)
    })
  }

  const showCurrencySelector = activeCurrencies.length > 1
  const transferCurrencyOptions = sharedCurrencies.length > 0 ? sharedCurrencies : activeCurrencies

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      {/* Tabs */}
      <div className="flex rounded-md border border-border p-0.5 w-fit flex-wrap gap-y-1">
        {(['income', 'expense', 'transfer', 'adjustment'] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => handleTabChange(t)}
            className={`px-4 py-1.5 text-sm font-medium rounded transition-colors ${
              tab === t
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>

      {/* ── Transfer: destination account ──────────────────────────────────────── */}
      {tab === 'transfer' && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="destination" className="text-sm font-medium">
            {t('labels.destination_account')} <span className="text-destructive">*</span>
          </label>
          {otherAccounts.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t('errors.no_other_accounts')}
            </p>
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
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      {/* ── Currency selector ──────────────────────────────────────────────────── */}
      {tab === 'transfer' && destinationAccountId && (
        <>
          {transferCurrencyOptions.length === 0 ? (
            <p className="text-sm text-destructive">
              {t('errors.no_shared_currencies')}
            </p>
          ) : transferCurrencyOptions.length > 1 ? (
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">{t('labels.currency')}</label>
              <div className="flex gap-2">
                {transferCurrencyOptions.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setTransferCurrencyCode(c)}
                    className={`px-3 py-1.5 text-sm rounded border transition-colors ${
                      transferCurrencyCode === c
                        ? 'border-primary bg-primary/10 text-primary font-medium'
                        : 'border-border text-muted-foreground hover:border-foreground'
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </>
      )}

      {tab !== 'transfer' && showCurrencySelector && (
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">{t('labels.currency')}</label>
          <div className="flex gap-2">
            {activeCurrencies.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCurrencyCode(c)}
                className={`px-3 py-1.5 text-sm rounded border transition-colors ${
                  currencyCode === c
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

      {/* ── Adjustment: direction ─────────────────────────────────────────────── */}
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

      {/* ── Amount ───────────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="amount" className="text-sm font-medium">{t('labels.amount')}</label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
            {CURRENCY_SYMBOL[tab === 'transfer' ? transferCurrencyCode : currencyCode]}
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
          <NegativeBalanceNotice
            projected={negativeWarning.projected}
            currency={negativeWarning.currency}
          />
        )}
      </div>

      {/* ── Date ─────────────────────────────────────────────────────────────── */}
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

      {/* ── Category (income/expense, required) ──────────────────────────────── */}
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

      {/* ── Subcategory ──────────────────────────────────────────────────────── */}
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

      {/* ── Description ──────────────────────────────────────────────────────── */}
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

      {/* ── Recurrente ───────────────────────────────────────────────────────── */}
      {tab !== 'adjustment' && (
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
              <label htmlFor="frequency" className="text-xs text-muted-foreground">
                {t('labels.frequency')}
              </label>
              <select
                id="frequency"
                value={frequency}
                onChange={(e) =>
                  setFrequency(e.target.value as typeof frequency)
                }
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

      {formError && (
        <p className="text-sm text-destructive">{formError}</p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
      >
        {isPending ? tCommon('saving') : t('actions.create')}
      </button>
    </form>
  )
}
