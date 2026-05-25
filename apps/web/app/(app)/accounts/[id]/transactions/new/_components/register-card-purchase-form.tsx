'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { getTodayAR } from '@/lib/date'
import { registerCardPurchase, registerInstallments } from '@/app/_actions/credit-cards'
import { createRecurrenceFromMovement } from '@/app/_actions/recurrences'
import { parseMoneyInput } from '@grana/validation'
import { MoneyAmountInput } from '@/components/ui/money-amount-input'
import type { CategoryWithSubcategories } from '@/lib/categories/types'

const todayStr = () => {
  const d = getTodayAR()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

type Props = {
  accountId: string
  activeCurrencies: ('ARS' | 'USD')[]
  categories: CategoryWithSubcategories[]
}

export const RegisterCardPurchaseForm = ({ accountId, activeCurrencies, categories }: Props) => {
  const t = useTranslations('transactions')
  const tCommon = useTranslations('common')
  const tCards = useTranslations('cards')
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [formError, setFormError] = useState<string | null>(null)

  const [currency, setCurrency] = useState<'ARS' | 'USD'>(activeCurrencies[0] ?? 'ARS')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(todayStr())
  const [categoryId, setCategoryId] = useState('')
  const [subcategoryId, setSubcategoryId] = useState('')
  const [description, setDescription] = useState('')
  const [installments, setInstallments] = useState('1')
  const [fxRate, setFxRate] = useState('')
  const [isRecurrent, setIsRecurrent] = useState(false)
  const [frequency, setFrequency] = useState<'weekly' | 'biweekly' | 'monthly' | 'annual'>(
    'monthly',
  )

  const expenseCategories = categories.filter((c) => c.type === 'expense' || c.type === 'both')
  const selectedCategory = expenseCategories.find((c) => c.id === categoryId)
  const isInstallments = currency === 'ARS' && parseInt(installments) >= 2
  const isUSD = currency !== 'ARS'

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)

    const parsedAmount = parseMoneyInput(amount)
    const parsedInstallments = parseInt(installments)
    const parsedFxRate = fxRate ? parseMoneyInput(fxRate, { decimalPlaces: 6 }) : undefined

    if (parsedAmount === null || parsedAmount <= 0) {
      setFormError(t('errors.amount_positive'))
      return
    }
    if (isUSD && (parsedFxRate === null || parsedFxRate === undefined || parsedFxRate <= 0)) {
      setFormError(t('errors.exchange_rate_invalid'))
      return
    }

    startTransition(async () => {
      let result

      if (isInstallments) {
        result = await registerInstallments({
          account_id: accountId,
          currency_code: 'ARS',
          amount: parsedAmount,
          date,
          category_id: categoryId,
          subcategory_id: subcategoryId || undefined,
          description: description || undefined,
          installments_total: parsedInstallments,
        })
      } else {
        result = await registerCardPurchase({
          account_id: accountId,
          currency_code: currency,
          amount: parsedAmount,
          date,
          category_id: categoryId,
          subcategory_id: subcategoryId || undefined,
          description: description || undefined,
          fx_rate_to_ars: parsedFxRate ?? undefined,
        })
      }

      if (!result.ok) {
        setFormError(result.formError ?? tCards('errors.register_purchase_failed'))
        return
      }

      // Las cuotas no admiten recurrencia (design D4).
      if (isRecurrent && !isInstallments && 'id' in result && result.id) {
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

      router.push(`/cards/${accountId}`)
    })
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      {/* Currency */}
      {activeCurrencies.length > 1 && (
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">{t('labels.currency')}</label>
          <div className="flex gap-2">
            {activeCurrencies.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => { setCurrency(c); setInstallments('1'); setFxRate('') }}
                className={`px-3 py-1.5 text-sm rounded border transition-colors ${
                  currency === c
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

      {/* Amount */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="amount" className="text-sm font-medium">{t('labels.amount')}</label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
            {currency === 'ARS' ? '$' : 'U$D'}
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
      </div>

      {/* Installments (ARS only) */}
      {currency === 'ARS' && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="installments" className="text-sm font-medium">{t('labels.installments')}</label>
          <div className="flex gap-2 flex-wrap">
            {[1, 2, 3, 6, 9, 12, 18, 24].map((n) => (
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
          <p className="text-xs text-muted-foreground">
            {t('installments_options.ars_only')}
          </p>
        </div>
      )}

      {/* FX rate (USD) */}
      {isUSD && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="fx_rate" className="text-sm font-medium">
            {t('labels.fx_rate_label')}
          </label>
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

      {/* Category */}
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
          {expenseCategories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

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

      {/* Recurrente (solo para consumos simples, no cuotas — design D4) */}
      {!isInstallments && (
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
              {isUSD && (
                <p className="text-xs text-muted-foreground">
                  {t('installments_options.usd_rate_warning')}
                </p>
              )}
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
            : t('actions.register_purchase')}
      </button>
    </form>
  )
}
