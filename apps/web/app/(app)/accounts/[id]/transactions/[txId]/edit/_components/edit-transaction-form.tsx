'use client'

import { useState, useTransition, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import type { TransactionWithDetails } from '@/lib/transactions/types'
import type { CategoryWithSubcategories } from '@/lib/categories/types'
import { updateTransaction, updateTransfer, updateAdjustment } from '@/app/_actions/transactions'
import { updateInstallmentParent } from '@/app/_actions/credit-cards'
import { Money, parseMoneyInput } from '@grana/validation'
import { MoneyAmountInput } from '@/components/ui/money-amount-input'
import { checkNegativeBalance } from '@/lib/transactions/negative-balance-warning'
import { NegativeBalanceNotice } from '@/lib/transactions/components/negative-balance-notice'

type Props = {
  transaction: TransactionWithDetails
  accountId: string
  categories: CategoryWithSubcategories[]
  returnHref: string
  /** Current available balance of the movement's own account, per currency. */
  availableBalances: Record<'ARS' | 'USD', number>
  /** False only for a paid credit-card purchase (single or installment). */
  amountEditable: boolean
}

export const EditTransactionForm = ({
  transaction,
  accountId,
  categories,
  returnHref,
  availableBalances,
  amountEditable,
}: Props) => {
  const t = useTranslations('transactions')
  const tCommon = useTranslations('common')
  const TYPE_LABELS = {
    income: t('types.income'),
    expense: t('types.expense'),
    transfer: t('types.transfer'),
    adjustment: t('types.adjustment'),
    exchange: t('types.exchange'),
  }
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [formError, setFormError] = useState<string | null>(null)

  const { type } = transaction
  // Installment parent (madre): only category/subcategory/description are
  // editable, and they propagate to every child via updateInstallmentParent.
  const isParent = transaction.is_parent === true

  // For income/expense, amount is always positive in DB
  // For adjustment, amount is signed — we show absolute value + direction radio
  const absAmount = Math.abs(transaction.amount)
  const initialDirection: 'increase' | 'decrease' =
    type === 'adjustment' && transaction.amount < 0 ? 'decrease' : 'increase'

  const [amount, setAmount] = useState(String(absAmount))
  const [date, setDate] = useState(transaction.date)
  const [categoryId, setCategoryId] = useState(transaction.category_id ?? '')
  const [subcategoryId, setSubcategoryId] = useState(transaction.subcategory_id ?? '')
  const [description, setDescription] = useState(transaction.description ?? '')
  const [adjustmentDirection, setAdjustmentDirection] = useState<'increase' | 'decrease'>(
    initialDirection,
  )

  const isExpense = type === 'expense'
  const isCardPayment =
    Array.isArray(transaction.period_payments) && transaction.period_payments.length > 0
  const filteredCategories = categories.filter(
    (c) =>
      isExpense
        ? c.type === 'expense' || c.type === 'both'
        : c.type === 'income' || c.type === 'both',
  )
  const selectedCategory = filteredCategories.find((c) => c.id === categoryId)

  // Soft, non-blocking warning. Compares against the available balance that
  // EXCLUDES this movement's own current effect, so editing a movement does not
  // "warn against itself". Only outflows (expense, outgoing transfer, downward
  // adjustment) warn; income, upward adjustments and the installment parent do not.
  const negativeWarning = useMemo(() => {
    if (isParent) return null
    // Credit-card movements (status pending/paid) are off-ledger → never warn.
    if (transaction.status !== null) return null
    if (type !== 'expense' && type !== 'transfer' && type !== 'adjustment') return null
    const parsed = parseMoneyInput(amount)
    if (parsed === null || parsed <= 0) return null

    const currency = transaction.currency_code as 'ARS' | 'USD'
    const current = availableBalances[currency] ?? 0

    let baseline: number
    let outflow: number
    if (type === 'adjustment') {
      // current already includes the old signed adjustment → remove it.
      baseline = Money.toNumber(Money.subtract(Money.from(current), Money.from(transaction.amount)))
      outflow = adjustmentDirection === 'decrease' ? parsed : 0
    } else {
      // current already includes -oldAmount (expense / outgoing transfer) → add it back.
      baseline = Money.toNumber(Money.add(Money.from(current), Money.from(transaction.amount)))
      outflow = parsed
    }

    const check = checkNegativeBalance(baseline, outflow)
    return check.negative ? { projected: check.projected, currency } : null
  }, [
    isParent,
    type,
    amount,
    adjustmentDirection,
    availableBalances,
    transaction.amount,
    transaction.currency_code,
    transaction.status,
  ])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)

    let parsedAmount: number | null = null
    if (amountEditable) {
      parsedAmount = parseMoneyInput(amount)
      if (parsedAmount === null || parsedAmount <= 0) {
        setFormError(t('errors.amount_positive'))
        return
      }
    }

    startTransition(async () => {
      let result

      if (isParent) {
        // Installment parent: category/description always; amount only when no
        // installment is paid (the action re-splits the children).
        result = await updateInstallmentParent(transaction.id, {
          category_id: categoryId || null,
          subcategory_id: subcategoryId || null,
          description: description || null,
          ...(amountEditable && parsedAmount !== null ? { amount: parsedAmount } : {}),
        })
      } else if (type === 'transfer') {
        result = await updateTransfer(
          transaction.id,
          accountId,
          transaction.transfer_destination_account_id ?? '',
          {
            amount: parsedAmount!,
            date,
            description: description || null,
          },
        )
      } else if (type === 'adjustment') {
        const signedAmount =
          adjustmentDirection === 'decrease'
            ? -Math.abs(parsedAmount!)
            : Math.abs(parsedAmount!)
        result = await updateAdjustment(transaction.id, accountId, {
          amount: signedAmount,
          date,
          description: description || null,
        })
      } else {
        // income / expense (incl. credit-card consumption). A paid consumption
        // locks amount and date — send only category/description.
        result = await updateTransaction(transaction.id, accountId, {
          ...(amountEditable && parsedAmount !== null ? { amount: parsedAmount, date } : {}),
          category_id: categoryId || null,
          subcategory_id: subcategoryId || null,
          description: description || null,
        })
      }

      if (!result.ok) {
        setFormError(result.formError ?? t('errors.save_failed_short'))
        return
      }

      router.push(returnHref)
    })
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      {/* Read-only fields */}
      <div className="flex flex-col gap-3 rounded-md border border-border bg-muted/30 p-4 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">{t('labels.type')}</span>
          <span>
            {isParent ? t('installment_purchase_label') : TYPE_LABELS[type]}
            <span className="ml-2 text-xs text-muted-foreground">{tCommon('not_editable')}</span>
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">{t('labels.currency')}</span>
          <span>
            {transaction.currency_code}
            <span className="ml-2 text-xs text-muted-foreground">{tCommon('not_editable')}</span>
          </span>
        </div>
        {isParent && transaction.installments_total && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t('labels.installments')}</span>
            <span>
              {t('installments_count', { count: transaction.installments_total })}
              <span className="ml-2 text-xs text-muted-foreground">{tCommon('not_editable')}</span>
            </span>
          </div>
        )}
        {type === 'transfer' && (
          <>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t('labels.source_account')}</span>
              <span>
                {transaction.source_account?.name ?? accountId}
                <span className="ml-2 text-xs text-muted-foreground">{tCommon('not_editable')}</span>
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t('labels.destination_account')}</span>
              <span>
                {transaction.destination_account?.name ?? '—'}
                <span className="ml-2 text-xs text-muted-foreground">{tCommon('not_editable')}</span>
              </span>
            </div>
          </>
        )}
      </div>

      {/* Adjustment direction */}
      {type === 'adjustment' && (
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

      {/* Amount — editable unless a paid card purchase. For an unpaid
          installment parent, changing it re-splits the children. */}
      {amountEditable && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="amount" className="text-sm font-medium">{t('labels.amount')}</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
              {transaction.currency_code === 'ARS' ? '$' : 'U$D'}
            </span>
            <MoneyAmountInput
              id="amount"
              required
              value={amount}
              onChange={setAmount}
              className="w-full rounded-md border border-input bg-background pl-9 pr-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          {isParent && (
            <p className="text-xs text-muted-foreground">
              {t('installment_recalc_hint', { count: transaction.installments_total ?? 0 })}
            </p>
          )}
          {negativeWarning && (
            <NegativeBalanceNotice
              projected={negativeWarning.projected}
              currency={negativeWarning.currency}
            />
          )}
        </div>
      )}

      {/* Date — editable for normal/unpaid movements, never for an installment
          parent (its date drives the cuotas' periods). */}
      {!isParent && amountEditable && (
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
      )}

      {/* Category (income/expense and installment parent). Card payment
          expenses have no category — payCardPeriod inserts them with
          category_id=null on purpose, so hide the field entirely for them. */}
      {(type === 'income' || type === 'expense') && !isCardPayment && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="category" className="text-sm font-medium">
            {t('labels.category')} {isExpense && <span className="text-destructive">*</span>}
            {!isExpense && <span className="text-muted-foreground text-xs ml-1">{tCommon('optional')}</span>}
          </label>
          <select
            id="category"
            required={isExpense}
            value={categoryId}
            onChange={(e) => { setCategoryId(e.target.value); setSubcategoryId('') }}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="">{t('placeholders.no_category')}</option>
            {filteredCategories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* Subcategory */}
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

      {/* Description */}
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
