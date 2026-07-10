import { useMemo } from 'react'
import { Pressable, Text, View } from 'react-native'
import { getTodayAR } from '@grana/money-logic'
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
import { useT } from '../../lib/locale-context'
import { createMovementMutators } from '../../lib/transactions/mutators'
import { invalidateAfterMovementMutation } from '../../lib/transactions/invalidate'
import { useQueryClient } from '@tanstack/react-query'

// B-minimal tabs: Gasto / Ingreso / Transferencia (cash-bank only). Exchange and
// adjustment are deferred, so their tabs are not offered here — the shared hook
// still supports them for a later slice.
const TABS: Tab[] = ['expense', 'income', 'transfer']

type Props = {
  accounts: MovementFormAccount[]
  categories: CategoryWithSubcategories[]
  household: Household | null
  onDone: () => void
}

/**
 * Native render of the cross-platform `useMovementForm` hook — the mobile twin
 * of `apps/web/lib/transactions/components/movement-form.tsx`, scoped to the
 * B-minimal create flow. The hook owns all state/cascades/submit; this file only
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
    translate: (key, values) => (values ? t(key, values) : t(key)),
    onMutationSuccess: () => invalidateAfterMovementMutation(queryClient),
    onSuccess: onDone,
  })

  const members = household && household.members.length === 2 ? household.members : null
  const showShared = form.tab === 'expense' && members !== null
  const showCategory = form.tab === 'expense' || form.tab === 'income'

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
              selected={form.accountId === account.id}
              onPress={() => form.setAccountId(account.id)}
            />
          ))}
        </View>
      </View>

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
          <Spinner size="sm" />
        ) : (
          <Text className="text-base font-bold text-white">
            {t('transactions.form.submit')}
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
  selected,
  onPress,
  compact = false,
}: {
  label: string
  secondary?: string
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
      </View>
      {selected && <Text className="text-emerald">✓</Text>}
    </Pressable>
  )
}
