'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { getTodayAR } from '@/lib/date'
import { payCardPeriod } from '@/app/_actions/credit-cards'
import { computeStatementPaymentTotal } from '@/lib/cards/utils'
import { parseMoneyInput } from '@grana/validation'
import { MoneyAmountInput } from '@/components/ui/money-amount-input'
import { checkNegativeBalance } from '@/lib/transactions/negative-balance-warning'
import { NegativeBalanceNotice } from '@/lib/transactions/components/negative-balance-notice'

const todayStr = () => {
  const d = getTodayAR()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const formatARS = (amount: number) =>
  new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount)

const formatShortDate = (iso: string) => iso.split('-').reverse().join('/')

type PaymentAccount = {
  id: string
  name: string
  balanceARS: number
}

type Props = {
  periodId: string
  cardId: string
  pendingAmountARS: number
  /** Pending USD debt of the period; > 0 requires the payment-day fx rate. */
  pendingAmountUSD: number
  suggestedNextEndDate: string
  suggestedNextDueDate: string
  /** Furthest known statement close — the next period must close after it. */
  lastKnownEndDate: string
  paymentAccounts: PaymentAccount[]
}

export const PayCardPeriodForm = ({
  periodId,
  cardId,
  pendingAmountARS,
  pendingAmountUSD,
  suggestedNextEndDate,
  suggestedNextDueDate,
  lastKnownEndDate,
  paymentAccounts,
}: Props) => {
  const router = useRouter()
  const t = useTranslations('cards')
  const tCommon = useTranslations('common')
  const [isPending, startTransition] = useTransition()
  const [formError, setFormError] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const hasUsdDebt = pendingAmountUSD > 0

  const [amount, setAmount] = useState(String(pendingAmountARS))
  const [fxRate, setFxRate] = useState('')
  const [paymentAccountId, setPaymentAccountId] = useState(paymentAccounts[0]?.id ?? '')
  const [paymentDate, setPaymentDate] = useState(todayStr())
  const [nextEndDate, setNextEndDate] = useState(suggestedNextEndDate)
  const [nextDueDate, setNextDueDate] = useState(suggestedNextDueDate)

  // Payment-day conversion: total ARS = pendiente ARS + pendiente USD × fx
  // (exact Money arithmetic in computeStatementPaymentTotal). Typing the fx
  // auto-fills the amount with the computed total (still editable).
  const parsedFx = fxRate ? parseMoneyInput(fxRate, { decimalPlaces: 6 }) : null
  const computedTotal = hasUsdDebt
    ? computeStatementPaymentTotal(pendingAmountARS, pendingAmountUSD, parsedFx)
    : null
  const usdConvertedARS =
    computedTotal !== null && hasUsdDebt
      ? Math.round((computedTotal - pendingAmountARS) * 100) / 100
      : null

  const handleFxChange = (value: string) => {
    setFxRate(value)
    const fx = value ? parseMoneyInput(value, { decimalPlaces: 6 }) : null
    const total = computeStatementPaymentTotal(pendingAmountARS, pendingAmountUSD, fx)
    if (hasUsdDebt && total !== null) setAmount(String(total))
  }

  // Soft, non-blocking warning: paying from this account would leave its ARS
  // available balance negative. Statement payments are always in ARS.
  const selectedAccount = paymentAccounts.find((a) => a.id === paymentAccountId)
  const parsedPaymentAmount = parseMoneyInput(amount)
  const negativeWarning =
    selectedAccount && parsedPaymentAmount !== null && parsedPaymentAmount > 0
      ? checkNegativeBalance(selectedAccount.balanceARS, parsedPaymentAmount)
      : null

  const validate = () => {
    const errs: Record<string, string> = {}
    const parsedAmount = parseMoneyInput(amount)
    if (parsedAmount === null || parsedAmount <= 0) errs.amount = t('errors.limit_invalid')
    if (hasUsdDebt && (parsedFx === null || parsedFx <= 0)) {
      errs.fxRate = t('errors.fx_required')
    }
    if (!paymentAccountId) errs.paymentAccountId = t('errors.account_required')
    if (!paymentDate) errs.paymentDate = tCommon('required_short')
    if (!nextEndDate) errs.nextEndDate = tCommon('required_short')
    if (!nextDueDate) errs.nextDueDate = tCommon('required_short')
    // The next close must fall AFTER every known statement — otherwise the new
    // period would overlap the one still running.
    if (nextEndDate && nextEndDate <= lastKnownEndDate) {
      errs.nextEndDate = t('errors.next_end_before_known', {
        date: formatShortDate(lastKnownEndDate),
      })
    }
    if (nextEndDate && nextDueDate && nextDueDate <= nextEndDate) {
      errs.nextDueDate = t('errors.due_after_close')
    }
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return

    setFormError(null)
    startTransition(async () => {
      const result = await payCardPeriod({
        period_id: periodId,
        amount: parseMoneyInput(amount) ?? 0,
        payment_account_id: paymentAccountId,
        payment_date: paymentDate,
        next_end_date: nextEndDate,
        next_due_date: nextDueDate,
        ...(hasUsdDebt && parsedFx !== null && parsedFx > 0
          ? { fx_rate_to_ars: parsedFx }
          : {}),
      })

      if (!result.ok) {
        setFormError(result.formError ?? t('errors.payment_failed'))
        return
      }

      router.push(`/cards/${cardId}`)
    })
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6" noValidate>
      {/* Section 1: Payment data */}
      <div className="flex flex-col gap-4">
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
          {t('payment.section_payment_data')}
        </h2>

        {hasUsdDebt && (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="pay-fx" className="text-sm font-medium">
              {t('payment.fx_label')}
            </label>
            <p className="text-xs text-muted-foreground mb-1">{t('payment.fx_helper')}</p>
            <MoneyAmountInput
              id="pay-fx"
              required
              groupThousands={false}
              value={fxRate}
              onChange={handleFxChange}
              placeholder={t('payment.fx_placeholder')}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            {errors.fxRate && <p className="text-xs text-destructive">{errors.fxRate}</p>}

            {/* Breakdown: ARS pendiente + USD × fx = total */}
            <div className="mt-1 rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground tabular-nums">
              <div className="flex justify-between">
                <span>{t('payment.breakdown_ars')}</span>
                <span>{formatARS(pendingAmountARS)}</span>
              </div>
              <div className="flex justify-between">
                <span>
                  {t('payment.breakdown_usd', { usd: pendingAmountUSD })}
                  {parsedFx !== null && parsedFx > 0 ? ` × ${fxRate}` : ''}
                </span>
                <span>{usdConvertedARS !== null ? formatARS(usdConvertedARS) : '—'}</span>
              </div>
              <div className="mt-1 flex justify-between border-t border-border pt-1 font-semibold text-foreground">
                <span>{t('payment.breakdown_total')}</span>
                <span>{computedTotal !== null ? formatARS(computedTotal) : '—'}</span>
              </div>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">{t('labels.amount_to_pay')}</label>
          <p className="text-xs text-muted-foreground mb-1">
            {t('labels.amount_to_pay_helper')} (
            {computedTotal !== null ? formatARS(computedTotal) : formatARS(pendingAmountARS)})
          </p>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
            <MoneyAmountInput
              required
              value={amount}
              onChange={setAmount}
              className="w-full rounded-md border border-input bg-background pl-9 pr-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          {errors.amount && <p className="text-xs text-destructive">{errors.amount}</p>}
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">{t('labels.debit_account')}</label>
          <select
            required
            value={paymentAccountId}
            onChange={(e) => setPaymentAccountId(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {paymentAccounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} — {formatARS(a.balanceARS)}
              </option>
            ))}
          </select>
          {errors.paymentAccountId && <p className="text-xs text-destructive">{errors.paymentAccountId}</p>}
          {negativeWarning?.negative && (
            <NegativeBalanceNotice projected={negativeWarning.projected} currency="ARS" />
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">{t('labels.payment_date')}</label>
          <input
            type="date"
            required
            value={paymentDate}
            onChange={(e) => setPaymentDate(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          {errors.paymentDate && <p className="text-xs text-destructive">{errors.paymentDate}</p>}
        </div>
      </div>

      {/* Section 2: Next period dates */}
      <div className="flex flex-col gap-4">
        <div>
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            {t('payment.section_next_period')}
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            {t('labels.next_period_helper')}
          </p>
          {/* Anchor: where the running statement ends, so the user knows the
              next close must come after it. */}
          <p className="mt-1 rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
            {t('payment.next_period_context', { date: formatShortDate(lastKnownEndDate) })}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium">{t('labels.close_date')}</label>
            <input
              type="date"
              required
              value={nextEndDate}
              onChange={(e) => setNextEndDate(e.target.value)}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            {errors.nextEndDate && <p className="text-xs text-destructive">{errors.nextEndDate}</p>}
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium">{t('labels.due_date')}</label>
            <input
              type="date"
              required
              value={nextDueDate}
              onChange={(e) => setNextDueDate(e.target.value)}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            {errors.nextDueDate && <p className="text-xs text-destructive">{errors.nextDueDate}</p>}
          </div>
        </div>
      </div>

      {formError && <p className="text-sm text-destructive">{formError}</p>}

      <p className="text-xs text-muted-foreground rounded-md bg-muted px-3 py-2">
        {t('payment.warning')}
      </p>

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-md bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
      >
        {isPending ? tCommon('processing') : t('actions.confirm_payment')}
      </button>
    </form>
  )
}
