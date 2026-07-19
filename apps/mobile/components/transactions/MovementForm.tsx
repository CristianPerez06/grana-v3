import { useMemo, useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { getTodayAR } from '@grana/money-logic'
import { Money, parseMoneyInput } from '@grana/validation'
import {
  useMovementForm,
  type CategoryWithSubcategories,
  type Frequency,
  type Household,
  type IntervalUnit,
  type MovementEditContext,
  type MovementFormAccount,
  type Tab,
} from '@grana/movement-form'
import { Label } from '../ui/Label'
import { Input } from '../ui/Input'
import { MoneyAmountInput } from '../ui/MoneyAmountInput'
import { DateField } from '../ui/DateField'
import { Segmented } from '../ui/Segmented'
import { Switch } from '../ui/Switch'
import { FormError } from '../ui/FormError'
import { Spinner } from '../ui/Spinner'
import { AccountSelectField, CategorySelectField } from './form-pickers'
import { colors } from '../../lib/colors'
import { useT } from '../../lib/locale-context'
import { createMovementMutators } from '../../lib/transactions/mutators'
import { invalidateAfterMovementMutation } from '../../lib/transactions/invalidate'
import { useQueryClient } from '@tanstack/react-query'

// The five tabs of the unified form. Rendered as a two-row wrapping pill group
// (not the shared `Segmented`): five `flex-1` segments would squeeze
// "Transferencia" into two/three lines on a narrow phone. The hook still gates
// what each tab shows (credit only in Gasto, etc.).
const TABS: Tab[] = ['expense', 'income', 'transfer', 'adjustment', 'exchange']

// Recurrence frequency chips + custom-interval units, mirror of the web form.
const FREQUENCIES: Frequency[] = ['weekly', 'biweekly', 'monthly', 'annual', 'custom']
const INTERVAL_UNITS: IntervalUnit[] = ['day', 'week', 'month', 'year']

// The common counts as one-tap chips; anything else via the stepper. Local
// presentation mirror of the web form's constants (component-local there too).
const INSTALLMENT_OPTIONS = [1, 3, 6, 12]
const MAX_INSTALLMENTS = 60

const CURRENCY_SYMBOL: Record<'ARS' | 'USD', string> = { ARS: '$', USD: 'U$D' }

const fmtAmount = (n: number) =>
  n.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })

type Props = {
  accounts: MovementFormAccount[]
  categories: CategoryWithSubcategories[]
  household: Household | null
  /** Present ⇒ the form is in edit mode (tabs hidden, fields gated). */
  edit?: MovementEditContext
  onDone: () => void
}

/**
 * Native render of the cross-platform `useMovementForm` hook — the mobile twin
 * of `apps/web/lib/transactions/components/movement-form.tsx`. Covers the create
 * flow (incl. the credit family: card purchase, installments and reimbursement)
 * and the edit flow (`edit` prop): in edit mode the type selector is hidden, the
 * immutable fields render as read-only context rows, and each editable field is
 * gated by `edit.editableFields`. The hook owns all state/cascades/submit; this
 * file only paints it and wires the native mutators + cache invalidation.
 */
export function MovementForm({ accounts, categories, household, edit, onDone }: Props) {
  const t = useT()
  const queryClient = useQueryClient()
  const mutators = useMemo(() => createMovementMutators(t), [t])

  const form = useMovementForm({
    mutators,
    accounts,
    categories,
    edit,
    household,
    today: getTodayAR(),
    // Hook keys are relative to the `transactions` namespace (web wires this
    // with `useTranslations('transactions')`); the mobile translator is global.
    translate: (key, values) =>
      values ? t(`transactions.${key}`, values) : t(`transactions.${key}`),
    onMutationSuccess: () => invalidateAfterMovementMutation(queryClient),
    onSuccess: onDone,
  })

  // "Otras" keeps the stepper open even when the typed value lands on a preset.
  const [customInstallments, setCustomInstallments] = useState(false)

  // Edit mode: the type selector is hidden and each field is gated by
  // `editableFields` (immutable ones render as read-only context rows). Mirror of
  // web's `movement-form.tsx` isEdit branches.
  const isEdit = form.isEdit
  const editable = edit?.editableFields

  const members = household && household.members.length === 2 ? household.members : null
  // In edit: the share toggle only shows when the field is editable (simple
  // expense / installment parent); the category/date/description fields likewise.
  const showShared = (isEdit ? !!editable?.shared : form.tab === 'expense') && members !== null
  const showCategory = isEdit ? !!editable?.category : form.tab === 'expense' || form.tab === 'income'
  const showAdjustment = form.tab === 'adjustment'
  // The adjustment sign toggle + banner: create shows it on the adjustment tab;
  // edit gates it on the field being editable.
  const showAdjustmentControls = isEdit ? !!editable?.adjustmentDirection : showAdjustment
  const showExchange = form.tab === 'exchange'
  const showDate = isEdit ? !!editable?.date : true
  const showDescription = isEdit ? !!editable?.description : true
  // Amount hero: always in create; in edit only when the amount is editable (a
  // paid consumption / locked madre shows no amount field — web does the same).
  const showAmount = isEdit ? !!editable?.amount : true
  // Currency is immutable post-creation — only the create flow lets it switch.
  const showCurrencySeg = !isEdit && form.currencyOptions.length > 1
  // Source account: immutable context in edit, EXCEPT a statement payment whose
  // debit account can move (`editable.account`).
  const showSourceAccount = !isEdit || !!editable?.account
  // Transfer/exchange destination account: immutable in edit (context row).
  const showDestinationAccount = !isEdit

  // "Repetir": create-only, on gasto (non-installment) / ingreso / transferencia,
  // mirror of the hook's recurrence gate in submitCreate.
  const showRepeat =
    !isEdit && form.tab !== 'adjustment' && form.tab !== 'exchange' && !form.isInstallments

  // Adjustment balance preview (create-only): current → resulting balance for
  // the selected currency, signed by the direction. Mirror of web's preview.
  const adjustmentPreview = (() => {
    if (isEdit || !showAdjustment || !form.selectedAccount) return null
    const current = form.selectedAccount.balances[form.currencyCode] ?? 0
    const parsed = parseMoneyInput(form.amount)
    if (parsed === null) return { current, next: current }
    const next =
      form.adjustmentDirection === 'decrease'
        ? Money.toNumber(Money.subtract(Money.from(current), Money.from(parsed)))
        : Money.toNumber(Money.add(Money.from(current), Money.from(parsed)))
    return { current, next }
  })()

  // Exchange: the received currency is the destination's other currency (in edit
  // it's fixed from the movement); the implicit rate "1 {dst} = {src}" is derived
  // read-only from both amounts.
  const receivedCurrency: 'ARS' | 'USD' =
    (isEdit ? edit?.destinationCurrency : form.exchangeDestCurrency) ?? 'USD'
  const exchangeRate = (() => {
    if (!showExchange) return null
    const src = parseMoneyInput(form.amount)
    const dst = parseMoneyInput(form.destinationAmount)
    if (src === null || dst === null || src <= 0 || dst <= 0) return null
    return Money.toNumber(Money.divide(Money.from(src), dst))
  })()

  const isCredit = form.selectedAccount?.type === 'credit'
  // Installments picker is create-only (the count is immutable in edit; a madre
  // shows it as a context row).
  const showInstallmentsCard = !isEdit && form.tab === 'expense' && isCredit
  const installmentsNum = parseInt(form.installments) || 1
  const showInstallmentStepper =
    customInstallments || !INSTALLMENT_OPTIONS.includes(installmentsNum)
  const stepInstallments = (delta: number) =>
    form.setInstallments(String(Math.max(1, Math.min(MAX_INSTALLMENTS, installmentsNum + delta))))
  // Per-installment breakdown for the cuotas card (mirror of the web preview).
  const perInstallment = (() => {
    if (!form.isInstallments) return null
    const parsed = parseMoneyInput(form.amount)
    if (parsed === null || parsed <= 0) return null
    return Money.toNumber(Money.divide(Money.from(parsed), installmentsNum))
  })()

  // Reimbursement is available on any expense, incl. installment purchases: the
  // hook declares it against the installment parent (statement subtype falls in
  // the first cuota's period). In edit it's gated on the field being editable
  // (simple expense / madre); a received/cancelled reintegro renders read-only
  // via `form.reimbursementReadOnly`.
  const showReimbursement = isEdit ? !!editable?.reimbursement : form.tab === 'expense'
  // Exchange received amount + implicit rate: create shows it when a destination
  // currency exists; edit gates it on `editable.destinationAmount`. The "no other
  // currency" hint is create-only (submit blocked by the hook).
  const showExchangeReceived = isEdit
    ? !!editable?.destinationAmount
    : showExchange && !!form.exchangeDestCurrency
  const showExchangeNoCurrencyHint = !isEdit && showExchange && !form.exchangeDestCurrency

  // Default the credit-to account to the same-institution cash/bank — mirrored
  // from the hook for the UI-side toggle-on path (web does the same).
  const pickReimbursementAccount = (expenseAccountId: string): string => {
    const expenseAccount = accounts.find((a) => a.id === expenseAccountId)
    const inst = expenseAccount?.institutionId ?? null
    const banks = accounts.filter((a) => a.type !== 'credit')
    const match = inst ? banks.find((a) => a.institutionId === inst) : undefined
    return match?.id ?? banks[0]?.id ?? ''
  }

  // Read-only context rows shown in edit mode: the immutable fields (type,
  // currency, account(s)). Mirror of web's `contextRows`.
  const contextRows: { label: string; value: string }[] =
    isEdit && edit
      ? [
          {
            label: t('transactions.labels.type'),
            value: edit.isParent
              ? t('transactions.installment_purchase_label')
              : t(`transactions.types.${edit.type}`),
          },
          { label: t('transactions.labels.currency'), value: edit.currencyCode },
          ...(edit.isParent && edit.installmentsTotal
            ? [
                {
                  label: t('transactions.labels.installments'),
                  value: t('transactions.installments_count', { count: edit.installmentsTotal }),
                },
              ]
            : []),
          ...(edit.type === 'transfer' || edit.type === 'exchange'
            ? [
                {
                  label: t('transactions.labels.source_account'),
                  value: edit.sourceAccountName ?? edit.accountId,
                },
                {
                  label: t('transactions.labels.destination_account'),
                  value: edit.destinationAccountName ?? '—',
                },
              ]
            : edit.sourceAccountName && !editable?.account
              ? [{ label: t('transactions.labels.account'), value: edit.sourceAccountName }]
              : []),
        ]
      : []

  return (
    <View className="flex-col gap-5">
      {/* Tab selector — two-row wrapping pill group (see design 1b). Hidden in
          edit mode: the type is immutable (shown as a context row). */}
      {!isEdit && (
        <View
          accessibilityRole="radiogroup"
          accessibilityLabel={t('transactions.form.type_label')}
          className="flex-row flex-wrap gap-1.5 rounded-xl bg-border-soft p-1"
        >
          {TABS.map((tab) => {
            const active = form.tab === tab
            return (
              <Pressable
                key={tab}
                onPress={() => form.setTab(tab)}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                className={`rounded-lg px-3.5 py-1.5 ${active ? 'bg-card' : ''}`}
              >
                <Text
                  className={`text-sm font-bold ${active ? 'text-text' : 'text-text-muted'}`}
                >
                  {t(`transactions.types.${tab}`)}
                </Text>
              </Pressable>
            )
          })}
        </View>
      )}

      {/* Read-only context rows (edit): immutable fields as label/value with a
          "no editable" caption. */}
      {contextRows.length > 0 && (
        <View className="overflow-hidden rounded-xl border border-border bg-card">
          {contextRows.map((row, i) => (
            <View
              key={row.label}
              className={`flex-row items-center justify-between gap-3 px-4 py-3 ${
                i > 0 ? 'border-t border-border-soft' : ''
              }`}
            >
              <Text className="text-[11px] font-bold uppercase tracking-wider text-text-soft">
                {row.label}
              </Text>
              <Text className="flex-1 text-right text-[15px] font-semibold text-text" numberOfLines={1}>
                {row.value}
                <Text className="text-xs font-normal text-text-muted"> {t('common.not_editable')}</Text>
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Amount (+ currency when the account has both). In edit, only when the
          amount is editable. */}
      {showAmount && (
        <View className="flex-col gap-1.5">
          <Label>{t('transactions.form.amount_label')}</Label>
          <MoneyAmountInput
            value={form.amount}
            onChangeText={form.setAmount}
            placeholder="0"
            autoFocus={!isEdit}
          />
          {isEdit && edit?.isParent && (
            <Text className="pt-0.5 text-xs text-text-muted">
              {t('transactions.installment_recalc_hint', {
                count: edit.installmentsTotal ?? 0,
              })}
            </Text>
          )}
          {showCurrencySeg && (
            <View className="pt-1">
              <Segmented
                ariaLabel={t('transactions.form.currency_label')}
                value={form.currencyCode}
                onValueChange={(v) => form.setCurrencyCode(v as 'ARS' | 'USD')}
                options={form.currencyOptions.map((c) => ({ value: c, label: c }))}
              />
            </View>
          )}
        </View>
      )}

      {/* Adjustment direction (Suma / Resta) + informative banner */}
      {showAdjustmentControls && (
        <>
          <Segmented
            ariaLabel={t('transactions.types.adjustment')}
            value={form.adjustmentDirection}
            onValueChange={(v) => form.setAdjustmentDirection(v as 'increase' | 'decrease')}
            options={[
              { value: 'increase', label: `${t('transactions.directions.increase')} (+)` },
              { value: 'decrease', label: `${t('transactions.directions.decrease')} (−)` },
            ]}
          />
          <View className="rounded-xl border border-warning-deep/30 bg-warning-deep/5 p-3">
            <Text className="text-xs text-warning-deep">
              <Text className="font-bold">
                {t('transactions.drawer.adjust_banner_title')}{' '}
              </Text>
              {t('transactions.drawer.adjust_banner_body')}
            </Text>
          </View>
        </>
      )}

      {/* Source account. Immutable context in edit, except a statement payment
          whose debit account can move (`editable.account`). */}
      {showSourceAccount && (
        <AccountSelectField
          label={
            showAdjustment
              ? t('transactions.drawer.account_to_adjust')
              : t('transactions.form.account_label')
          }
          accounts={form.eligibleAccounts}
          selectedId={form.accountId}
          onSelect={form.setAccountId}
        />
      )}

      {/* Installments (credit expense) — ARS gets chips + stepper + preview;
          USD gets the cuotas-sólo-ARS hint (simple USD purchase stays allowed) */}
      {showInstallmentsCard && (
        <View className="flex-col gap-3 rounded-xl border border-border bg-card p-4">
          <Text className="text-sm font-semibold text-text">
            {t('transactions.labels.installments')}
          </Text>
          {form.currencyCode === 'ARS' ? (
            <>
              <View className="flex-row flex-wrap gap-2">
                {INSTALLMENT_OPTIONS.map((n) => {
                  const active = !showInstallmentStepper && form.installments === String(n)
                  return (
                    <Pressable
                      key={n}
                      onPress={() => {
                        setCustomInstallments(false)
                        form.setInstallments(String(n))
                      }}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      className={`rounded-lg px-3.5 py-2 ${
                        active ? 'bg-navy' : 'bg-border-soft'
                      }`}
                    >
                      <Text
                        className={`text-sm font-bold ${
                          active ? 'text-white' : 'text-text-muted'
                        }`}
                      >
                        {n}×
                      </Text>
                    </Pressable>
                  )
                })}
                <Pressable
                  onPress={() => {
                    setCustomInstallments(true)
                    // Open the stepper at a real installment count, never "1 cuota".
                    if (installmentsNum < 2) form.setInstallments('2')
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: showInstallmentStepper }}
                  className={`rounded-lg px-3.5 py-2 ${
                    showInstallmentStepper ? 'bg-navy' : 'bg-border-soft'
                  }`}
                >
                  <Text
                    className={`text-sm font-bold ${
                      showInstallmentStepper ? 'text-white' : 'text-text-muted'
                    }`}
                  >
                    {t('transactions.installments_options.custom')}
                  </Text>
                </Pressable>
              </View>
              {showInstallmentStepper && (
                <View className="flex-col items-center gap-1.5">
                  <View className="flex-row items-center gap-3">
                    <Pressable
                      onPress={() => stepInstallments(-1)}
                      disabled={installmentsNum <= 1}
                      accessibilityRole="button"
                      accessibilityLabel={t('transactions.installments_options.custom_decrease')}
                      className={`h-10 w-10 items-center justify-center rounded-lg border border-border bg-border-soft ${
                        installmentsNum <= 1 ? 'opacity-40' : ''
                      }`}
                    >
                      <Text className="text-xl font-bold text-navy">−</Text>
                    </Pressable>
                    <Input
                      value={form.installments}
                      onChangeText={(v) => {
                        const digits = v.replace(/\D/g, '')
                        if (digits === '') return form.setInstallments('')
                        form.setInstallments(String(Math.min(MAX_INSTALLMENTS, parseInt(digits))))
                      }}
                      onBlur={() => {
                        if (installmentsNum < 1) form.setInstallments('1')
                      }}
                      keyboardType="number-pad"
                      accessibilityLabel={t('transactions.installments_options.custom_label')}
                      className="w-16 text-center text-xl font-bold text-navy"
                    />
                    <Pressable
                      onPress={() => stepInstallments(1)}
                      disabled={installmentsNum >= MAX_INSTALLMENTS}
                      accessibilityRole="button"
                      accessibilityLabel={t('transactions.installments_options.custom_increase')}
                      className={`h-10 w-10 items-center justify-center rounded-lg border border-border bg-border-soft ${
                        installmentsNum >= MAX_INSTALLMENTS ? 'opacity-40' : ''
                      }`}
                    >
                      <Text className="text-xl font-bold text-navy">+</Text>
                    </Pressable>
                  </View>
                  <Text className="text-[11px] text-text-soft">
                    {t('transactions.installments_options.custom_range', {
                      max: MAX_INSTALLMENTS,
                    })}
                  </Text>
                </View>
              )}
              {form.isInstallments && perInstallment !== null && (
                <View className="rounded-lg bg-border-soft px-3 py-2">
                  <Text className="text-center text-[13px] text-text-muted">
                    {t('transactions.drawer.installments_breakdown', {
                      count: installmentsNum,
                      amount: fmtAmount(perInstallment),
                    })}
                  </Text>
                </View>
              )}
            </>
          ) : (
            <Text className="text-xs text-text-muted">
              {t('transactions.installments_options.ars_only_hint')}
            </Text>
          )}
        </View>
      )}

      {/* Destination account (transfer / exchange). Immutable context in edit. */}
      {form.tab === 'transfer' && showDestinationAccount && (
        <AccountSelectField
          label={t('transactions.form.destination_label')}
          accounts={form.otherAccounts}
          selectedId={form.destinationAccountId}
          onSelect={form.setDestinationAccountId}
        />
      )}
      {showExchange && showDestinationAccount && (
        <AccountSelectField
          label={t('transactions.drawer.account_toward')}
          accounts={form.cashBankAccounts}
          selectedId={form.destinationAccountId}
          onSelect={form.setDestinationAccountId}
        />
      )}

      {/* Exchange: received amount (destination currency) + implicit rate. */}
      {showExchangeReceived && (
        <View className="flex-col gap-3 rounded-xl border border-border bg-card p-4">
          <View className="flex-row items-center justify-between">
            <Text className="text-sm font-semibold text-text">
              {t('transactions.labels.exchange_received')}
            </Text>
            <View className="rounded-lg border border-border px-2.5 py-1">
              <Text className="text-xs font-bold text-text">{receivedCurrency}</Text>
            </View>
          </View>
          <MoneyAmountInput
            value={form.destinationAmount}
            onChangeText={form.setDestinationAmount}
            placeholder="0"
          />
          {exchangeRate !== null && (
            <Text className="text-xs text-text-muted">
              1 {receivedCurrency} = {CURRENCY_SYMBOL[form.currencyCode]}
              {fmtAmount(exchangeRate)} {form.currencyCode}
            </Text>
          )}
        </View>
      )}
      {showExchangeNoCurrencyHint && (
        <Text className="text-sm text-text-muted">
          {t('transactions.exchange.no_other_currency_hint', {
            currency: form.currencyCode === 'ARS' ? 'USD' : 'ARS',
          })}
        </Text>
      )}

      {/* Date */}
      {showDate && (
        <View className="flex-col gap-1.5">
          <Label>{t('transactions.form.date_label')}</Label>
          <DateField value={form.date} onChange={form.setDate} />
        </View>
      )}

      {/* Description (relabelled "Motivo del ajuste" for adjustments) */}
      {showDescription && (
      <View className="flex-col gap-1.5">
        <Label>
          {showAdjustment
            ? t('transactions.drawer.adjust_reason')
            : t('transactions.form.description_label')}
        </Label>
        <Input
          value={form.description}
          onChangeText={form.setDescription}
          onBlur={() => {
            void form.fetchSuggestionForDescription()
          }}
          placeholder={
            showAdjustment
              ? t('transactions.drawer.adjust_reason_placeholder')
              : t('transactions.form.description_placeholder')
          }
        />
        {form.suggestion && (
          <Pressable onPress={form.applySuggestion} className="pt-1">
            <Text className="text-xs font-semibold text-emerald">
              {t('transactions.form.suggestion_apply', {
                category: form.suggestion.categoryName,
              })}
            </Text>
          </Pressable>
        )}
      </View>
      )}

      {/* Adjustment balance preview: current → resulting balance */}
      {adjustmentPreview && (
        <View className="flex-row items-center justify-between rounded-xl border border-border bg-card px-4 py-3">
          <Text className="text-sm text-text-muted">
            {t('transactions.drawer.balance_will_be')}
          </Text>
          <Text className="text-sm font-semibold text-text">
            <Text className="text-text-soft">
              {CURRENCY_SYMBOL[form.currencyCode]}
              {fmtAmount(adjustmentPreview.current)}
            </Text>
            {'  →  '}
            {CURRENCY_SYMBOL[form.currencyCode]}
            {fmtAmount(adjustmentPreview.next)}
          </Text>
        </View>
      )}

      {/* Category (+ one-level subcategory drill) for expense/income */}
      {showCategory && (
        <CategorySelectField
          categories={form.transactionCategories}
          categoryId={form.categoryId}
          subcategoryId={form.subcategoryId}
          onPick={form.pickCategory}
        />
      )}

      {/* Negative-balance warning (non-blocking) */}
      {form.negativeWarning && (
        <View className="rounded-xl border border-warning-deep/30 bg-warning-deep/5 p-3">
          <Text className="text-xs text-warning-deep">
            {t('transactions.form.negative_warning', {
              amount: `${form.negativeWarning.currency} ${form.negativeWarning.projected.toLocaleString('es-AR')}`,
            })}
          </Text>
        </View>
      )}

      {/* Reimbursement declaration (expense, no installments) — full web parity:
          estimated amount, %/cap auto-calc, target radio (credit only),
          credit-to picker and received-now. */}
      {showReimbursement && (
        <View className="flex-col gap-3 rounded-xl border border-border bg-card p-4">
          <View className="flex-row items-center justify-between">
            <View className="flex-1 pr-3">
              <Text className="text-sm font-semibold text-text">
                {t('transactions.reimbursement.toggle')}
              </Text>
              <Text className="text-xs text-text-muted">
                {form.reimbursementReadOnly
                  ? t(
                      edit?.reimbursement?.status === 'cancelled'
                        ? 'transactions.reimbursement.readonly_hint_cancelled'
                        : 'transactions.reimbursement.readonly_hint_received',
                    )
                  : t('transactions.reimbursement.pending_hint')}
              </Text>
            </View>
            <Switch
              ariaLabel={t('transactions.reimbursement.toggle')}
              checked={form.reimbursementEnabled}
              disabled={form.reimbursementReadOnly}
              onValueChange={(on) => {
                form.setReimbursementEnabled(on)
                if (on) form.setReimbursementAccountId(pickReimbursementAccount(form.accountId))
              }}
            />
          </View>
          {/* Received/cancelled reintegro: read-only summary (target + amount),
              managed from its own confirm/cancel flow. */}
          {form.reimbursementReadOnly && edit?.reimbursement && (
            <View className="flex-row items-center justify-between gap-3 border-t border-border-soft pt-3">
              <Text className="text-xs text-text-muted">
                {t(`transactions.reimbursement.target.${edit.reimbursement.target}`)}
              </Text>
              <Text className="text-sm font-semibold text-text">
                {CURRENCY_SYMBOL[form.currencyCode]}
                {fmtAmount(edit.reimbursement.amount)}
              </Text>
            </View>
          )}
          {form.reimbursementEnabled && !form.reimbursementReadOnly && (
            <View className="flex-col gap-3 border-t border-border-soft pt-3">
              {/* Estimated amount */}
              <View className="flex-col gap-1.5">
                <Label>{t('transactions.reimbursement.estimated_amount')}</Label>
                <MoneyAmountInput
                  value={form.reimbursementAmount}
                  onChangeText={form.setReimbursementAmount}
                  placeholder="0"
                />
              </View>

              {/* Auto-calc by percent / cap */}
              <View className="flex-col gap-1.5">
                <Text className="text-xs text-text-muted">
                  {t('transactions.reimbursement.percent_hint')}
                </Text>
                <View className="flex-row gap-2">
                  <View className="flex-1 flex-col gap-1">
                    <Label>{t('transactions.reimbursement.percent_label')}</Label>
                    <Input
                      value={form.reimbursementPercent}
                      onChangeText={(v) => {
                        const norm = v.replace(',', '.')
                        form.setReimbursementPercent(norm)
                        form.applyReimbursementPercent(norm, form.reimbursementCap)
                      }}
                      keyboardType="decimal-pad"
                      placeholder="0"
                    />
                  </View>
                  <View className="flex-1 flex-col gap-1">
                    <Label>{t('transactions.reimbursement.cap_label')}</Label>
                    <MoneyAmountInput
                      value={form.reimbursementCap}
                      onChangeText={(v) => {
                        form.setReimbursementCap(v)
                        form.applyReimbursementPercent(form.reimbursementPercent, v)
                      }}
                      placeholder="0"
                    />
                  </View>
                </View>
              </View>

              {/* Target radio — credit only (cash/bank implies 'account'). A
                  vertical radio, not Segmented: the labels are long explanatory
                  strings that would wrap badly in a two-option segmented. */}
              {isCredit && (
                <View className="flex-col gap-1.5">
                  <Text className="text-xs text-text-muted">
                    {t('transactions.reimbursement.target_label')}
                  </Text>
                  <View className="flex-col gap-2">
                    {(['account', 'statement'] as const).map((tg) => (
                      <RadioRow
                        key={tg}
                        label={t(`transactions.reimbursement.target.${tg}`)}
                        selected={form.reimbursementTarget === tg}
                        onPress={() => form.setReimbursementTarget(tg)}
                      />
                    ))}
                  </View>
                </View>
              )}

              {/* Credit-to account (cash/bank) */}
              {(!isCredit || form.reimbursementTarget === 'account') && (
                <AccountSelectField
                  label={t('transactions.reimbursement.credit_to')}
                  accounts={form.cashBankAccounts}
                  selectedId={form.reimbursementAccountId}
                  onSelect={form.setReimbursementAccountId}
                />
              )}

              {/* Received now */}
              <View className="flex-row items-center justify-between">
                <Text className="flex-1 pr-3 text-sm text-text">
                  {t('transactions.reimbursement.received_now')}
                </Text>
                <Switch
                  ariaLabel={t('transactions.reimbursement.received_now')}
                  checked={form.reimbursementReceivedNow}
                  onValueChange={form.setReimbursementReceivedNow}
                />
              </View>
              <Text className="text-xs text-text-muted">
                {form.reimbursementReceivedNow
                  ? t('transactions.reimbursement.received_now_hint')
                  : t('transactions.reimbursement.pending_hint')}
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Shared split (expense, 2-member household) */}
      {showShared && members && (
        <View className="flex-col gap-3 rounded-xl border border-border bg-card p-4">
          <View className="flex-row items-center justify-between">
            <Text className="text-sm font-semibold text-text">
              {t('transactions.form.shared_toggle')}
            </Text>
            <Switch
              ariaLabel={t('transactions.form.shared_toggle')}
              checked={form.sharedEnabled}
              onValueChange={form.setSharedEnabled}
            />
          </View>
          {form.sharedEnabled && (
            <View className="flex-col gap-2">
              <Segmented
                ariaLabel={t('transactions.form.split_label')}
                value={String(form.splitFirstPct)}
                onValueChange={(v) => form.setSplitFirstPct(Number(v))}
                options={[
                  { value: '100', label: t('transactions.form.split_you') },
                  { value: '50', label: t('transactions.form.split_even') },
                  {
                    value: '0',
                    label: t('transactions.form.split_other', {
                      name: members[1].fullName,
                    }),
                  },
                ]}
              />
              <Text className="text-xs text-text-muted">
                {t('transactions.form.your_share', { pct: form.splitFirstPct })}
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Recurrence ("Repetir") — gasto (no cuotas) / ingreso / transferencia */}
      {showRepeat && (
        <View className="flex-col gap-3 rounded-xl border border-border bg-card p-4">
          <View className="flex-row items-center justify-between">
            <View className="flex-1 pr-3">
              <Text className="text-sm font-semibold text-text">
                {t('transactions.labels.make_recurrent')}
              </Text>
              <Text className="text-xs text-text-muted">
                {t('transactions.drawer.repeat_note')}
              </Text>
            </View>
            <Switch
              ariaLabel={t('transactions.labels.make_recurrent')}
              checked={form.isRecurrent}
              onValueChange={form.setIsRecurrent}
            />
          </View>
          {form.isRecurrent && (
            <View className="flex-col gap-3 border-t border-border-soft pt-3">
              <View className="rounded-lg bg-emerald-soft p-3">
                <Text className="text-xs text-text">{t('transactions.drawer.repeat_hint')}</Text>
              </View>
              <Text className="text-xs font-semibold text-text-muted">
                {t('transactions.drawer.repeat_question')}
              </Text>
              <View className="flex-row flex-wrap gap-2">
                {FREQUENCIES.map((f) => {
                  const active = form.frequency === f
                  return (
                    <Pressable
                      key={f}
                      onPress={() => form.setFrequency(f)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      className={`rounded-lg px-3.5 py-2 ${active ? 'bg-navy' : 'bg-border-soft'}`}
                    >
                      <Text
                        className={`text-sm font-bold ${active ? 'text-white' : 'text-text-muted'}`}
                      >
                        {t(`transactions.frequencies.${f}`)}
                      </Text>
                    </Pressable>
                  )
                })}
              </View>

              {/* Custom interval: count + unit chips */}
              {form.frequency === 'custom' && (
                <View className="flex-col gap-2">
                  <View className="flex-row items-center gap-2">
                    <Text className="text-xs text-text-muted">
                      {t('recurrences.custom_interval.every')}
                    </Text>
                    <Input
                      value={String(form.intervalCount)}
                      onChangeText={(v) => {
                        const digits = v.replace(/\D/g, '')
                        form.setIntervalCount(digits === '' ? 1 : Math.max(1, parseInt(digits)))
                      }}
                      keyboardType="number-pad"
                      accessibilityLabel={t('recurrences.custom_interval.every')}
                      className="w-16 text-center"
                    />
                  </View>
                  <View className="flex-row flex-wrap gap-2">
                    {INTERVAL_UNITS.map((u) => {
                      const active = form.intervalUnit === u
                      return (
                        <Pressable
                          key={u}
                          onPress={() => form.setIntervalUnit(u)}
                          accessibilityRole="button"
                          accessibilityState={{ selected: active }}
                          className={`rounded-lg px-3.5 py-2 ${active ? 'bg-navy' : 'bg-border-soft'}`}
                        >
                          <Text
                            className={`text-sm font-bold ${active ? 'text-white' : 'text-text-muted'}`}
                          >
                            {t(`recurrences.custom_interval.units.${u}`, {
                              count: form.intervalCount,
                            })}
                          </Text>
                        </Pressable>
                      )
                    })}
                  </View>
                </View>
              )}

              {/* Optional end date */}
              <View className="flex-col gap-1.5">
                <Label>{t('transactions.drawer.repeat_until')}</Label>
                <DateField
                  value={form.recurrenceEndDate}
                  onChange={form.setRecurrenceEndDate}
                  placeholder={t('common.pick_date')}
                />
              </View>
            </View>
          )}
        </View>
      )}

      {form.formError && <FormError message={form.formError} />}

      {/* Submit */}
      <Pressable
        onPress={form.onSubmit}
        disabled={form.isSubmitting}
        accessibilityRole="button"
        accessibilityState={{ disabled: form.isSubmitting }}
        className={`mt-1 h-14 flex-row items-center justify-center rounded-2xl bg-emerald ${
          form.isSubmitting ? 'opacity-60' : ''
        }`}
      >
        {form.isSubmitting ? (
          <View className="flex-row items-center gap-2">
            <Spinner size="sm" color={colors.white} />
            <Text className="text-base font-bold text-white">{t('common.saving')}</Text>
          </View>
        ) : (
          <Text className="text-base font-bold text-white">
            {isEdit
              ? t('common.save_changes')
              : form.isInstallments
                ? t('transactions.actions.register_installments', { count: installmentsNum })
                : t('transactions.form.submit')}
          </Text>
        )}
      </Pressable>
    </View>
  )
}

// A bordered radio card — emerald border + ✓ when selected. Used only for the
// reimbursement target (two options with long explanatory labels).
function RadioRow({
  label,
  selected,
  onPress,
}: {
  label: string
  selected: boolean
  onPress: () => void
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      className={`flex-row items-center justify-between rounded-xl border-2 bg-card px-3 py-2 ${
        selected ? 'border-emerald' : 'border-border'
      }`}
    >
      <Text className="flex-1 pr-2 text-sm font-semibold text-text">{label}</Text>
      {selected && <Text className="text-emerald">✓</Text>}
    </Pressable>
  )
}

