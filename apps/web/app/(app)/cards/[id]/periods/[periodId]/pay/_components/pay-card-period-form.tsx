'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Lock } from 'lucide-react'
import { getTodayAR } from '@/lib/date'
import { payCardPeriod } from '@/app/_actions/credit-cards'
import {
  computeStatementPaymentTotal,
  suggestStampTaxAmount,
  COMMON_STAMP_TAX_RATES,
} from '@/lib/cards/utils'
import { Money, parseMoneyInput } from '@grana/validation'
import { formatARS } from '@grana/i18n-messages'
import { useShowCents } from '@/lib/preferences-context'
import { MoneyAmountInput } from '@/components/ui/money-amount-input'
import { DatePicker } from '@/components/ui/date-picker'
import { Card } from '@/components/ui/card'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { SectionLabel } from '@/components/ui/form-primitives'
import { checkNegativeBalance } from '@/lib/transactions/negative-balance-warning'
import { NegativeBalanceNotice } from '@/lib/transactions/components/negative-balance-notice'
import { DebitAccountSelect } from './debit-account-select'

const todayStr = () => {
  const d = getTodayAR()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const formatShortDate = (iso: string) => iso.split('-').reverse().join('/')

// Shared field-control look: input box matching the system's 10px radius / border.
const INPUT_CLS =
  'w-full rounded-[10px] border border-border bg-card px-3 py-2.5 text-sm text-text outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring placeholder:text-text-soft'

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

const FieldLabel = ({ children }: { children: React.ReactNode }) => (
  <label className="text-sm font-semibold text-text">{children}</label>
)

const Hint = ({ children }: { children: React.ReactNode }) => (
  <p className="text-xs text-text-muted">{children}</p>
)

const FieldError = ({ children }: { children: React.ReactNode }) => (
  <p className="text-xs text-error">{children}</p>
)

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
  const showCents = useShowCents()
  const fmtARS = (n: number) => formatARS(n, showCents)
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

  // Composición del monto: de la cuenta sale el total del resumen (consumos en
  // ARS + USD×fx) más el impuesto de sellos. Se muestra cuando hay algo que
  // explicar (deuda USD o sello cargado) para que cada cifra responda "¿de
  // dónde sale?". El "Total a pagar" coincide con el monto pre-llenado.
  const showBreakdown = hasUsdDebt || parsedStamp > 0

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
    <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
      {/* Section 1: Payment data */}
      <Card>
        <div className="flex flex-col gap-5 p-5">
          <SectionLabel className="mb-0">{t('payment.section_payment_data')}</SectionLabel>

          {/* Caso USD: cotización primero, luego la conversión visible, para que
              el monto a pagar se entienda antes de fijarlo. */}
          {hasUsdDebt && (
            <div className="flex flex-col gap-1.5">
              <FieldLabel>{t('payment.fx_label')}</FieldLabel>
              <Hint>{t('payment.fx_helper')}</Hint>
              <MoneyAmountInput
                id="pay-fx"
                required
                groupThousands={false}
                value={fxRate}
                onChange={handleFxChange}
                placeholder={t('payment.fx_placeholder')}
                className={INPUT_CLS}
              />
              {errors.fxRate && <FieldError>{errors.fxRate}</FieldError>}
              {usdConvertedARS !== null && (
                <p className="text-xs text-text-muted tabular-nums">
                  {t('payment.breakdown_usd', { usd: pendingAmountUSD })}
                  {parsedFx !== null && parsedFx > 0 ? ` × ${fxRate}` : ''} ={' '}
                  <span className="font-semibold text-text">{fmtARS(usdConvertedARS)}</span>
                </p>
              )}
            </div>
          )}

          {/* Impuesto de sellos del resumen. Primera vez: chips de montos sin
              mencionar el %. Próximas: monto sugerido y editable. */}
          <div className="flex flex-col gap-1.5">
            <FieldLabel>{t('payment.stamp_tax_label')}</FieldLabel>
            <Hint>
              {stampKnown
                ? t('payment.stamp_tax_known_helper')
                : t('payment.stamp_tax_first_time_hint')}
            </Hint>

            {!stampKnown && stampSuggestions.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {stampSuggestions.map((amt) => {
                  const active = parsedStamp === amt
                  return (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => handleStampChange(String(amt))}
                      aria-pressed={active}
                      className={`rounded-full border px-3 py-1 text-sm font-semibold tabular-nums transition-colors ${
                        active
                          ? 'border-emerald bg-emerald-soft text-emerald-deep'
                          : 'border-border bg-card text-text-muted hover:bg-page'
                      }`}
                    >
                      {fmtARS(amt)}
                    </button>
                  )
                })}
                <button
                  type="button"
                  onClick={() => handleStampChange('0')}
                  aria-pressed={parsedStamp === 0 && stampTax !== ''}
                  className={`rounded-full border px-3 py-1 text-sm font-medium transition-colors ${
                    parsedStamp === 0 && stampTax !== ''
                      ? 'border-emerald bg-emerald-soft text-emerald-deep'
                      : 'border-border bg-card text-text-soft hover:bg-page'
                  }`}
                >
                  {t('payment.stamp_tax_none')}
                </button>
              </div>
            )}

            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-text-soft">
                $
              </span>
              <MoneyAmountInput
                value={stampTax}
                onChange={handleStampChange}
                placeholder={!stampKnown ? t('payment.stamp_tax_other_placeholder') : undefined}
                className={`${INPUT_CLS} pl-8`}
              />
            </div>
          </div>

          {/* Monto a pagar (incluye consumos + sello). Editable para pago parcial. */}
          <div className="flex flex-col gap-1.5">
            <FieldLabel>{t('labels.amount_to_pay')}</FieldLabel>
            <Hint>{t('labels.amount_to_pay_helper')}</Hint>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-text-soft">
                $
              </span>
              <MoneyAmountInput
                required
                value={amount}
                onChange={setAmount}
                className={`${INPUT_CLS} pl-8 text-base font-semibold`}
              />
            </div>
            {errors.amount && <FieldError>{errors.amount}</FieldError>}

            {/* "¿De dónde sale?": composición del total que deja la cuenta. */}
            {showBreakdown && (
              <div className="mt-1 rounded-[10px] bg-page px-3 py-2.5 text-xs tabular-nums">
                <div className="flex justify-between text-text-muted">
                  <span>{t('payment.breakdown_ars')}</span>
                  <span>{fmtARS(pendingAmountARS)}</span>
                </div>
                {hasUsdDebt && (
                  <div className="mt-1 flex justify-between text-text-muted">
                    <span>
                      {t('payment.breakdown_usd', { usd: pendingAmountUSD })}
                      {parsedFx !== null && parsedFx > 0 ? ` × ${fxRate}` : ''}
                    </span>
                    <span>{usdConvertedARS !== null ? fmtARS(usdConvertedARS) : '—'}</span>
                  </div>
                )}
                {parsedStamp > 0 && (
                  <div className="mt-1 flex justify-between text-text-muted">
                    <span>{t('payment.stamp_tax_label')}</span>
                    <span>{fmtARS(parsedStamp)}</span>
                  </div>
                )}
                <div className="mt-1.5 flex justify-between border-t border-border pt-1.5 font-semibold text-text">
                  <span>{t('payment.breakdown_total')}</span>
                  <span>{suggestedTotal !== null ? fmtARS(suggestedTotal) : '—'}</span>
                </div>
              </div>
            )}
          </div>

          {/* Cuenta de débito */}
          <div className="flex flex-col gap-1.5">
            <FieldLabel>{t('labels.debit_account')}</FieldLabel>
            <DebitAccountSelect
              accounts={paymentAccounts}
              value={paymentAccountId}
              onChange={setPaymentAccountId}
              label={t('labels.debit_account')}
              placeholder={t('errors.account_required')}
              invalid={Boolean(errors.paymentAccountId)}
            />
            {errors.paymentAccountId && <FieldError>{errors.paymentAccountId}</FieldError>}
            {negativeWarning?.negative && (
              <NegativeBalanceNotice projected={negativeWarning.projected} currency="ARS" />
            )}
          </div>

          {/* Fecha del pago */}
          <div className="flex flex-col gap-1.5">
            <FieldLabel>{t('labels.payment_date')}</FieldLabel>
            <DatePicker value={paymentDate} onChange={setPaymentDate} label={t('labels.payment_date')} />
            {errors.paymentDate && <FieldError>{errors.paymentDate}</FieldError>}
          </div>
        </div>
      </Card>

      {/* Section 2: confirm the running cycle's dates — the statement being
          paid announces them, so this is the moment the user has them in hand. */}
      <Card>
        <div className="flex flex-col gap-4 p-5">
          <div className="flex flex-wrap items-center gap-2">
            <SectionLabel className="mb-0">{t('payment.section_next_period')}</SectionLabel>
            {runningIsEstimated && (
              <span className="rounded-full bg-slate-soft px-2 py-0.5 text-[11px] font-semibold text-slate">
                {t('payment.estimated_badge')}
              </span>
            )}
          </div>
          <Hint>{t('labels.next_period_helper')}</Hint>
          <p className="rounded-[10px] bg-page px-3 py-2.5 text-xs text-text-muted">
            {t('payment.next_period_context', { date: formatShortDate(paidPeriodEndDate) })}
          </p>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <FieldLabel>{t('labels.close_date')}</FieldLabel>
              <DatePicker
                value={nextEndDate}
                onChange={setNextEndDate}
                min={paidPeriodEndDate}
                label={t('labels.close_date')}
              />
              {errors.nextEndDate && <FieldError>{errors.nextEndDate}</FieldError>}
            </div>
            <div className="flex flex-col gap-1.5">
              <FieldLabel>{t('labels.due_date')}</FieldLabel>
              <DatePicker
                value={nextDueDate}
                onChange={setNextDueDate}
                min={nextEndDate || paidPeriodEndDate}
                label={t('labels.due_date')}
              />
              {errors.nextDueDate && <FieldError>{errors.nextDueDate}</FieldError>}
            </div>
          </div>
        </div>
      </Card>

      {/* Cierre: irreversibilidad (informativo) + CTA */}
      <Alert variant="info" icon={<Lock className="h-4 w-4" aria-hidden />}>
        <p className="text-xs">{t('payment.warning')}</p>
      </Alert>

      {formError && <FieldError>{formError}</FieldError>}

      <Button type="submit" loading={isPending} size="lg">
        {isPending ? tCommon('processing') : t('actions.confirm_payment')}
      </Button>
    </form>
  )
}
