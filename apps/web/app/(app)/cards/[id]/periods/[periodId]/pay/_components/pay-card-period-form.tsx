'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Check, Info, Lock, Sparkles } from 'lucide-react'
import { getTodayAR } from '@/lib/date'
import { payCardPeriod } from '@/app/_actions/credit-cards'
import {
  computeStatementPaymentTotal,
  suggestStampTaxAmount,
  COMMON_STAMP_TAX_RATES,
} from '@/lib/cards/utils'
import { Money, parseMoneyInput } from '@grana/validation'
import { formatARS, formatUSD } from '@grana/i18n-messages'
import { useShowCents } from '@/lib/preferences-context'
import { MoneyAmountInput } from '@/components/ui/money-amount-input'
import { DatePicker } from '@/components/ui/date-picker'
import { Card } from '@/components/ui/card'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { SectionLabel } from '@/components/ui/form-primitives'
import { checkNegativeBalance } from '@/lib/transactions/negative-balance-warning'
import { NegativeBalanceNotice } from '@/lib/transactions/components/negative-balance-notice'
import { DebitAccountSelect, type DebitAccount } from './debit-account-select'

const todayStr = () => {
  const d = getTodayAR()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const formatShortDate = (iso: string) => iso.split('-').reverse().join('/')

// Prominent money display matching the handoff `.money` primitive: a bordered
// box (1.5px, 13px radius) with a faint `$` and a large, bold, tabular value,
// glowing emerald on focus. `lg` is the hero amount; `sm` the fx / stamp fields.
const MoneyField = ({
  size = 'lg',
  invalid = false,
  children,
}: {
  size?: 'lg' | 'sm'
  invalid?: boolean
  children: React.ReactNode
}) => (
  <div
    className={`flex items-center gap-2.5 rounded-[13px] border-[1.5px] bg-card px-4 transition-colors focus-within:ring-[3px] ${
      size === 'lg' ? 'py-3' : 'py-2.5'
    } ${
      invalid
        ? 'border-error focus-within:border-error focus-within:ring-error/10'
        : 'border-border focus-within:border-emerald focus-within:ring-emerald/15'
    }`}
  >
    <span className={`shrink-0 font-bold text-text-soft ${size === 'lg' ? 'text-lg' : 'text-base'}`}>
      $
    </span>
    {children}
  </div>
)

const moneyInputCls = (size: 'lg' | 'sm') =>
  `w-full border-none bg-transparent p-0 font-extrabold tracking-tight tabular-nums text-text outline-none placeholder:font-normal placeholder:text-text-soft ${
    size === 'lg' ? 'text-[26px] leading-none' : 'text-xl leading-none'
  }`

type PaymentAccount = DebitAccount

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
  /** Preselected debit account — the card's own bank when available. */
  defaultPaymentAccountId: string
  /** Cuentas con USD activo: la deuda en dólares se puede cancelar CON dólares. */
  usdAccounts: PaymentAccount[]
  defaultUsdAccountId: string
}

const FieldLabel = ({ children }: { children: React.ReactNode }) => (
  <label className="text-[13.5px] font-extrabold tracking-tight text-text">{children}</label>
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
  defaultPaymentAccountId,
  usdAccounts,
  defaultUsdAccountId,
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

  const [stampTax, setStampTax] = useState(initialStamp > 0 ? String(initialStamp) : '')
  const [fxRate, setFxRate] = useState('')
  // La deuda en dólares se cancela CON dólares por defecto cuando hay una cuenta en
  // dólares: es lo que hace el banco y lo que el usuario pidió. Pesificarla sigue
  // disponible, pero deja de ser la única opción.
  const [payUsdInUsd, setPayUsdInUsd] = useState(hasUsdDebt && usdAccounts.length > 0)
  // Vacío a propósito cuando hay varias candidatas y ninguna es del banco de la
  // tarjeta: la validación lo pide, en vez de mover dólares desde una cuenta que el
  // usuario no eligió.
  const [usdAccountId, setUsdAccountId] = useState(defaultUsdAccountId)
  const [paymentAccountId, setPaymentAccountId] = useState(
    defaultPaymentAccountId || paymentAccounts[0]?.id || '',
  )
  const [paymentDate, setPaymentDate] = useState(todayStr())
  const [nextEndDate, setNextEndDate] = useState(runningEndDate)
  const [nextDueDate, setNextDueDate] = useState(runningDueDate)

  // Payment-day conversion: total ARS = pendiente ARS + pendiente USD × fx
  // (exact Money arithmetic in computeStatementPaymentTotal). Typing the fx or
  // the sello auto-fills the amount with the computed total (still editable).
  const parsedFx = fxRate ? parseMoneyInput(fxRate, { decimalPlaces: 6 }) : null
  const parsedStamp = parseMoneyInput(stampTax) ?? 0
  /** ¿La porción en dólares se pesifica? Solo entonces hace falta la cotización. */
  const pesifyUsd = hasUsdDebt && !payUsdInUsd
  const computedTotal = pesifyUsd
    ? computeStatementPaymentTotal(pendingAmountARS, pendingAmountUSD, parsedFx)
    : null
  const usdConvertedARS =
    computedTotal !== null ? Math.round((computedTotal - pendingAmountARS) * 100) / 100 : null

  // La deuda en pesos del resumen INCLUYE el sello: es un cargo del resumen y sube lo
  // que hay que cancelar.
  const arsToSettle = sumARS(pendingAmountARS, parsedStamp)
  // Los montos de los débitos son DERIVADOS de lo que se cancela, no estado editable.
  const arsDebit = pesifyUsd
    ? usdConvertedARS !== null
      ? sumARS(arsToSettle, usdConvertedARS)
      : null
    : arsToSettle
  const suggestedTotal = arsDebit

  const handleStampChange = (value: string) => setStampTax(value)

  // Chips de monto (sin mostrar el %): cada alícuota común aplicada a la base +
  // el monto aprendido/sugerido, deduplicados. Se muestran también en modo
  // "ya aprendido" (con el sugerido pre-seleccionado), como en el mockup.
  const stampSuggestions = Array.from(
    new Set(
      [
        ...(initialStamp > 0 ? [initialStamp] : []),
        ...COMMON_STAMP_TAX_RATES.map((rate) => suggestStampTaxAmount(stampBase, rate)),
      ].filter((amt) => amt > 0),
    ),
  ).sort((a, b) => b - a)

  // Soft, non-blocking warning: paying from this account would leave its ARS
  // available balance negative. Statement payments are always in ARS.
  const selectedAccount = paymentAccounts.find((a) => a.id === paymentAccountId)
  const negativeWarning =
    selectedAccount && arsDebit !== null && arsDebit > 0
      ? checkNegativeBalance(selectedAccount.balance, arsDebit)
      : null
  // El mismo aviso, para la cuenta en dólares. Los saldos NUNCA se comparan entre
  // monedas: cada débito se chequea contra el suyo.
  const selectedUsdAccount = usdAccounts.find((a) => a.id === usdAccountId)
  /**
   * Los débitos reales de la operación, uno por moneda y sin sumarse nunca. Pagando los
   * dólares con dólares son dos —o uno solo en dólares, si el resumen no debe pesos ni
   * hubo sello—. Pesificando hay un único débito en pesos, que muestra el campo de abajo.
   */
  const debitRows =
    payUsdInUsd && pendingAmountUSD > 0
      ? [
          ...(arsToSettle > 0
            ? [
                {
                  key: 'ars',
                  account: selectedAccount?.name ?? null,
                  value: arsDebit !== null ? fmtARS(arsDebit) : '—',
                },
              ]
            : []),
          {
            key: 'usd',
            account: selectedUsdAccount?.name ?? null,
            value: formatUSD(pendingAmountUSD, showCents),
          },
        ]
      : null
  const usdNegativeWarning =
    payUsdInUsd && selectedUsdAccount && pendingAmountUSD > 0
      ? checkNegativeBalance(selectedUsdAccount.balance, pendingAmountUSD)
      : null

  const validate = () => {
    const errs: Record<string, string> = {}
    // La cotización se exige SOLO al pesificar: pagar dólares con dólares no convierte
    // nada, y pedirla sería inventar un dato.
    if (pesifyUsd && (parsedFx === null || parsedFx <= 0)) {
      errs.fxRate = t('errors.fx_required')
    }
    if (payUsdInUsd && !usdAccountId) errs.usdAccountId = t('errors.account_required')
    if (arsToSettle > 0 && !paymentAccountId) errs.paymentAccountId = t('errors.account_required')
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
      // Un pago = UN débito real de una cuenta, con lo que ese débito cancela. Los
      // montos NO viajan: los deriva la base de las imputaciones declaradas.
      //
      //   · dólares con dólares  → DOS débitos: uno en pesos y uno en dólares.
      //   · dólares pesificados  → UN débito en pesos con dos imputaciones, que es
      //                            exactamente lo que hace la app hoy.
      const payments = [
        ...(arsToSettle > 0
          ? [
              {
                payment_account_id: paymentAccountId,
                payment_date: paymentDate,
                allocations: [
                  { settles_currency: 'ARS' as const, settles_amount: arsToSettle },
                  ...(pesifyUsd && parsedFx !== null && parsedFx > 0
                    ? [
                        {
                          settles_currency: 'USD' as const,
                          settles_amount: pendingAmountUSD,
                          fx_rate_to_ars: parsedFx,
                        },
                      ]
                    : []),
                ],
              },
            ]
          : []),
        ...(payUsdInUsd && pendingAmountUSD > 0
          ? [
              {
                payment_account_id: usdAccountId,
                payment_date: paymentDate,
                allocations: [
                  { settles_currency: 'USD' as const, settles_amount: pendingAmountUSD },
                ],
              },
            ]
          : []),
      ]

      const result = await payCardPeriod({
        period_id: periodId,
        payments,
        next_end_date: nextEndDate,
        next_due_date: nextDueDate,
        stamp_tax_amount: parsedStamp,
      })

      if (!result.ok) {
        setFormError(result.formError ?? t('errors.payment_failed'))
        return
      }

      router.push(`/cards/${cardId}`)
    })
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
      {/* Section 1: Payment data */}
      <Card>
        <div className="flex flex-col gap-4 p-5">
          <SectionLabel className="mb-0">{t('payment.section_payment_data')}</SectionLabel>

          {/* Porción en dólares del resumen: primero CÓMO se paga, y solo si se
              pesifica aparece la cotización. Pagar dólares con dólares no convierte
              nada. */}
          {hasUsdDebt && (
            <div className="flex flex-col gap-2.5">
              <FieldLabel>{t('payment.usd_mode_label')}</FieldLabel>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setPayUsdInUsd(true)}
                  disabled={usdAccounts.length === 0}
                  aria-pressed={payUsdInUsd}
                  className={`rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors disabled:opacity-40 ${
                    payUsdInUsd
                      ? 'border-emerald bg-emerald-soft text-emerald-deep'
                      : 'border-border bg-card text-text-muted hover:bg-page'
                  }`}
                >
                  {t('payment.usd_mode_in_usd')}
                </button>
                <button
                  type="button"
                  onClick={() => setPayUsdInUsd(false)}
                  aria-pressed={!payUsdInUsd}
                  className={`rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors ${
                    !payUsdInUsd
                      ? 'border-emerald bg-emerald-soft text-emerald-deep'
                      : 'border-border bg-card text-text-muted hover:bg-page'
                  }`}
                >
                  {t('payment.usd_mode_in_ars')}
                </button>
              </div>
              {usdAccounts.length === 0 && (
                <Hint>{t('payment.usd_no_account')}</Hint>
              )}
            </div>
          )}

          {pesifyUsd && (
            <div className="flex flex-col gap-1.5">
              <FieldLabel>{t('payment.fx_label')}</FieldLabel>
              <Hint>{t('payment.fx_helper')}</Hint>
              <MoneyField size="sm" invalid={Boolean(errors.fxRate)}>
                <MoneyAmountInput
                  id="pay-fx"
                  required
                  groupThousands={false}
                  value={fxRate}
                  onChange={setFxRate}
                  placeholder={t('payment.fx_placeholder')}
                  className={moneyInputCls('sm')}
                />
              </MoneyField>
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
            {stampKnown ? (
              <Alert variant="info" icon={<Sparkles className="h-4 w-4" aria-hidden />}>
                <p className="text-xs">
                  {t('payment.stamp_tax_learned_alert', { amount: fmtARS(initialStamp) })}
                </p>
              </Alert>
            ) : (
              <Hint>{t('payment.stamp_tax_first_time_hint')}</Hint>
            )}

            {stampSuggestions.length > 0 && (
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

            <MoneyField size="sm">
              <MoneyAmountInput
                value={stampTax}
                onChange={handleStampChange}
                placeholder={!stampKnown ? t('payment.stamp_tax_other_placeholder') : undefined}
                className={moneyInputCls('sm')}
              />
            </MoneyField>
          </div>

          <div className="h-px bg-border" />

          {/* Cuenta de débito */}
          {arsToSettle > 0 && (
            <div className="flex flex-col gap-1.5">
              <FieldLabel>{t('labels.debit_account')}</FieldLabel>
              <DebitAccountSelect
                accounts={paymentAccounts}
                value={paymentAccountId}
                onChange={setPaymentAccountId}
                label={t('labels.debit_account')}
                placeholder={t('errors.account_required')}
                availableLabel={t('payment.available_label')}
                invalid={Boolean(errors.paymentAccountId)}
              />
              {errors.paymentAccountId && <FieldError>{errors.paymentAccountId}</FieldError>}
              {negativeWarning?.negative && (
                <NegativeBalanceNotice projected={negativeWarning.projected} currency="ARS" />
              )}
            </div>
          )}

          {/* Cuenta en dólares: al lado de la de pesos, porque son las dos patas de la
              misma decisión. Separadas —una arriba con los chips, otra acá abajo— la
              pantalla pedía cuentas en dos momentos distintos. */}
          {payUsdInUsd && (
            <div className="flex flex-col gap-1.5">
              <FieldLabel>{t('payment.usd_account_label')}</FieldLabel>
              <DebitAccountSelect
                accounts={usdAccounts}
                currency="USD"
                value={usdAccountId}
                onChange={setUsdAccountId}
                label={t('payment.usd_account_label')}
                placeholder={t('errors.account_required')}
                availableLabel={t('payment.available_label')}
                invalid={Boolean(errors.usdAccountId)}
              />
              {errors.usdAccountId && <FieldError>{errors.usdAccountId}</FieldError>}
              {usdNegativeWarning?.negative && (
                <NegativeBalanceNotice projected={usdNegativeWarning.projected} currency="USD" />
              )}
            </div>
          )}

          {/* Monto a pagar: consumos + sello. Con dos débitos, uno por moneda. */}
          <div className="flex flex-col gap-1.5">
            <FieldLabel>{t('labels.amount_to_pay')}</FieldLabel>
            <Hint>
              {debitRows === null
                ? t('labels.amount_to_pay_helper')
                : debitRows.length > 1
                  ? t('payment.debits_helper')
                  : t('labels.amount_to_pay_helper_usd')}
            </Hint>
            {/* El monto es DERIVADO de lo que se cancela, no un campo libre: un importe
                editable podía no corresponder a ninguna deuda y el resumen quedaba
                marcado como pagado igual. Pagar de menos es un pago parcial, que hoy
                no está soportado. */}
            {/* Pagando los dólares con dólares NO hay un "monto a pagar": hay un monto
                por moneda, y no se suman. Mostrar uno grande y el otro como nota al pie
                hace leer el primero como el total. Van los dos, cada uno con su cuenta. */}
            {debitRows !== null ? (
              <div className="flex flex-col gap-2">
                {debitRows.map((d) => (
                  <div
                    key={d.key}
                    className="flex items-baseline justify-between gap-3 rounded-[13px] border-[1.5px] border-border bg-card px-4 py-3"
                  >
                    <span className="text-[13px] text-text-muted">
                      {d.account
                        ? t('payment.debit_from', { account: d.account })
                        : t('errors.account_required')}
                    </span>
                    <span className="text-xl font-extrabold tracking-tight tabular-nums text-text">
                      {d.value}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <MoneyField size="lg">
                {/* Formateado: al pasar a solo-lectura se perdía el formateo que hacía el
                    input mientras se tipeaba, y el monto salía crudo ("52000"). */}
                <output className={`${moneyInputCls('lg')} block`}>
                  {arsDebit !== null ? fmtARS(arsDebit).replace(/^\$\s?/, '') : '—'}
                </output>
              </MoneyField>
            )}

            {/* Al pesificar: desglose línea a línea de cómo se arma el total en ARS. */}
            {pesifyUsd && (
              <div className="mt-2 rounded-[12px] border border-border bg-page px-4 text-xs tabular-nums">
                <div className="flex items-center justify-between py-2.5 text-text-muted">
                  <span>{t('payment.breakdown_ars')}</span>
                  <span className="font-semibold text-text">{fmtARS(pendingAmountARS)}</span>
                </div>
                <div className="flex items-center justify-between border-t border-border py-2.5 text-text-muted">
                  <span>
                    {t('payment.breakdown_usd', { usd: pendingAmountUSD })}
                    {parsedFx !== null && parsedFx > 0 ? ` × ${fxRate}` : ''}
                  </span>
                  <span className="font-semibold text-text">
                    {usdConvertedARS !== null ? fmtARS(usdConvertedARS) : '—'}
                  </span>
                </div>
                {parsedStamp > 0 && (
                  <div className="flex items-center justify-between border-t border-border py-2.5 text-text-muted">
                    <span>{t('payment.stamp_tax_label')}</span>
                    <span className="font-semibold text-text">{fmtARS(parsedStamp)}</span>
                  </div>
                )}
                <div className="flex items-center justify-between border-t border-border py-2.5 font-semibold text-text">
                  <span>{t('payment.breakdown_total')}</span>
                  <span className="text-sm">{suggestedTotal !== null ? fmtARS(suggestedTotal) : '—'}</span>
                </div>
              </div>
            )}
          </div>

          {/* Relación sello ↔ débito (note-rel): explica por qué del débito sale
              consumos + sello. Al pesificar, el desglose de arriba ya lo muestra. */}
          {parsedStamp > 0 && !pesifyUsd && (
            <div className="flex items-start gap-2.5 px-0.5 text-xs leading-relaxed text-text-muted">
              <Info className="mt-0.5 size-4 shrink-0 text-slate" aria-hidden />
              <span>
                {t('payment.stamp_tax_relation_note', {
                  total: suggestedTotal !== null ? fmtARS(suggestedTotal) : '—',
                  consumos: fmtARS(pendingAmountARS),
                  stamp: fmtARS(parsedStamp),
                })}
              </span>
            </div>
          )}

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

      {/* Cierre: irreversibilidad (neutral, informativo) + CTA */}
      <div className="flex gap-3 rounded-[14px] bg-page px-4 py-3.5">
        <Lock className="mt-0.5 size-4 shrink-0 text-text-soft" aria-hidden />
        <p className="text-xs leading-relaxed text-text-muted">{t('payment.warning')}</p>
      </div>

      {formError && <FieldError>{formError}</FieldError>}

      <Button type="submit" loading={isPending} size="lg">
        {isPending ? (
          tCommon('processing')
        ) : (
          <>
            <Check className="size-4" aria-hidden />
            {t('actions.confirm_payment')}
          </>
        )}
      </Button>
    </form>
  )
}
