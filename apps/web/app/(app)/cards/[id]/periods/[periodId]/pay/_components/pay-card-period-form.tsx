'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { getTodayAR } from '@/lib/date'
import { payCardPeriod } from '@/app/_actions/credit-cards'
import {
  computeStatementPaymentTotal,
  suggestStampTaxAmount,
  COMMON_STAMP_TAX_RATES,
} from '@/lib/cards/utils'
import { Money, parseMoneyInput } from '@grana/validation'
import { MoneyAmountInput } from '@/components/ui/money-amount-input'
import { DatePicker } from '@/components/ui/date-picker'
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
  /** Persisted dates of the running cycle (P(n+1)) — the ones the statement
   * being paid announces. Pre-filled for confirmation, not projection. */
  runningEndDate: string
  runningDueDate: string
  runningIsEstimated: boolean
  /** Close of the period being paid — the running cycle must close after it. */
  paidPeriodEndDate: string
  /** Alícuota de sellos recordada de la tarjeta; null = primera vez (se pregunta). */
  stampTaxRate: number | null
  paymentAccounts: PaymentAccount[]
}

export const PayCardPeriodForm = ({
  periodId,
  cardId,
  pendingAmountARS,
  pendingAmountUSD,
  runningEndDate,
  runningDueDate,
  runningIsEstimated,
  paidPeriodEndDate,
  stampTaxRate,
  paymentAccounts,
}: Props) => {
  const router = useRouter()
  const t = useTranslations('cards')
  const tCommon = useTranslations('common')
  const [isPending, startTransition] = useTransition()
  const [formError, setFormError] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const hasUsdDebt = pendingAmountUSD > 0

  // Base del impuesto de sellos = total ARS del resumen (consumos pendientes en
  // pesos). El usuario nunca ve la alícuota: si la tarjeta ya la tiene, se
  // sugiere el monto; si no, se le pide elegir un monto (primera vez).
  const stampBase = pendingAmountARS
  const stampKnown = stampTaxRate != null
  const initialStamp = stampTaxRate != null ? suggestStampTaxAmount(stampBase, stampTaxRate) : 0

  const sumARS = (a: number, b: number) =>
    Money.toNumber(Money.add(Money.from(a), Money.from(b)))

  // Total a pagar = consumos (ARS + USD×fx) + sello. El consumo USD requiere la
  // cotización; hasta tenerla se usa la base ARS y el sello se suma igual.
  const consumosBase = (fx: number | null): number | null =>
    hasUsdDebt
      ? computeStatementPaymentTotal(pendingAmountARS, pendingAmountUSD, fx)
      : pendingAmountARS

  const [stampTax, setStampTax] = useState(initialStamp > 0 ? String(initialStamp) : '')
  const [amount, setAmount] = useState(String(sumARS(pendingAmountARS, initialStamp)))
  const [fxRate, setFxRate] = useState('')
  const [paymentAccountId, setPaymentAccountId] = useState(paymentAccounts[0]?.id ?? '')
  const [paymentDate, setPaymentDate] = useState(todayStr())
  const [nextEndDate, setNextEndDate] = useState(runningEndDate)
  const [nextDueDate, setNextDueDate] = useState(runningDueDate)

  // Payment-day conversion: total ARS = pendiente ARS + pendiente USD × fx
  // (exact Money arithmetic in computeStatementPaymentTotal). Typing the fx or
  // the sello auto-fills the amount with the computed total (still editable).
  const parsedFx = fxRate ? parseMoneyInput(fxRate, { decimalPlaces: 6 }) : null
  const parsedStamp = parseMoneyInput(stampTax) ?? 0
  const computedTotal = hasUsdDebt
    ? computeStatementPaymentTotal(pendingAmountARS, pendingAmountUSD, parsedFx)
    : null
  const usdConvertedARS =
    computedTotal !== null && hasUsdDebt
      ? Math.round((computedTotal - pendingAmountARS) * 100) / 100
      : null

  // Sugerencia de total (consumos + sello) que se muestra como ayuda.
  const suggestedConsumos = consumosBase(parsedFx)
  const suggestedTotal =
    suggestedConsumos !== null ? sumARS(suggestedConsumos, parsedStamp) : null

  const recomputeAmount = (fx: number | null, stamp: number) => {
    const base = consumosBase(fx)
    if (base !== null) setAmount(String(sumARS(base, stamp)))
  }

  const handleFxChange = (value: string) => {
    setFxRate(value)
    const fx = value ? parseMoneyInput(value, { decimalPlaces: 6 }) : null
    recomputeAmount(fx, parsedStamp)
  }

  const handleStampChange = (value: string) => {
    setStampTax(value)
    recomputeAmount(parsedFx, parseMoneyInput(value) ?? 0)
  }

  // Sugerencias de monto para la primera vez (sin mostrar el %): cada alícuota
  // común aplicada a la base, deduplicadas, solo si hay base positiva.
  const stampSuggestions = stampKnown
    ? []
    : Array.from(
        new Set(
          COMMON_STAMP_TAX_RATES.map((rate) => suggestStampTaxAmount(stampBase, rate)).filter(
            (amt) => amt > 0,
          ),
        ),
      ).sort((a, b) => b - a)

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
    // The running cycle starts right after the paid statement closes, so its
    // confirmed close must fall after that anchor.
    if (nextEndDate && nextEndDate <= paidPeriodEndDate) {
      errs.nextEndDate = t('errors.next_end_before_known', {
        date: formatShortDate(paidPeriodEndDate),
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
        stamp_tax_amount: parseMoneyInput(stampTax) ?? 0,
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

        {/* Impuesto de sellos del resumen. Primera vez: selector de montos sin
            mencionar el %. Próximas: monto sugerido y editable. */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">{t('payment.stamp_tax_label')}</label>
          <p className="text-xs text-muted-foreground mb-1">
            {stampKnown
              ? t('payment.stamp_tax_known_helper')
              : t('payment.stamp_tax_first_time_hint')}
          </p>

          {!stampKnown && stampSuggestions.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-1">
              {stampSuggestions.map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => handleStampChange(String(amt))}
                  className={`rounded-full border px-3 py-1 text-sm transition-colors ${
                    parsedStamp === amt
                      ? 'border-primary bg-primary/10 text-foreground'
                      : 'border-input bg-background text-muted-foreground hover:bg-muted'
                  }`}
                >
                  {formatARS(amt)}
                </button>
              ))}
              <button
                type="button"
                onClick={() => handleStampChange('0')}
                className={`rounded-full border px-3 py-1 text-sm transition-colors ${
                  parsedStamp === 0 && stampTax !== ''
                    ? 'border-primary bg-primary/10 text-foreground'
                    : 'border-input bg-background text-muted-foreground hover:bg-muted'
                }`}
              >
                {t('payment.stamp_tax_none')}
              </button>
            </div>
          )}

          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
            <MoneyAmountInput
              value={stampTax}
              onChange={handleStampChange}
              placeholder={!stampKnown ? t('payment.stamp_tax_other_placeholder') : undefined}
              className="w-full rounded-md border border-input bg-background pl-9 pr-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">{t('labels.amount_to_pay')}</label>
          <p className="text-xs text-muted-foreground mb-1">
            {t('labels.amount_to_pay_helper')} (
            {suggestedTotal !== null ? formatARS(suggestedTotal) : formatARS(pendingAmountARS)})
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
          <DatePicker value={paymentDate} onChange={setPaymentDate} label={t('labels.payment_date')} />
          {errors.paymentDate && <p className="text-xs text-destructive">{errors.paymentDate}</p>}
        </div>
      </div>

      {/* Section 2: confirm the running cycle's dates — the statement being
          paid announces them, so this is the moment the user has them in hand. */}
      <div className="flex flex-col gap-4">
        <div>
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            {t('payment.section_next_period')}
            {runningIsEstimated && (
              <span className="ml-2 normal-case tracking-normal rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                {t('payment.estimated_badge')}
              </span>
            )}
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            {t('labels.next_period_helper')}
          </p>
          <p className="mt-1 rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
            {t('payment.next_period_context', { date: formatShortDate(paidPeriodEndDate) })}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium">{t('labels.close_date')}</label>
            <DatePicker value={nextEndDate} onChange={setNextEndDate} label={t('labels.close_date')} />
            {errors.nextEndDate && <p className="text-xs text-destructive">{errors.nextEndDate}</p>}
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium">{t('labels.due_date')}</label>
            <DatePicker value={nextDueDate} onChange={setNextDueDate} label={t('labels.due_date')} />
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
