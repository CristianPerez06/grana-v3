import { useMemo, useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { getTodayAR } from '@grana/money-logic'
import { Money, parseMoneyInput } from '@grana/validation'
import {
  useMovementForm,
  type CategoryWithSubcategories,
  type Household,
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
import { colors } from '../../lib/colors'
import { useT } from '../../lib/locale-context'
import { createMovementMutators } from '../../lib/transactions/mutators'
import { invalidateAfterMovementMutation } from '../../lib/transactions/invalidate'
import { useQueryClient } from '@tanstack/react-query'

// Tabs offered: Gasto / Ingreso / Transferencia. Exchange and adjustment are
// deferred (B.2b), so their tabs are not offered here — the shared hook still
// supports them for a later slice.
const TABS: Tab[] = ['expense', 'income', 'transfer']

// The common counts as one-tap chips; anything else via the stepper. Local
// presentation mirror of the web form's constants (component-local there too).
const INSTALLMENT_OPTIONS = [1, 3, 6, 12]
const MAX_INSTALLMENTS = 60

const fmtAmount = (n: number) =>
  n.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })

type Props = {
  accounts: MovementFormAccount[]
  categories: CategoryWithSubcategories[]
  household: Household | null
  onDone: () => void
}

/**
 * Native render of the cross-platform `useMovementForm` hook — the mobile twin
 * of `apps/web/lib/transactions/components/movement-form.tsx`, scoped to the
 * create flow (incl. the credit family: card purchase, installments and
 * reimbursement). The hook owns all state/cascades/submit; this file only
 * paints it and wires the native mutators + cache invalidation.
 */
export function MovementForm({ accounts, categories, household, onDone }: Props) {
  const t = useT()
  const queryClient = useQueryClient()
  const mutators = useMemo(() => createMovementMutators(t), [t])

  const form = useMovementForm({
    mutators,
    accounts,
    categories,
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

  const members = household && household.members.length === 2 ? household.members : null
  const showShared = form.tab === 'expense' && members !== null
  const showCategory = form.tab === 'expense' || form.tab === 'income'

  const isCredit = form.selectedAccount?.type === 'credit'
  const showInstallmentsCard = form.tab === 'expense' && isCredit
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
  // the first cuota's period). Matches web after the `!isInstallments` gate was
  // dropped when reimbursements-on-installments shipped.
  const showReimbursement = form.tab === 'expense'

  // Default the credit-to account to the same-institution cash/bank — mirrored
  // from the hook for the UI-side toggle-on path (web does the same).
  const pickReimbursementAccount = (expenseAccountId: string): string => {
    const expenseAccount = accounts.find((a) => a.id === expenseAccountId)
    const inst = expenseAccount?.institutionId ?? null
    const banks = accounts.filter((a) => a.type !== 'credit')
    const match = inst ? banks.find((a) => a.institutionId === inst) : undefined
    return match?.id ?? banks[0]?.id ?? ''
  }

  return (
    <View className="flex-col gap-5">
      {/* Tab selector */}
      <Segmented
        ariaLabel={t('transactions.form.type_label')}
        value={form.tab}
        onValueChange={(v) => form.setTab(v as Tab)}
        options={TABS.map((tab) => ({
          value: tab,
          label: t(`transactions.types.${tab}`),
        }))}
      />

      {/* Amount (+ currency when the account has both) */}
      <View className="flex-col gap-1.5">
        <Label>{t('transactions.form.amount_label')}</Label>
        <MoneyAmountInput
          value={form.amount}
          onChangeText={form.setAmount}
          placeholder="0"
          autoFocus
        />
        {form.currencyOptions.length > 1 && (
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

      {/* Source account */}
      <View className="flex-col gap-1.5">
        <Label>{t('transactions.form.account_label')}</Label>
        <View className="flex-col gap-2">
          {form.eligibleAccounts.map((account) => (
            <PickRow
              key={account.id}
              label={account.institutionName ?? account.name}
              secondary={account.institutionName ? account.name : undefined}
              hint={
                account.type === 'credit'
                  ? t('transactions.drawer.credit_hint')
                  : undefined
              }
              selected={form.accountId === account.id}
              onPress={() => form.setAccountId(account.id)}
            />
          ))}
        </View>
      </View>

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

      {/* Destination account (transfer) */}
      {form.tab === 'transfer' && (
        <View className="flex-col gap-1.5">
          <Label>{t('transactions.form.destination_label')}</Label>
          <View className="flex-col gap-2">
            {form.otherAccounts.map((account) => (
              <PickRow
                key={account.id}
                label={account.institutionName ?? account.name}
                secondary={account.institutionName ? account.name : undefined}
                selected={form.destinationAccountId === account.id}
                onPress={() => form.setDestinationAccountId(account.id)}
              />
            ))}
          </View>
        </View>
      )}

      {/* Date */}
      <View className="flex-col gap-1.5">
        <Label>{t('transactions.form.date_label')}</Label>
        <DateField value={form.date} onChange={form.setDate} />
      </View>

      {/* Description */}
      <View className="flex-col gap-1.5">
        <Label>{t('transactions.form.description_label')}</Label>
        <Input
          value={form.description}
          onChangeText={form.setDescription}
          onBlur={() => {
            void form.fetchSuggestionForDescription()
          }}
          placeholder={t('transactions.form.description_placeholder')}
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

      {/* Category (+ subcategory drill) for expense/income */}
      {showCategory && (
        <View className="flex-col gap-1.5">
          <Label>{t('transactions.form.category_label')}</Label>
          <View className="flex-col gap-2">
            {form.transactionCategories.map((category) => {
              const active = form.categoryId === category.id
              return (
                <View key={category.id} className="flex-col gap-2">
                  <PickRow
                    label={category.name}
                    selected={active}
                    onPress={() => form.pickCategory(category.id, '')}
                  />
                  {active && category.subcategories.length > 0 && (
                    <View className="flex-col gap-1.5 pl-4">
                      {category.subcategories.map((sub) => (
                        <PickRow
                          key={sub.id}
                          label={sub.name}
                          selected={form.subcategoryId === sub.id}
                          onPress={() => form.pickCategory(category.id, sub.id)}
                          compact
                        />
                      ))}
                    </View>
                  )}
                </View>
              )
            })}
          </View>
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
                {t('transactions.reimbursement.pending_hint')}
              </Text>
            </View>
            <Switch
              ariaLabel={t('transactions.reimbursement.toggle')}
              checked={form.reimbursementEnabled}
              onValueChange={(on) => {
                form.setReimbursementEnabled(on)
                if (on) form.setReimbursementAccountId(pickReimbursementAccount(form.accountId))
              }}
            />
          </View>
          {form.reimbursementEnabled && (
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

              {/* Target radio — credit only (cash/bank implies 'account') */}
              {isCredit && (
                <View className="flex-col gap-1.5">
                  <Text className="text-xs text-text-muted">
                    {t('transactions.reimbursement.target_label')}
                  </Text>
                  <View className="flex-col gap-2">
                    {(['account', 'statement'] as const).map((tg) => (
                      <PickRow
                        key={tg}
                        label={t(`transactions.reimbursement.target.${tg}`)}
                        selected={form.reimbursementTarget === tg}
                        onPress={() => form.setReimbursementTarget(tg)}
                        compact
                      />
                    ))}
                  </View>
                </View>
              )}

              {/* Credit-to account (cash/bank) */}
              {(!isCredit || form.reimbursementTarget === 'account') && (
                <View className="flex-col gap-1.5">
                  <Label>{t('transactions.reimbursement.credit_to')}</Label>
                  <View className="flex-col gap-2">
                    {form.cashBankAccounts.map((account) => (
                      <PickRow
                        key={account.id}
                        label={account.institutionName ?? account.name}
                        secondary={account.institutionName ? account.name : undefined}
                        selected={form.reimbursementAccountId === account.id}
                        onPress={() => form.setReimbursementAccountId(account.id)}
                        compact
                      />
                    ))}
                  </View>
                </View>
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
            {form.isInstallments
              ? t('transactions.actions.register_installments', { count: installmentsNum })
              : t('transactions.form.submit')}
          </Text>
        )}
      </Pressable>
    </View>
  )
}

// A single selectable row — the picker unit for accounts, categories and
// subcategories. Emerald border when selected (mirror of SelectableCard).
function PickRow({
  label,
  secondary,
  hint,
  selected,
  onPress,
  compact = false,
}: {
  label: string
  secondary?: string
  hint?: string
  selected: boolean
  onPress: () => void
  compact?: boolean
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      className={`flex-row items-center justify-between rounded-xl border-2 bg-card ${
        compact ? 'px-3 py-2' : 'px-4 py-3'
      } ${selected ? 'border-emerald' : 'border-border'}`}
    >
      <View className="flex-1 flex-col">
        <Text className={`font-semibold text-text ${compact ? 'text-sm' : 'text-base'}`}>
          {label}
        </Text>
        {secondary && <Text className="text-xs text-text-muted">{secondary}</Text>}
        {hint && <Text className="text-xs text-text-soft">{hint}</Text>}
      </View>
      {selected && <Text className="text-emerald">✓</Text>}
    </Pressable>
  )
}
