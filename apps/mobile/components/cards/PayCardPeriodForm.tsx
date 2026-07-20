import { useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { useQueryClient } from '@tanstack/react-query'
import {
  computeStatementPaymentTotal,
  suggestStampTaxAmount,
  COMMON_STAMP_TAX_RATES,
  checkNegativeBalance,
} from '@grana/money-logic'
import { Money, parseMoneyInput } from '@grana/validation'
import { formatARS } from '@grana/i18n-messages'
import { getTodayAR, formatDateISO } from '../../lib/date'
import { payCardPeriod } from '../../lib/cards/mutations'
import { useShowCents } from '../../lib/preferences-context'
import { useT } from '../../lib/locale-context'
import { Label } from '../ui/Label'
import { MoneyAmountInput } from '../ui/MoneyAmountInput'
import { DateField } from '../ui/DateField'
import { Button } from '../ui/Button'
import { FormError } from '../ui/FormError'
import { SelectSheet } from '../ui/SelectSheet'

export type PaymentAccount = {
  id: string
  name: string
  subtitle: string | null
  balanceARS: number
}

type Props = {
  periodId: string
  cardId: string
  pendingAmountARS: number
  /** Pending USD debt of the period; > 0 requires the payment-day fx rate. */
  pendingAmountUSD: number
  /** Persisted dates of the running cycle — pre-filled for confirmation. */
  runningEndDate: string
  runningDueDate: string
  runningIsEstimated: boolean
  /** Close of the period being paid — the running cycle must close after it. */
  paidPeriodEndDate: string
  /** Alícuota de sellos recordada; null = primera vez (se pregunta). */
  stampTaxRate: number | null
  paymentAccounts: PaymentAccount[]
  /** Preselected debit account — the card's own bank when available. */
  defaultPaymentAccountId: string
}

const formatShortDate = (iso: string) => iso.split('-').reverse().join('/')

/**
 * Native pay-statement form (mirror of web's pay-card-period-form). Single
 * scrollable form, two sections. It ONLY assembles the `PayCardPeriodInput` and
 * reproduces web's client-side defaults + validation — all tax/FX/next-period
 * logic lives server-side in the shared `payCardPeriod`.
 */
export function PayCardPeriodForm({
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
}: Props) {
  const t = useT()
  const router = useRouter()
  const queryClient = useQueryClient()
  const showCents = useShowCents()
  const fmtARS = (n: number) => formatARS(n, showCents)

  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [accountSheet, setAccountSheet] = useState(false)
  const [openPicker, setOpenPicker] = useState<'payment' | 'nextEnd' | 'nextDue' | null>(null)

  const hasUsdDebt = pendingAmountUSD > 0

  // Base del impuesto de sellos = total ARS del resumen. Si la tarjeta ya tiene
  // alícuota, se sugiere el monto; si no, el usuario elige (primera vez).
  const stampBase = pendingAmountARS
  const stampKnown = stampTaxRate != null
  const initialStamp = stampTaxRate != null ? suggestStampTaxAmount(stampBase, stampTaxRate) : 0

  const sumARS = (a: number, b: number) => Money.toNumber(Money.add(Money.from(a), Money.from(b)))

  const consumosBase = (fx: number | null): number | null =>
    hasUsdDebt ? computeStatementPaymentTotal(pendingAmountARS, pendingAmountUSD, fx) : pendingAmountARS

  const [stampTax, setStampTax] = useState(initialStamp > 0 ? String(initialStamp) : '')
  const [amount, setAmount] = useState(String(sumARS(pendingAmountARS, initialStamp)))
  const [fxRate, setFxRate] = useState('')
  const [paymentAccountId, setPaymentAccountId] = useState(
    defaultPaymentAccountId || paymentAccounts[0]?.id || '',
  )
  const [paymentDate, setPaymentDate] = useState(formatDateISO(getTodayAR()))
  const [nextEndDate, setNextEndDate] = useState(runningEndDate)
  const [nextDueDate, setNextDueDate] = useState(runningDueDate)

  const parsedFx = fxRate ? parseMoneyInput(fxRate, { decimalPlaces: 6 }) : null
  const parsedStamp = parseMoneyInput(stampTax) ?? 0
  const computedTotal = hasUsdDebt
    ? computeStatementPaymentTotal(pendingAmountARS, pendingAmountUSD, parsedFx)
    : null
  const usdConvertedARS =
    computedTotal !== null && hasUsdDebt
      ? Math.round((computedTotal - pendingAmountARS) * 100) / 100
      : null
  const suggestedConsumos = consumosBase(parsedFx)
  const suggestedTotal = suggestedConsumos !== null ? sumARS(suggestedConsumos, parsedStamp) : null

  const recomputeAmount = (fx: number | null, stamp: number) => {
    const base = consumosBase(fx)
    if (base !== null) setAmount(String(sumARS(base, stamp)))
  }

  const handleFxChange = (value: string) => {
    setFxRate(value)
    recomputeAmount(value ? parseMoneyInput(value, { decimalPlaces: 6 }) : null, parsedStamp)
  }
  const handleStampChange = (value: string) => {
    setStampTax(value)
    recomputeAmount(parsedFx, parseMoneyInput(value) ?? 0)
  }

  // Chips de monto (sin mostrar el %): cada alícuota común aplicada a la base + el
  // monto aprendido/sugerido, deduplicados.
  const stampSuggestions = Array.from(
    new Set(
      [
        ...(initialStamp > 0 ? [initialStamp] : []),
        ...COMMON_STAMP_TAX_RATES.map((rate) => suggestStampTaxAmount(stampBase, rate)),
      ].filter((amt) => amt > 0),
    ),
  ).sort((a, b) => b - a)

  const selectedAccount = paymentAccounts.find((a) => a.id === paymentAccountId)
  const parsedPaymentAmount = parseMoneyInput(amount)
  const negativeWarning =
    selectedAccount && parsedPaymentAmount !== null && parsedPaymentAmount > 0
      ? checkNegativeBalance(selectedAccount.balanceARS, parsedPaymentAmount)
      : null

  const validate = () => {
    const errs: Record<string, string> = {}
    const parsedAmount = parseMoneyInput(amount)
    if (parsedAmount === null || parsedAmount <= 0) errs.amount = t('cards.errors.limit_invalid')
    if (hasUsdDebt && (parsedFx === null || parsedFx <= 0)) errs.fxRate = t('cards.errors.fx_required')
    if (!paymentAccountId) errs.paymentAccountId = t('cards.errors.account_required')
    if (!paymentDate) errs.paymentDate = t('common.required_short')
    if (!nextEndDate) errs.nextEndDate = t('common.required_short')
    if (!nextDueDate) errs.nextDueDate = t('common.required_short')
    if (nextEndDate && nextEndDate <= paidPeriodEndDate) {
      errs.nextEndDate = t('cards.errors.next_end_before_known', {
        date: formatShortDate(paidPeriodEndDate),
      })
    }
    if (nextEndDate && nextDueDate && nextDueDate <= nextEndDate) {
      errs.nextDueDate = t('cards.errors.due_after_close')
    }
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = async () => {
    setFormError(null)
    if (!validate()) return
    setSubmitting(true)
    const result = await payCardPeriod(queryClient, {
      period_id: periodId,
      amount: parseMoneyInput(amount) ?? 0,
      payment_account_id: paymentAccountId,
      payment_date: paymentDate,
      next_end_date: nextEndDate,
      next_due_date: nextDueDate,
      stamp_tax_amount: parseMoneyInput(stampTax) ?? 0,
      ...(hasUsdDebt && parsedFx !== null && parsedFx > 0 ? { fx_rate_to_ars: parsedFx } : {}),
    })
    setSubmitting(false)
    if (!result.ok) {
      setFormError(t(result.errorKey))
      return
    }
    router.replace({ pathname: '/(app)/cards/[id]', params: { id: cardId } })
  }

  return (
    <View className="flex-col gap-5">
      {/* Section 1: Payment data */}
      <View className="flex-col gap-5 rounded-2xl border border-border bg-card p-5">
        <Text className="text-[11px] font-bold uppercase tracking-wider text-text-soft">
          {t('cards.payment.section_payment_data')}
        </Text>

        {/* FX (solo USD) */}
        {hasUsdDebt && (
          <View className="flex-col gap-1.5">
            <Label>{t('cards.payment.fx_label')}</Label>
            <Text className="text-xs text-text-muted">{t('cards.payment.fx_helper')}</Text>
            <MoneyAmountInput
              value={fxRate}
              onChangeText={handleFxChange}
              placeholder={t('cards.payment.fx_placeholder')}
              invalid={Boolean(errors.fxRate)}
            />
            {errors.fxRate && <Text className="text-xs text-error">{errors.fxRate}</Text>}
            {usdConvertedARS !== null && (
              <Text className="text-xs tabular-nums text-text-muted">
                {t('cards.payment.breakdown_usd', { usd: pendingAmountUSD })}
                {parsedFx !== null && parsedFx > 0 ? ` × ${fxRate}` : ''} ={' '}
                <Text className="font-semibold text-text">{fmtARS(usdConvertedARS)}</Text>
              </Text>
            )}
          </View>
        )}

        {/* Impuesto de sellos */}
        <View className="flex-col gap-1.5">
          <Label>{t('cards.payment.stamp_tax_label')}</Label>
          {stampKnown ? (
            <Text className="text-xs text-text-muted">
              {t('cards.payment.stamp_tax_learned_alert', { amount: fmtARS(initialStamp) })}
            </Text>
          ) : (
            <Text className="text-xs text-text-muted">
              {t('cards.payment.stamp_tax_first_time_hint')}
            </Text>
          )}
          {stampSuggestions.length > 0 && (
            <View className="flex-row flex-wrap gap-2">
              {stampSuggestions.map((amt) => {
                const active = parsedStamp === amt
                return (
                  <Pressable
                    key={amt}
                    onPress={() => handleStampChange(String(amt))}
                    className={`rounded-full border px-3 py-1 ${
                      active ? 'border-emerald bg-emerald-soft' : 'border-border bg-card'
                    }`}
                  >
                    <Text
                      className={`text-sm font-semibold tabular-nums ${
                        active ? 'text-emerald-deep' : 'text-text-muted'
                      }`}
                    >
                      {fmtARS(amt)}
                    </Text>
                  </Pressable>
                )
              })}
              <Pressable
                onPress={() => handleStampChange('0')}
                className={`rounded-full border px-3 py-1 ${
                  parsedStamp === 0 && stampTax !== ''
                    ? 'border-emerald bg-emerald-soft'
                    : 'border-border bg-card'
                }`}
              >
                <Text
                  className={`text-sm font-medium ${
                    parsedStamp === 0 && stampTax !== '' ? 'text-emerald-deep' : 'text-text-soft'
                  }`}
                >
                  {t('cards.payment.stamp_tax_none')}
                </Text>
              </Pressable>
            </View>
          )}
          <MoneyAmountInput
            value={stampTax}
            onChangeText={handleStampChange}
            placeholder={!stampKnown ? t('cards.payment.stamp_tax_other_placeholder') : undefined}
          />
        </View>

        {/* Monto a pagar */}
        <View className="flex-col gap-1.5">
          <Label>{t('cards.labels.amount_to_pay')}</Label>
          <Text className="text-xs text-text-muted">{t('cards.labels.amount_to_pay_helper')}</Text>
          <MoneyAmountInput value={amount} onChangeText={setAmount} invalid={Boolean(errors.amount)} />
          {errors.amount && <Text className="text-xs text-error">{errors.amount}</Text>}

          {hasUsdDebt && (
            <View className="mt-2 rounded-xl border border-border bg-page px-4">
              <BreakdownRow
                label={t('cards.payment.breakdown_ars')}
                value={fmtARS(pendingAmountARS)}
                first
              />
              <BreakdownRow
                label={`${t('cards.payment.breakdown_usd', { usd: pendingAmountUSD })}${
                  parsedFx !== null && parsedFx > 0 ? ` × ${fxRate}` : ''
                }`}
                value={usdConvertedARS !== null ? fmtARS(usdConvertedARS) : '—'}
              />
              {parsedStamp > 0 && (
                <BreakdownRow label={t('cards.payment.stamp_tax_label')} value={fmtARS(parsedStamp)} />
              )}
              <BreakdownRow
                label={t('cards.payment.breakdown_total')}
                value={suggestedTotal !== null ? fmtARS(suggestedTotal) : '—'}
                bold
              />
            </View>
          )}
        </View>

        <View className="h-px bg-border" />

        {/* Cuenta de débito */}
        <View className="flex-col gap-1.5">
          <Label>{t('cards.labels.debit_account')}</Label>
          <Pressable
            onPress={() => setAccountSheet(true)}
            className={`h-11 flex-row items-center justify-between rounded-lg border bg-card px-3 ${
              errors.paymentAccountId ? 'border-error' : 'border-border'
            }`}
          >
            <Text className={`text-sm ${selectedAccount ? 'text-text' : 'text-text-soft'}`}>
              {selectedAccount ? selectedAccount.name : t('cards.errors.account_required')}
            </Text>
            {selectedAccount && (
              <Text className="text-xs tabular-nums text-text-muted">
                {fmtARS(selectedAccount.balanceARS)}
              </Text>
            )}
          </Pressable>
          {errors.paymentAccountId && (
            <Text className="text-xs text-error">{errors.paymentAccountId}</Text>
          )}
          {negativeWarning?.negative && (
            <Text className="text-xs text-warning-deep">
              {t('transactions.form.negative_warning', {
                amount: `ARS ${negativeWarning.projected.toLocaleString('es-AR')}`,
              })}
            </Text>
          )}
        </View>

        {/* Fecha de pago */}
        <View className="flex-col gap-1.5">
          <Label>{t('cards.labels.payment_date')}</Label>
          <DateField
            value={paymentDate}
            onChange={setPaymentDate}
            open={openPicker === 'payment'}
            onOpenChange={(o) => setOpenPicker(o ? 'payment' : null)}
          />
          {errors.paymentDate && <Text className="text-xs text-error">{errors.paymentDate}</Text>}
        </View>
      </View>

      {/* Section 2: next period */}
      <View className="flex-col gap-4 rounded-2xl border border-border bg-card p-5">
        <View className="flex-row flex-wrap items-center gap-2">
          <Text className="text-[11px] font-bold uppercase tracking-wider text-text-soft">
            {t('cards.payment.section_next_period')}
          </Text>
          {runningIsEstimated && (
            <View className="rounded-full bg-border-soft px-2 py-0.5">
              <Text className="text-[10px] font-semibold text-text-muted">
                {t('cards.payment.estimated_badge')}
              </Text>
            </View>
          )}
        </View>
        <Text className="text-xs text-text-muted">{t('cards.labels.next_period_helper')}</Text>
        <Text className="rounded-lg bg-page px-3 py-2.5 text-xs text-text-muted">
          {t('cards.payment.next_period_context', { date: formatShortDate(paidPeriodEndDate) })}
        </Text>

        <View className="flex-row gap-3">
          <View className="flex-1 flex-col gap-1.5">
            <Text className="text-xs font-medium text-text-muted">
              {t('cards.labels.close_date')}
            </Text>
            <DateField
              value={nextEndDate}
              onChange={setNextEndDate}
              invalid={Boolean(errors.nextEndDate)}
              open={openPicker === 'nextEnd'}
              onOpenChange={(o) => setOpenPicker(o ? 'nextEnd' : null)}
            />
            {errors.nextEndDate && <Text className="text-xs text-error">{errors.nextEndDate}</Text>}
          </View>
          <View className="flex-1 flex-col gap-1.5">
            <Text className="text-xs font-medium text-text-muted">{t('cards.labels.due_date')}</Text>
            <DateField
              value={nextDueDate}
              onChange={setNextDueDate}
              invalid={Boolean(errors.nextDueDate)}
              open={openPicker === 'nextDue'}
              onOpenChange={(o) => setOpenPicker(o ? 'nextDue' : null)}
            />
            {errors.nextDueDate && <Text className="text-xs text-error">{errors.nextDueDate}</Text>}
          </View>
        </View>
      </View>

      {/* Irreversibility warning + CTA */}
      <Text className="rounded-xl bg-page px-4 py-3.5 text-xs leading-relaxed text-text-muted">
        {t('cards.payment.warning')}
      </Text>

      <FormError message={formError} />

      <Button onPress={handleSubmit} loading={submitting} size="lg">
        {t('cards.actions.confirm_payment')}
      </Button>

      <SelectSheet
        visible={accountSheet}
        onClose={() => setAccountSheet(false)}
        title={t('cards.labels.debit_account')}
        items={paymentAccounts}
        keyExtractor={(a) => a.id}
        renderRow={(a) => (
          <Pressable
            onPress={() => {
              setPaymentAccountId(a.id)
              setAccountSheet(false)
            }}
            className="flex-row items-center justify-between gap-3 rounded-xl px-3 py-3 active:bg-border-soft"
          >
            <View className="flex-1">
              <Text className="text-sm font-medium text-text">{a.name}</Text>
              {a.subtitle && <Text className="text-xs text-text-muted">{a.subtitle}</Text>}
            </View>
            <Text className="text-xs tabular-nums text-text-muted">{fmtARS(a.balanceARS)}</Text>
          </Pressable>
        )}
      />
    </View>
  )
}

function BreakdownRow({
  label,
  value,
  first,
  bold,
}: {
  label: string
  value: string
  first?: boolean
  bold?: boolean
}) {
  return (
    <View
      className={`flex-row items-center justify-between py-2.5 ${
        first ? '' : 'border-t border-border'
      }`}
    >
      <Text className={`text-xs ${bold ? 'font-semibold text-text' : 'text-text-muted'}`}>
        {label}
      </Text>
      <Text className="text-xs font-semibold tabular-nums text-text">{value}</Text>
    </View>
  )
}
