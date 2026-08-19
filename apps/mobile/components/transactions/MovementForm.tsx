import { Children, useMemo, useState, type ReactNode } from 'react'
import { Pressable, Text, View } from 'react-native'
import { ChevronDown, ChevronLeft, Undo2, Users, Repeat, Check } from 'lucide-react-native'
import { getTodayAR, formatDateISO } from '@grana/money-logic'
import { Money, parseMoneyInput, formatForDisplay } from '@grana/validation'
import {
  useMovementForm,
  PRIMARY_TABS,
  type CategoryWithSubcategories,
  type Frequency,
  type FrequentClassification,
  type Household,
  type IntervalUnit,
  type MovementEditContext,
  type MovementFormAccount,
} from '@grana/movement-form'
import { Label } from '../ui/Label'
import { Input } from '../ui/Input'
import { MoneyAmountInput } from '../ui/MoneyAmountInput'
import { MoneyCalculator } from '../ui/MoneyCalculator'
import { DateField } from '../ui/DateField'
import { Segmented } from '../ui/Segmented'
import { FormError } from '../ui/FormError'
import { Spinner } from '../ui/Spinner'
import { AccountSelectField, AccountFamilySelect, CategorySelectField } from './form-pickers'
import { SelectSheet } from '../ui/SelectSheet'
import { SheetRow } from '../ui/SelectField'
import { colors } from '../../lib/colors'
import { useT, useLocale } from '../../lib/locale-context'
import { formatShortDate } from './detail/format'
import { createMovementMutators } from '../../lib/transactions/mutators'
import { invalidateAfterMovementMutation } from '../../lib/transactions/invalidate'
import { useQueryClient } from '@tanstack/react-query'

// Tabs: only Gasto/Ingreso are primary; the rest live behind "Otros" (design
// D1). `PRIMARY_TABS` comes from the hook; `form.secondaryTabs` are the ones
// eligible from the user's accounts.

// Recurrence frequency chips + custom-interval units, mirror of the web form.
// Mobile hides "annual" and the "year" unit (the model still supports them; a
// yearly recurrence is created as "cada 12 meses"). See docs/design/movement-form/recurrente.
const FREQUENCIES: Frequency[] = ['weekly', 'biweekly', 'monthly', 'custom']
const INTERVAL_UNITS: IntervalUnit[] = ['day', 'week', 'month']

// The common counts as one-tap chips; anything else via the stepper. Local
// presentation mirror of the web form's constants (component-local there too).
const INSTALLMENT_OPTIONS = [1, 3, 6, 12]
const MAX_INSTALLMENTS = 60

const CURRENCY_SYMBOL: Record<'ARS' | 'USD', string> = { ARS: '$', USD: 'U$D' }

const fmtAmount = (n: number) =>
  n.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })

// Groups the secondary fields (frequent chips, category, account, destination,
// cuotas, date) into one bordered card with hairline dividers between rows —
// native counterpart of web's mobile `fieldGroup`. Falsy children (gated-off
// rows) are dropped, and dividers are inserted only between the rows that render.
function GroupCard({ children }: { children: ReactNode }) {
  const rows = Children.toArray(children).filter(Boolean)
  if (rows.length === 0) return null
  return (
    <View className="overflow-hidden rounded-2xl border border-border bg-card">
      {rows.map((row, i) => (
        <View key={i}>
          {i > 0 && <View className="h-px bg-border-soft" />}
          {row}
        </View>
      ))}
    </View>
  )
}

type Props = {
  accounts: MovementFormAccount[]
  categories: CategoryWithSubcategories[]
  /** Frequent leaf classifications (create-only accelerator, #31 item 1). */
  frequentClassifications?: FrequentClassification[]
  household: Household | null
  /** Present ⇒ the form is in edit mode (tabs hidden, fields gated). */
  edit?: MovementEditContext
  /** Preselect this account/card on a fresh create form (e.g. register-first-purchase). */
  preselectAccountId?: string
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
export function MovementForm({
  accounts,
  categories,
  frequentClassifications,
  household,
  edit,
  preselectAccountId,
  onDone,
}: Props) {
  const t = useT()
  const locale = useLocale()
  const queryClient = useQueryClient()
  const mutators = useMemo(() => createMovementMutators(t), [t])

  const form = useMovementForm({
    mutators,
    accounts,
    categories,
    frequentClassifications,
    edit,
    preselectAccountId,
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
  // "Otros" sheet: reveals the eligible secondary types (transfer/ajuste/cambio).
  const [otrosOpen, setOtrosOpen] = useState(false)
  // Split "Otro" editor: row 1 shortcuts are replaced by two % fields.
  const [splitOtherMode, setSplitOtherMode] = useState(false)
  const [splitDraft, setSplitDraft] = useState<string | null>(null)

  // Quick-date chips: Hoy / Ayer cover the ~95% of cases without the calendar.
  const todayStr = formatDateISO(getTodayAR())
  const yesterdayStr = (() => {
    const d = getTodayAR()
    d.setDate(d.getDate() - 1)
    return formatDateISO(d)
  })()

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
  // Nothing to save yet: in edit the CTA waits for a real change.
  const submitDisabled = form.isSubmitting || (isEdit && !form.isDirty)
  // Source account: immutable context in edit, EXCEPT a statement payment whose
  // debit account can move (`editable.account`). In create, hide the selector
  // when there is a single eligible account (D2) — but transfer/exchange always
  // show it (they need to pick among ≥2 accounts by their own semantics).
  const singleAccountHides = form.tab !== 'transfer' && form.tab !== 'exchange'
  const showSourceAccount = isEdit
    ? !!editable?.account
    : singleAccountHides
      ? form.showAccountSelector
      : true
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
    // Same-bank card and account can have different institution ids but the
    // same name, so fall back to name before defaulting to the first cash/bank.
    const instName = expenseAccount?.institutionName?.trim().toLowerCase() || null
    const banks = accounts.filter((a) => a.type !== 'credit')
    const match =
      (inst ? banks.find((a) => a.institutionId === inst) : undefined) ??
      (instName
        ? banks.find((a) => (a.institutionName?.trim().toLowerCase() ?? '') === instName)
        : undefined)
    return match?.id ?? banks[0]?.id ?? ''
  }

  // Reimbursement account list ordered "same bank first" (institution of the
  // payment method) + cap-applied flag, for the compact 2-row block (parity
  // with mobile-web).
  const reimbInstitutionId = form.selectedAccount?.institutionId ?? null
  const reimbInstitutionName = form.selectedAccount?.institutionName?.trim().toLowerCase() || null
  const isSameReimbEntity = (a: MovementFormAccount): boolean =>
    (reimbInstitutionId != null && a.institutionId === reimbInstitutionId) ||
    (reimbInstitutionName != null &&
      (a.institutionName?.trim().toLowerCase() ?? '') === reimbInstitutionName)
  const reimbAccountsOrdered = [...form.cashBankAccounts].sort(
    (a, b) => (isSameReimbEntity(a) ? 0 : 1) - (isSameReimbEntity(b) ? 0 : 1),
  )
  const reimbDigits = (s: string): string => s.replace(/\D/g, '')
  const reimbCapApplied =
    Number(reimbDigits(form.reimbursementPercent)) > 0 &&
    reimbDigits(form.reimbursementCap) !== '' &&
    reimbDigits(form.reimbursementCap) !== '0' &&
    reimbDigits(form.reimbursementAmount) === reimbDigits(form.reimbursementCap)

  // Format an ISO end date for the recurrence summary line ("31 dic 2026").
  const fmtEndDate = (iso: string): string => {
    const parts = iso.split('-')
    if (parts.length !== 3) return iso
    return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2])).toLocaleDateString(
      'es-AR',
      { day: '2-digit', month: 'short', year: 'numeric' },
    )
  }

  // Immutable context in edit mode: labelled rows, but ONLY for what is not
  // visible anywhere else on the screen. The type reads off the amount's sign and
  // colour, the currency is the hero's chip, and the amount is the hero itself —
  // restating them cost half a screen of rows the user cannot act on, above the
  // fields they came to change. What survives is genuinely only here: the account
  // (or the two ends of a transfer), the installment count of a parent purchase,
  // and the date when `getEditableFields` locks it. Mirror of web's `contextRows`.
  const contextRows: { label: string; value: string }[] =
    isEdit && edit
      ? [
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
          ...(edit.isParent && edit.installmentsTotal
            ? [
                {
                  label: t('transactions.labels.installments'),
                  value: t('transactions.installments_count', { count: edit.installmentsTotal }),
                },
              ]
            : []),
          ...(showDate
            ? []
            : [{ label: t('transactions.labels.date'), value: formatShortDate(form.date, locale) }]),
        ]
      : []

  // ── Amount hero derivations (mirror of web's movement-form hero) ────────────
  const amountColorClass = form.tab === 'income' ? 'text-emerald-deep' : 'text-text'
  const signChar =
    form.tab === 'income'
      ? '+'
      : form.tab === 'expense'
        ? '−'
        : form.tab === 'adjustment'
          ? form.adjustmentDirection === 'decrease'
            ? '−'
            : '+'
          : ''
  // Cycle the currency chip through the eligible options (create only has >1).
  const cycleCurrency = () => {
    if (form.currencyOptions.length < 2) return
    const idx = form.currencyOptions.indexOf(form.currencyCode)
    const next = form.currencyOptions[(idx + 1) % form.currencyOptions.length]
    form.setCurrencyCode(next as 'ARS' | 'USD')
    form.setInstallments('1')
  }
  // Content-sized width for the centered amount input (RN has no `ch` unit): hug
  // the GROUPED text (with thousands dots) so sign + symbol + number stay
  // centered as a group (~20px/glyph).
  const amountInputWidth = Math.max(1, formatForDisplay(form.amount).length) * 20 + 2

  return (
    <View className="flex-col gap-5">
      {/* Tab selector — two-row wrapping pill group (see design 1b). Hidden in
          edit mode: the type is immutable (shown as a context row). */}
      {!isEdit && (
        <View
          accessibilityRole="radiogroup"
          accessibilityLabel={t('transactions.form.type_label')}
          className="flex-row gap-1.5 rounded-xl bg-border-soft p-1"
        >
          {PRIMARY_TABS.map((tab) => {
            const active = form.tab === tab
            return (
              <Pressable
                key={tab}
                onPress={() => form.setTab(tab)}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                className={`flex-1 items-center rounded-lg px-3.5 py-1.5 ${active ? 'bg-card' : ''}`}
              >
                <Text className={`text-sm font-bold ${active ? 'text-text' : 'text-text-muted'}`}>
                  {t(`transactions.types.${tab}`)}
                </Text>
              </Pressable>
            )
          })}
          {form.secondaryTabs.length > 0 && (
            <Pressable
              onPress={() => setOtrosOpen(true)}
              accessibilityRole="button"
              accessibilityState={{ selected: form.isSecondaryTab }}
              className={`flex-1 flex-row items-center justify-center gap-1 rounded-lg px-3 py-1.5 ${
                form.isSecondaryTab ? 'bg-card' : ''
              }`}
            >
              <Text
                className={`text-sm font-bold ${form.isSecondaryTab ? 'text-text' : 'text-text-muted'}`}
              >
                {form.isSecondaryTab
                  ? t(`transactions.types.${form.tab}`)
                  : t('transactions.form.other_types')}
              </Text>
              <ChevronDown size={13} color={form.isSecondaryTab ? colors.text : colors.textMuted} />
            </Pressable>
          )}
        </View>
      )}

      {/* "Otros" sheet: eligible secondary types */}
      {!isEdit && (
        <SelectSheet
          visible={otrosOpen}
          onClose={() => setOtrosOpen(false)}
          title={t('transactions.form.other_types')}
          items={form.secondaryTabs}
          keyExtractor={(tab) => tab}
          renderRow={(tab) => (
            <SheetRow
              primary={t(`transactions.types.${tab}`)}
              selected={form.tab === tab}
              onPress={() => {
                form.setTab(tab)
                setOtrosOpen(false)
              }}
            />
          )}
        />
      )}

      {/* Locked amount (a paid card consumption, an installment parent with a paid
          cuota): the same card, read-only — no input, no calculator, currency as a
          static chip. Mirror of web's locked hero. */}
      {isEdit && !showAmount && (
        <View className="rounded-2xl border border-border bg-card px-4 pb-4 pt-3.5">
          <View className="flex-row items-start justify-between">
            <Text className="text-[11px] font-bold uppercase tracking-wider text-text-soft">
              {t('transactions.form.amount_label')}
            </Text>
            <View className="rounded-lg border border-border bg-border-soft px-2.5 py-1">
              <Text className="text-xs font-bold text-text">{form.currencyCode}</Text>
            </View>
          </View>
          <View className="mt-2 flex-row items-center justify-center">
            {signChar !== '' && (
              <Text className={`text-[34px] font-bold ${amountColorClass}`}>{signChar}</Text>
            )}
            <Text className={`pl-1 text-[34px] font-bold ${amountColorClass}`}>
              {CURRENCY_SYMBOL[form.currencyCode]}
            </Text>
            <Text className={`ml-1 text-[34px] font-bold ${amountColorClass}`}>
              {formatForDisplay(form.amount)}
            </Text>
          </View>
          <Text className="mt-2 text-center text-[12px] text-text-soft">
            {t('common.not_editable')}
          </Text>
        </View>
      )}

      {/* Amount hero — big centered number, faded currency glyph, currency chip,
          and a calculator trigger beneath the chip. Mirror of web's hero. */}
      {showAmount && (
        <View className="rounded-2xl border border-border bg-card px-4 pb-4 pt-3.5">
          {/* Eyebrow top-left and chip+calculator pinned top-right (both absolute,
              so they don't drag the number down); the number is centered inside a
              min-height so it has room above and below, not on the bottom border. */}
          <View className="relative">
            <Text className="absolute left-0 top-0 text-[11px] font-bold uppercase tracking-wider text-text-soft">
              {t('transactions.form.amount_label')}
            </Text>
            <View className="absolute right-0 top-0 items-end gap-1.5">
              <Pressable
                onPress={cycleCurrency}
                disabled={form.currencyOptions.length < 2}
                accessibilityRole="button"
                accessibilityLabel={t('transactions.form.currency_label')}
                className="flex-row items-center gap-1 rounded-lg border border-border bg-border-soft px-2.5 py-1"
              >
                <Text className="text-xs font-bold text-text">{form.currencyCode}</Text>
                {form.currencyOptions.length > 1 && (
                  <ChevronDown size={12} color={colors.text} />
                )}
              </Pressable>
              <MoneyCalculator seed={form.amount} onResult={form.setAmount} />
            </View>
            <View className="min-h-[72px] flex-row items-center justify-center">
              {signChar !== '' && (
                <Text className={`text-[34px] font-bold ${amountColorClass}`}>{signChar}</Text>
              )}
              <Text className={`pl-1 text-[34px] font-bold ${amountColorClass}`}>
                {CURRENCY_SYMBOL[form.currencyCode]}
              </Text>
              <MoneyAmountInput
                bare
                value={form.amount}
                onChangeText={form.setAmount}
                placeholder="0"
                autoFocus={!isEdit}
                style={{ width: amountInputWidth, paddingVertical: 0 }}
                className={`ml-1 text-[34px] font-bold ${amountColorClass}`}
              />
            </View>
          </View>
          {isEdit && edit?.isParent && (
            <Text className="pt-2 text-center text-xs text-text-muted">
              {t('transactions.installment_recalc_hint', {
                count: edit.installmentsTotal ?? 0,
              })}
            </Text>
          )}
          {form.tab === 'income' && (
            <Text className="mt-2 text-center text-[12.5px] font-medium text-emerald-deep">
              {t('transactions.drawer.helper_income')}
            </Text>
          )}
          {form.tab === 'adjustment' && (
            <Text className="mt-2 text-center text-[12.5px] text-text-muted">
              {t('transactions.drawer.helper_adjustment')}
            </Text>
          )}
        </View>
      )}

      {/* Immutable context (edit): the few facts that live nowhere else, as
          label/value rows with a "no editable" caption. Mirror of web's card. */}
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

      {/* Adjustment direction (Suma / Resta) + informative banner — before the
          grouped card (mirror of web's adjustmentSign/banner ahead of fieldGroup). */}
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

      {/* Secondary fields grouped into one bordered card with hairline dividers
          (mirror of web's mobile fieldGroup): frequent chips → category → account
          → destination → cuotas → date. Adjustment renders above, exchange-received
          and description below. */}
      <GroupCard>
        {/* Frequent-classification chips (#31 item 1): one tap pre-fills the
            category (+ subcategory). Create-only; empty otherwise. */}
        {form.frequentChips.length > 0 && (
          <View className="flex-row flex-wrap gap-2 px-4 py-3">
            {form.frequentChips.map((chip) => (
            <Pressable
              key={`${chip.categoryId}:${chip.subcategoryId ?? ''}`}
              onPress={() => form.pickCategory(chip.categoryId, chip.subcategoryId ?? '')}
              accessibilityRole="button"
              accessibilityState={{ selected: chip.active }}
              className={`rounded-full px-3 py-2 ${chip.active ? 'bg-navy' : 'bg-border-soft'}`}
            >
              <Text
                className={`text-xs font-semibold ${chip.active ? 'text-white' : 'text-text'}`}
              >
                {chip.icon ? `${chip.icon} ` : ''}
                {chip.label}
              </Text>
            </Pressable>
          ))}
        </View>
      )}

        {/* Category — slim "pick other" trigger inside the card (grouped). */}
        {showCategory && (
          <CategorySelectField
            grouped
            categories={form.transactionCategories}
            categoryId={form.categoryId}
            subcategoryId={form.subcategoryId}
            onPick={form.pickCategory}
            selectionIsActiveChip={form.frequentChips.some((c) => c.active)}
          />
        )}

        {/* Source account (grouped row). Immutable context in edit, except a
            statement payment whose debit account can move (`editable.account`). */}
        {showSourceAccount &&
          (isEdit ? (
            <AccountSelectField
              grouped
              label={t('transactions.form.account_label')}
              accounts={form.eligibleAccounts}
              selectedId={form.accountId}
              onSelect={form.setAccountId}
            />
          ) : (
            <AccountFamilySelect
              grouped
              label={
                showAdjustment
                  ? t('transactions.drawer.account_to_adjust')
                  : t('transactions.form.account_label')
              }
              accounts={form.eligibleAccounts}
              selectedId={form.accountId}
              onSelect={form.setAccountId}
            />
          ))}

        {/* Installments — borderless cuotas row inside the grouped card. */}
        {showInstallmentsCard && (
          <View className="flex-col gap-3 px-4 py-3">
          {form.currencyCode === 'ARS' ? (
            <>
              {/* Label inline with the chips — one row to save space. */}
              <View className="flex-row flex-wrap items-center gap-2">
                <Text className="mr-0.5 text-sm font-semibold text-text">
                  {t('transactions.labels.installments')}
                </Text>
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
                <View className="flex-col items-center gap-0.5">
                  <View className="flex-row items-center gap-2">
                    <Pressable
                      onPress={() => stepInstallments(-1)}
                      disabled={installmentsNum <= 1}
                      accessibilityRole="button"
                      accessibilityLabel={t('transactions.installments_options.custom_decrease')}
                      className={`h-8 w-8 items-center justify-center rounded-lg border border-border bg-border-soft ${
                        installmentsNum <= 1 ? 'opacity-40' : ''
                      }`}
                    >
                      <Text className="text-base font-bold text-navy">−</Text>
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
                      className="w-14 text-center text-lg font-bold text-navy"
                    />
                    <Pressable
                      onPress={() => stepInstallments(1)}
                      disabled={installmentsNum >= MAX_INSTALLMENTS}
                      accessibilityRole="button"
                      accessibilityLabel={t('transactions.installments_options.custom_increase')}
                      className={`h-8 w-8 items-center justify-center rounded-lg border border-border bg-border-soft ${
                        installmentsNum >= MAX_INSTALLMENTS ? 'opacity-40' : ''
                      }`}
                    >
                      <Text className="text-base font-bold text-navy">+</Text>
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
            <View className="flex-col gap-1">
              <Text className="text-sm font-semibold text-text">
                {t('transactions.labels.installments')}
              </Text>
              <Text className="text-xs text-text-muted">
                {t('transactions.installments_options.ars_only_hint')}
              </Text>
            </View>
          )}
        </View>
      )}

        {/* Destination account (transfer / exchange) — grouped row. */}
        {form.tab === 'transfer' && showDestinationAccount && (
          <AccountSelectField
            grouped
            label={t('transactions.form.destination_label')}
            accounts={form.otherAccounts}
            selectedId={form.destinationAccountId}
            onSelect={form.setDestinationAccountId}
          />
        )}
        {showExchange && showDestinationAccount && (
          <AccountSelectField
            grouped
            label={t('transactions.drawer.account_toward')}
            accounts={form.cashBankAccounts}
            selectedId={form.destinationAccountId}
            onSelect={form.setDestinationAccountId}
          />
        )}

        {/* Date — calendar trigger (bare) + Hoy/Ayer chips (grouped row).
            `DateField` presents its picker over the layout, so opening it leaves
            this row (and the chips) exactly where they are. */}
        {showDate && (
          <View className="flex-row items-center justify-between gap-3 px-4 py-3">
            <DateField bare value={form.date} onChange={form.setDate} />
            <View className="flex-row items-center gap-1.5">
              {(
                [
                  { key: 'today', label: t('transactions.form.date_today'), value: todayStr },
                  {
                    key: 'yesterday',
                    label: t('transactions.form.date_yesterday'),
                    value: yesterdayStr,
                  },
                ] as const
              ).map((opt) => {
                const active = form.date === opt.value
                return (
                  <Pressable
                    key={opt.key}
                    onPress={() => form.setDate(opt.value)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    className={`rounded-lg px-2.5 py-1.5 ${
                      active ? 'bg-navy' : 'border border-border'
                    }`}
                  >
                    <Text
                      className={`text-xs font-bold ${active ? 'text-white' : 'text-text-muted'}`}
                    >
                      {opt.label}
                    </Text>
                  </Pressable>
                )
              })}
            </View>
          </View>
        )}
      </GroupCard>

      {/* Exchange: received amount + implicit rate — after the grouped card (it's
          a mini amount hero, not a row). */}
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

      {/* Advanced (Capa 1, design D9): symbol-forward chips that activate each
          section directly (0 tap for the simple path). The section's params
          appear below when its chip is on. Contextual set. */}
      {(showReimbursement || (showShared && members) || showRepeat) && (
        <View className="flex-row flex-wrap gap-2">
          {showReimbursement && (
            <AdvChip
              renderIcon={(c) => <Undo2 size={15} color={c} />}
              label={t('transactions.reimbursement.chip')}
              active={form.reimbursementEnabled}
              disabled={form.reimbursementReadOnly}
              onPress={() => {
                const on = !form.reimbursementEnabled
                form.setReimbursementEnabled(on)
                if (on) form.setReimbursementAccountId(pickReimbursementAccount(form.accountId))
              }}
            />
          )}
          {showShared && members && (
            <AdvChip
              renderIcon={(c) => <Users size={15} color={c} />}
              label={t('transactions.form.shared_toggle')}
              active={form.sharedEnabled}
              onPress={() => form.setSharedEnabled(!form.sharedEnabled)}
            />
          )}
          {showRepeat && (
            <AdvChip
              renderIcon={(c) => <Repeat size={15} color={c} />}
              label={t('transactions.labels.recurrent')}
              active={form.isRecurrent}
              onPress={() => form.setIsRecurrent(!form.isRecurrent)}
            />
          )}
        </View>
      )}

      {/* Reimbursement params (shown when its chip is on, or a read-only summary
          for an already received/cancelled one in edit). */}
      {showReimbursement && (form.reimbursementEnabled || form.reimbursementReadOnly) && (
        <View className="flex-col gap-3 rounded-xl border border-border bg-card p-4">
          {/* Received/cancelled reintegro: read-only summary (target + amount),
              managed from its own confirm/cancel flow. */}
          {form.reimbursementReadOnly && edit?.reimbursement && (
            <View className="flex-row items-center justify-between gap-3">
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
            <View className="flex-col gap-2">
              {/* Fila 1 — monto + regla % / tope (visible inline, sin disclosure) */}
              <View className="flex-row gap-2">
                <View className="flex-row items-center gap-1 rounded-lg border border-border bg-card px-3 py-2">
                  <Text className="text-sm text-text-soft">{CURRENCY_SYMBOL[form.currencyCode]}</Text>
                  <MoneyAmountInput
                    bare
                    value={form.reimbursementAmount}
                    onChangeText={(v) => {
                      form.setReimbursementAmount(v)
                      form.setReimbursementPercent('')
                    }}
                    placeholder="0"
                    className="w-24 text-sm text-text"
                  />
                </View>
                <View className="flex-1 flex-row items-center justify-between gap-2 rounded-lg border border-border bg-card px-3 py-2">
                  <View className="flex-row items-center gap-0.5">
                    <Input
                      bare
                      value={form.reimbursementPercent}
                      onChangeText={(v) => {
                        const norm = v.replace(',', '.')
                        form.setReimbursementPercent(norm)
                        form.applyReimbursementPercent(norm, form.reimbursementCap)
                      }}
                      keyboardType="decimal-pad"
                      placeholder="—"
                      className="w-9 text-right text-sm text-text"
                    />
                    <Text className="text-sm text-text-muted">%</Text>
                  </View>
                  <View className="flex-row items-center gap-1">
                    <Text
                      className={
                        reimbCapApplied
                          ? 'text-xs font-semibold text-emerald-deep'
                          : 'text-xs text-text-soft'
                      }
                    >
                      {t('transactions.reimbursement.cap_short')} {CURRENCY_SYMBOL[form.currencyCode]}
                    </Text>
                    <MoneyAmountInput
                      bare
                      value={form.reimbursementCap}
                      onChangeText={(v) => {
                        form.setReimbursementCap(v)
                        form.applyReimbursementPercent(form.reimbursementPercent, v)
                      }}
                      placeholder="—"
                      className="w-16 text-sm text-text"
                    />
                  </View>
                </View>
              </View>

              {/* Destino (crédito): Resumen | Cuenta. El default lo fija el hook. */}
              {isCredit && (
                <Segmented
                  ariaLabel={t('transactions.reimbursement.target_label')}
                  value={form.reimbursementTarget}
                  onValueChange={(v) =>
                    form.setReimbursementTarget(v as 'account' | 'statement')
                  }
                  options={[
                    { value: 'statement', label: t('transactions.reimbursement.target.statement_short') },
                    { value: 'account', label: t('transactions.reimbursement.target.account_short') },
                  ]}
                />
              )}

              {/* Cuenta de acreditación — mismo banco primero; oculta si hay una sola */}
              {(!isCredit || form.reimbursementTarget === 'account') &&
                form.cashBankAccounts.length > 1 && (
                  <AccountSelectField
                    label={t('transactions.reimbursement.credit_to')}
                    accounts={reimbAccountsOrdered}
                    selectedId={form.reimbursementAccountId}
                    onSelect={form.setReimbursementAccountId}
                  />
                )}

              {/* Estado — Acreditado (checkbox; off = pendiente, sin chip) */}
              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked: form.reimbursementReceivedNow }}
                onPress={() => form.setReimbursementReceivedNow(!form.reimbursementReceivedNow)}
                className="flex-row items-center gap-2"
              >
                <View
                  className={
                    form.reimbursementReceivedNow
                      ? 'h-5 w-5 items-center justify-center rounded-md bg-emerald'
                      : 'h-5 w-5 items-center justify-center rounded-md border border-border'
                  }
                >
                  {form.reimbursementReceivedNow && <Check size={12} color="#fff" strokeWidth={3.2} />}
                </View>
                <Text
                  className={
                    form.reimbursementReceivedNow
                      ? 'text-sm font-semibold text-emerald-deep'
                      : 'text-sm text-text-muted'
                  }
                >
                  {t('transactions.reimbursement.received_short')}
                </Text>
              </Pressable>
            </View>
          )}
        </View>
      )}

      {/* Shared split params (shown when its chip is on) */}
      {showShared && members && form.sharedEnabled && (
        <View className="flex-col gap-2 rounded-xl border border-border bg-card p-4">
          {/* Fila 1 — atajos (o los dos campos % en modo "Otro") */}
          {splitOtherMode ? (
            <View className="flex-row items-center gap-1.5">
              <Pressable
                onPress={() => {
                  setSplitOtherMode(false)
                  setSplitDraft(null)
                }}
                accessibilityRole="button"
                accessibilityLabel={t('common.back')}
                className="h-6 w-6 items-center justify-center"
              >
                <ChevronLeft size={16} color="#8A94A3" />
              </Pressable>
              <Text className="text-xs text-text-soft">{t('shared.split.you')}</Text>
              <View
                className="min-w-[56px] flex-row items-center justify-between rounded-lg border border-border bg-card px-2"
                style={{ height: 32 }}
              >
                <Input
                  bare
                  value={splitDraft ?? String(form.splitFirstPct)}
                  onChangeText={(v) => {
                    const raw = v.replace(/\D/g, '').slice(0, 2)
                    setSplitDraft(raw)
                    if (raw !== '')
                      form.setSplitFirstPct(Math.max(0, Math.min(99, parseInt(raw, 10))))
                  }}
                  onBlur={() => setSplitDraft(null)}
                  keyboardType="number-pad"
                  accessibilityLabel={members[0].fullName}
                  className="w-8 text-sm font-semibold text-text"
                />
                <Text className="text-xs text-text-muted">%</Text>
              </View>
              <Text className="ml-auto text-xs text-text-soft" numberOfLines={1}>
                {members[1].fullName}
              </Text>
              <View
                className="min-w-[56px] flex-row items-center justify-between rounded-lg bg-border-soft px-2"
                style={{ height: 32 }}
              >
                <Text className="text-sm font-semibold text-text-muted">
                  {100 - (splitDraft === '' ? 0 : form.splitFirstPct)}
                </Text>
                <Text className="text-xs text-text-muted">%</Text>
              </View>
            </View>
          ) : (
            <View className="flex-row flex-wrap gap-1">
              {([['half', 50], ['70/30', 70], ['75/25', 75], ['all_other', 0]] as const).map(
                ([key, val]) => {
                  const active = form.splitFirstPct === val
                  const label =
                    key === 'half'
                      ? t('shared.split.half')
                      : key === 'all_other'
                        ? t('shared.split.all_other')
                        : key
                  return (
                    <Pressable
                      key={key}
                      onPress={() => {
                        setSplitOtherMode(false)
                        setSplitDraft(null)
                        form.setSplitFirstPct(val)
                      }}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      className={`rounded-full border px-2.5 py-1 ${
                        active ? 'border-emerald bg-emerald-soft' : 'border-border'
                      }`}
                    >
                      <Text
                        className={`text-xs ${
                          active ? 'font-semibold text-emerald-deep' : 'font-medium text-text-muted'
                        }`}
                      >
                        {label}
                      </Text>
                    </Pressable>
                  )
                },
              )}
              {(() => {
                const custom = ![50, 70, 75, 0].includes(form.splitFirstPct)
                return (
                  <Pressable
                    onPress={() => {
                      setSplitOtherMode(true)
                      setSplitDraft('')
                    }}
                    accessibilityRole="button"
                    accessibilityState={{ selected: custom }}
                    className={`rounded-full border px-2.5 py-1 ${
                      custom ? 'border-emerald bg-emerald-soft' : 'border-border'
                    }`}
                  >
                    <Text
                      className={`text-xs ${
                        custom ? 'font-semibold text-emerald-deep' : 'font-medium text-text-muted'
                      }`}
                    >
                      {custom ? `${form.splitFirstPct}%` : t('shared.split.other_short')}
                    </Text>
                  </Pressable>
                )
              })()}
            </View>
          )}

          {/* Fila 2 — barra de reparto Vos / otro integrante */}
          {splitOtherMode && splitDraft === '' ? (
            <View
              className="h-[26px] items-center justify-center rounded-lg bg-border-soft"
            >
              <Text className="text-[11px] text-text-soft">
                {t('shared.split.write_your_share')}
              </Text>
            </View>
          ) : form.splitFirstPct === 0 ? (
            <View
              className="h-[26px] flex-row items-center overflow-hidden rounded-lg px-2"
              style={{ backgroundColor: '#0E9E6E' }}
            >
              <Text numberOfLines={1} className="text-[11px] font-semibold text-white">
                {members[1].fullName} 100%
                {(() => {
                  const total = parseMoneyInput(form.amount)
                  return form.amount && total
                    ? ` — ${t('shared.split.owes')} ${CURRENCY_SYMBOL[form.currencyCode]}${fmtAmount(total)}`
                    : ''
                })()}
              </Text>
            </View>
          ) : (
            <View
              className="h-[26px] flex-row overflow-hidden rounded-lg"
              style={{ backgroundColor: '#F1F3F6' }}
            >
              <View
                className="h-full flex-row items-center gap-1 overflow-hidden px-2"
                style={{ width: `${form.splitFirstPct}%`, backgroundColor: '#3A6B8A' }}
              >
                <Text numberOfLines={1} className="text-[11px] font-semibold text-white" style={{ flexShrink: 1 }}>
                  {t('shared.split.you')}
                </Text>
                <Text className="text-[11px] font-semibold text-white">{form.splitFirstPct}%</Text>
              </View>
              <View
                className="h-full flex-row items-center justify-end gap-1 overflow-hidden px-2"
                style={{ width: `${100 - form.splitFirstPct}%`, backgroundColor: '#0E9E6E' }}
              >
                <Text numberOfLines={1} className="text-[11px] font-semibold text-white" style={{ flexShrink: 1 }}>
                  {members[1].fullName}
                </Text>
                <Text className="text-[11px] font-semibold text-white">
                  {100 - form.splitFirstPct}%
                </Text>
              </View>
            </View>
          )}
        </View>
      )}

      {/* Recurrence ("Repetir") params — gasto (no cuotas) / ingreso / transferencia */}
      {showRepeat && form.isRecurrent && (
        <View className="flex-col">
          <View className="flex-col gap-2 rounded-xl border border-border bg-card p-4">
            {/* Fila 1 — chips de frecuencia (sin Anual en mobile) */}
            <View className="flex-row flex-wrap gap-1.5">
              {FREQUENCIES.map((f) => {
                const active = form.frequency === f
                return (
                  <Pressable
                    key={f}
                    onPress={() => form.setFrequency(f)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    className={`rounded-full border px-2.5 py-1 ${
                      active ? 'border-emerald bg-emerald-soft' : 'border-border'
                    }`}
                  >
                    <Text
                      className={`text-xs ${
                        active ? 'font-semibold text-emerald-deep' : 'font-medium text-text-muted'
                      }`}
                    >
                      {t(`transactions.frequencies.${f}`)}
                    </Text>
                  </Pressable>
                )
              })}
            </View>

            {/* Fila 2 — "cada N unidad" (Personalizado) o "Repetir hasta" */}
            {form.frequency === 'custom' ? (
              <View className="flex-col gap-2">
                <View className="flex-row items-center gap-2">
                  <Text className="text-xs text-text-soft">
                    {t('recurrences.custom_interval.every').toLowerCase()}
                  </Text>
                  <View className="h-9 flex-row items-center overflow-hidden rounded-lg border border-border">
                    <Pressable
                      onPress={() => form.setIntervalCount(Math.max(1, form.intervalCount - 1))}
                      accessibilityLabel="−"
                      className="h-full w-8 items-center justify-center bg-border-soft"
                    >
                      <Text className="text-base font-semibold text-text-muted">−</Text>
                    </Pressable>
                    <Text className="min-w-[34px] text-center text-sm font-semibold text-text">
                      {form.intervalCount}
                    </Text>
                    <Pressable
                      onPress={() => form.setIntervalCount(form.intervalCount + 1)}
                      accessibilityLabel="+"
                      className="h-full w-8 items-center justify-center bg-border-soft"
                    >
                      <Text className="text-base font-semibold text-text-muted">+</Text>
                    </Pressable>
                  </View>
                  <View className="flex-1">
                    <Segmented
                      ariaLabel={t('recurrences.custom_interval.every')}
                      value={form.intervalUnit}
                      onValueChange={(v) => form.setIntervalUnit(v as IntervalUnit)}
                      options={INTERVAL_UNITS.map((u) => ({
                        value: u,
                        label: t(`recurrences.custom_interval.units_short.${u}`),
                      }))}
                    />
                  </View>
                </View>
                <View className="flex-row items-center justify-between gap-2">
                  <DateField
                    bare
                    value={form.recurrenceEndDate}
                    onChange={form.setRecurrenceEndDate}
                    placeholder={t('transactions.drawer.repeat_until_placeholder')}
                  />
                  {form.recurrenceEndDate !== '' && (
                    <Pressable onPress={() => form.setRecurrenceEndDate('')} accessibilityRole="button">
                      <Text className="text-xs font-medium text-text-muted">
                        {t('transactions.drawer.repeat_no_end')}
                      </Text>
                    </Pressable>
                  )}
                </View>
              </View>
            ) : (
              <View className="flex-row items-center justify-between gap-2">
                <View className="flex-1">
                  <DateField
                    value={form.recurrenceEndDate}
                    onChange={form.setRecurrenceEndDate}
                    placeholder={t('transactions.drawer.repeat_until_placeholder')}
                  />
                </View>
                {form.recurrenceEndDate !== '' && (
                  <Pressable onPress={() => form.setRecurrenceEndDate('')} accessibilityRole="button">
                    <Text className="text-xs font-medium text-text-muted">
                      {t('transactions.drawer.repeat_no_end')}
                    </Text>
                  </Pressable>
                )}
              </View>
            )}
          </View>

          {/* Línea de aviso fuera de la card (reemplaza el banner verde) */}
          <View className="px-1 pt-1.5">
            <Text className="text-xs text-text-soft">
              {form.frequency === 'custom'
                ? `${t('transactions.drawer.repeat_summary_prefix')} ${form.intervalCount} ${t(
                    `recurrences.custom_interval.units.${form.intervalUnit}`,
                    { count: form.intervalCount },
                  )}${
                    form.recurrenceEndDate
                      ? ` ${t('recurrences.until_template', { date: fmtEndDate(form.recurrenceEndDate) })}`
                      : t('transactions.drawer.repeat_summary_no_end')
                  }.`
                : t('transactions.drawer.repeat_reassure')}
            </Text>
          </View>
        </View>
      )}

      {form.formError && <FormError message={form.formError} />}

      {/* Submit. In edit the CTA stays disabled until something actually changed:
          "Guardar cambios" with nothing to save is a no-op that still fires the
          mutation, invalidates the cache and closes as if it had done something. */}
      <Pressable
        onPress={form.onSubmit}
        disabled={submitDisabled}
        accessibilityRole="button"
        accessibilityState={{ disabled: submitDisabled }}
        className={`mt-1 h-14 flex-row items-center justify-center rounded-2xl bg-emerald ${
          submitDisabled ? 'opacity-60' : ''
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

// A light, symbol-forward pill that activates an advanced section (reintegro /
// compartir / repetir). The icon leads; it fills emerald when on.
function AdvChip({
  renderIcon,
  label,
  active,
  disabled,
  onPress,
}: {
  renderIcon: (color: string) => ReactNode
  label: string
  active: boolean
  disabled?: boolean
  onPress: () => void
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ selected: active, disabled: !!disabled }}
      className={`flex-row items-center gap-1.5 rounded-full px-3 py-2 ${
        active ? 'bg-emerald-soft' : 'bg-border-soft'
      } ${disabled ? 'opacity-40' : ''}`}
    >
      {renderIcon(active ? colors.emeraldDeep : colors.textMuted)}
      <Text
        className={`text-xs font-semibold ${active ? 'text-emerald-deep' : 'text-text-muted'}`}
      >
        {label}
      </Text>
    </Pressable>
  )
}

