import { useMemo, useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { useQueryClient } from '@tanstack/react-query'
import { formatDateISO, getTodayAR } from '@grana/money-logic'
import { parseMoneyInput } from '@grana/validation'
import type {
  CategoryWithSubcategories,
  Frequency,
  Household,
  IntervalUnit,
  MovementFormAccount,
} from '@grana/movement-form'
import { Label } from '../ui/Label'
import { Input } from '../ui/Input'
import { MoneyAmountInput } from '../ui/MoneyAmountInput'
import { DateField } from '../ui/DateField'
import { Segmented } from '../ui/Segmented'
import { Switch } from '../ui/Switch'
import { FormError } from '../ui/FormError'
import { Spinner } from '../ui/Spinner'
import { AccountSelectField, CategorySelectField } from '../transactions/form-pickers'
import { colors } from '../../lib/colors'
import { useT } from '../../lib/locale-context'
import { createRecurrence } from '../../lib/recurrences/mutators'
import { invalidateAfterRecurrenceMutation } from '../../lib/recurrences/invalidate'

type MovementType = 'income' | 'expense' | 'transfer'

const TYPES: MovementType[] = ['expense', 'income', 'transfer']
const FREQUENCIES: Frequency[] = ['weekly', 'biweekly', 'monthly', 'annual', 'custom']
const INTERVAL_UNITS: IntervalUnit[] = ['day', 'week', 'month', 'year']

const todayISO = () => formatDateISO(getTodayAR())

// Income/transfer live on cash/bank; only an expense can target a credit card
// (mirror of the web create modal's `eligibleFor`).
const eligibleFor = (accounts: MovementFormAccount[], type: MovementType) =>
  type === 'expense' ? accounts : accounts.filter((a) => a.type !== 'credit')

type Props = {
  accounts: MovementFormAccount[]
  categories: CategoryWithSubcategories[]
  household: Household | null
  onDone: () => void
}

/**
 * Native "create a recurrence from scratch" form (the mobile twin of web's
 * `CreateRecurrenceModal`). Deliberately NOT `MovementForm`: it composes the same
 * shared primitives/pickers but its own submit calls `createRecurrence` — the
 * rule is created with no movement today; the first due occurrence lands as a
 * pending instance. Covers income/expense/transfer + cadence + optional
 * end-date / max-occurrences + a shared template (expense + 2-member household).
 */
export function RecurrenceForm({ accounts, categories, household, onDone }: Props) {
  const t = useT()
  const queryClient = useQueryClient()

  const [type, setType] = useState<MovementType>('expense')
  const eligibleAccounts = useMemo(() => eligibleFor(accounts, type), [accounts, type])

  const [accountId, setAccountId] = useState(eligibleAccounts[0]?.id ?? '')
  const selectedAccount = accounts.find((a) => a.id === accountId) ?? eligibleAccounts[0]
  const activeCurrencies = selectedAccount?.activeCurrencies ?? ['ARS']

  const [currencyCode, setCurrencyCode] = useState<'ARS' | 'USD'>(activeCurrencies[0] ?? 'ARS')
  const [amount, setAmount] = useState('')
  const [destinationAccountId, setDestinationAccountId] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [subcategoryId, setSubcategoryId] = useState('')
  const [description, setDescription] = useState('')
  const [startDate, setStartDate] = useState(todayISO())

  const [frequency, setFrequency] = useState<Frequency>('monthly')
  const [intervalCount, setIntervalCount] = useState(1)
  const [intervalUnit, setIntervalUnit] = useState<IntervalUnit>('month')
  const [hasEndDate, setHasEndDate] = useState(false)
  const [endDate, setEndDate] = useState('')
  const [maxOccurrences, setMaxOccurrences] = useState('')

  // Shared template (expense + two-member household). members[0] is the current
  // user (getHousehold orders self first); the split seeds each instance.
  const members = household && household.members.length === 2 ? household.members : null
  const [sharedEnabled, setSharedEnabled] = useState(false)
  const [splitFirstPct, setSplitFirstPct] = useState<number>(() => {
    const stored = household?.defaultSplit.find(
      (s) => s.user_id === household.members[0]?.userId,
    )?.percentage
    return stored ?? 50
  })
  const showShared = type === 'expense' && members !== null

  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const categoryList = useMemo(
    () =>
      categories.filter((c) =>
        type === 'income' ? c.type === 'income' || c.type === 'both' : c.type === 'expense' || c.type === 'both',
      ),
    [categories, type],
  )
  const transferDestinations = accounts.filter((a) => a.type !== 'credit' && a.id !== accountId)

  const handleTypeChange = (next: MovementType) => {
    setType(next)
    setCategoryId('')
    setSubcategoryId('')
    setFormError(null)
    if (next !== 'expense') setSharedEnabled(false)
    const eligible = eligibleFor(accounts, next)
    if (!eligible.some((a) => a.id === accountId)) {
      const first = eligible[0]
      setAccountId(first?.id ?? '')
      if (first && !first.activeCurrencies.includes(currencyCode)) {
        setCurrencyCode(first.activeCurrencies[0] ?? 'ARS')
      }
    }
  }

  const handleAccountChange = (id: string) => {
    setAccountId(id)
    const account = accounts.find((a) => a.id === id)
    if (account && !account.activeCurrencies.includes(currencyCode)) {
      setCurrencyCode(account.activeCurrencies[0] ?? 'ARS')
    }
  }

  const submit = async () => {
    setFormError(null)

    const parsedAmount = parseMoneyInput(amount)
    if (parsedAmount === null || parsedAmount <= 0) {
      setFormError(t('recurrences.errors.amount_invalid'))
      return
    }
    if ((type === 'income' || type === 'expense') && !categoryId) {
      setFormError(t('recurrences.create.errors.category_required'))
      return
    }
    if (type === 'transfer') {
      if (!destinationAccountId) {
        setFormError(t('recurrences.create.errors.destination_required'))
        return
      }
      if (destinationAccountId === accountId) {
        setFormError(t('recurrences.create.errors.destination_same'))
        return
      }
    }
    const trimmedEnd = hasEndDate ? endDate.trim() : ''
    if (trimmedEnd !== '' && trimmedEnd < startDate) {
      setFormError(t('recurrences.errors.end_before_start'))
      return
    }
    const trimmedMax = maxOccurrences.trim()

    const sharedDecl =
      type === 'expense' && sharedEnabled && members && household
        ? {
            household_id: household.id,
            splits: [
              { user_id: members[0].userId, percentage: splitFirstPct },
              { user_id: members[1].userId, percentage: 100 - splitFirstPct },
            ],
          }
        : undefined

    const payload = {
      movement_type: type,
      account_id: accountId,
      currency_code: currencyCode,
      amount: parsedAmount,
      description: description.trim() || undefined,
      frequency,
      ...(frequency === 'custom' ? { interval_count: intervalCount, interval_unit: intervalUnit } : {}),
      start_date: startDate,
      ...(trimmedEnd !== '' ? { end_date: trimmedEnd } : {}),
      ...(trimmedMax !== '' ? { max_occurrences: Number(trimmedMax) } : {}),
      ...(type === 'transfer'
        ? { transfer_destination_account_id: destinationAccountId }
        : { category_id: categoryId, subcategory_id: subcategoryId || undefined }),
      ...(sharedDecl ? { shared: sharedDecl } : {}),
    }

    setSubmitting(true)
    const result = await createRecurrence(payload, t)
    setSubmitting(false)
    if (!result.ok) {
      setFormError(result.formError)
      return
    }
    invalidateAfterRecurrenceMutation(queryClient)
    onDone()
  }

  return (
    <View className="flex-col gap-5">
      {/* Type */}
      <View className="flex-col gap-1.5">
        <Label>{t('transactions.form.type_label')}</Label>
        <Segmented
          ariaLabel={t('transactions.form.type_label')}
          value={type}
          onValueChange={(v) => handleTypeChange(v as MovementType)}
          options={TYPES.map((tp) => ({ value: tp, label: t(`transactions.types.${tp}`) }))}
        />
      </View>

      {/* Amount (+ currency when the account has both) */}
      <View className="flex-col gap-1.5">
        <Label>{t('transactions.form.amount_label')}</Label>
        <MoneyAmountInput value={amount} onChangeText={setAmount} placeholder="0" />
        {activeCurrencies.length > 1 && (
          <View className="pt-1">
            <Segmented
              ariaLabel={t('transactions.form.currency_label')}
              value={currencyCode}
              onValueChange={(v) => setCurrencyCode(v as 'ARS' | 'USD')}
              options={activeCurrencies.map((c) => ({ value: c, label: c }))}
            />
          </View>
        )}
      </View>

      {/* Source account */}
      <AccountSelectField
        label={t('transactions.form.account_label')}
        accounts={eligibleAccounts}
        selectedId={accountId}
        onSelect={handleAccountChange}
      />

      {/* Destination (transfer) */}
      {type === 'transfer' && (
        <AccountSelectField
          label={t('transactions.form.destination_label')}
          accounts={transferDestinations}
          selectedId={destinationAccountId}
          onSelect={setDestinationAccountId}
        />
      )}

      {/* Category (income / expense) */}
      {(type === 'income' || type === 'expense') && (
        <CategorySelectField
          categories={categoryList}
          categoryId={categoryId}
          subcategoryId={subcategoryId}
          onPick={(cat, sub) => {
            setCategoryId(cat)
            setSubcategoryId(sub)
          }}
        />
      )}

      {/* Description */}
      <View className="flex-col gap-1.5">
        <Label>{t('transactions.form.description_label')}</Label>
        <Input
          value={description}
          onChangeText={setDescription}
          placeholder={t('transactions.form.description_placeholder')}
        />
      </View>

      {/* Start date */}
      <View className="flex-col gap-1.5">
        <Label>{t('recurrences.create.start_date')}</Label>
        <DateField value={startDate} onChange={setStartDate} />
      </View>

      {/* Frequency */}
      <View className="flex-col gap-3 rounded-xl border border-border bg-card p-4">
        <Text className="text-sm font-semibold text-text">{t('recurrences.labels.frequency')}</Text>
        <View className="flex-row flex-wrap gap-2">
          {FREQUENCIES.map((f) => {
            const active = frequency === f
            return (
              <Pressable
                key={f}
                onPress={() => setFrequency(f)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                className={`rounded-lg px-3.5 py-2 ${active ? 'bg-navy' : 'bg-border-soft'}`}
              >
                <Text className={`text-sm font-bold ${active ? 'text-white' : 'text-text-muted'}`}>
                  {t(`transactions.frequencies.${f}`)}
                </Text>
              </Pressable>
            )
          })}
        </View>

        {/* Custom interval: count + unit chips */}
        {frequency === 'custom' && (
          <View className="flex-col gap-2 border-t border-border-soft pt-3">
            <View className="flex-row items-center gap-2">
              <Text className="text-xs text-text-muted">
                {t('recurrences.custom_interval.every')}
              </Text>
              <Input
                value={String(intervalCount)}
                onChangeText={(v) => {
                  const digits = v.replace(/\D/g, '')
                  setIntervalCount(digits === '' ? 1 : Math.max(1, parseInt(digits)))
                }}
                keyboardType="number-pad"
                accessibilityLabel={t('recurrences.custom_interval.every')}
                className="w-16 text-center"
              />
            </View>
            <View className="flex-row flex-wrap gap-2">
              {INTERVAL_UNITS.map((u) => {
                const active = intervalUnit === u
                return (
                  <Pressable
                    key={u}
                    onPress={() => setIntervalUnit(u)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    className={`rounded-lg px-3.5 py-2 ${active ? 'bg-navy' : 'bg-border-soft'}`}
                  >
                    <Text className={`text-sm font-bold ${active ? 'text-white' : 'text-text-muted'}`}>
                      {t(`recurrences.custom_interval.units.${u}`, { count: intervalCount })}
                    </Text>
                  </Pressable>
                )
              })}
            </View>
          </View>
        )}
      </View>

      {/* Optional end date */}
      <View className="flex-col gap-3 rounded-xl border border-border bg-card p-4">
        <View className="flex-row items-center justify-between">
          <Text className="text-sm font-semibold text-text">
            {t('recurrences.create.has_end_date')}
          </Text>
          <Switch
            ariaLabel={t('recurrences.create.has_end_date')}
            checked={hasEndDate}
            onValueChange={setHasEndDate}
          />
        </View>
        {hasEndDate && (
          <View className="border-t border-border-soft pt-3">
            <DateField
              value={endDate}
              onChange={setEndDate}
              placeholder={t('common.pick_date')}
              invalid={endDate !== '' && endDate < startDate}
            />
          </View>
        )}
      </View>

      {/* Optional max occurrences */}
      <View className="flex-col gap-1.5">
        <Label>{t('recurrences.create.max_occurrences')}</Label>
        <Input
          value={maxOccurrences}
          onChangeText={(v) => setMaxOccurrences(v.replace(/\D/g, ''))}
          keyboardType="number-pad"
          placeholder={t('common.optional')}
        />
      </View>

      {/* Shared split (expense, 2-member household) */}
      {showShared && members && (
        <View className="flex-col gap-3 rounded-xl border border-border bg-card p-4">
          <View className="flex-row items-center justify-between">
            <Text className="text-sm font-semibold text-text">
              {t('transactions.form.shared_toggle')}
            </Text>
            <Switch
              ariaLabel={t('transactions.form.shared_toggle')}
              checked={sharedEnabled}
              onValueChange={setSharedEnabled}
            />
          </View>
          {sharedEnabled && (
            <View className="flex-col gap-2">
              <Segmented
                ariaLabel={t('transactions.form.split_label')}
                value={String(splitFirstPct)}
                onValueChange={(v) => setSplitFirstPct(Number(v))}
                options={[
                  { value: '100', label: t('transactions.form.split_you') },
                  { value: '50', label: t('transactions.form.split_even') },
                  { value: '0', label: t('transactions.form.split_other', { name: members[1].fullName }) },
                ]}
              />
              <Text className="text-xs text-text-muted">
                {t('transactions.form.your_share', { pct: splitFirstPct })}
              </Text>
            </View>
          )}
        </View>
      )}

      {formError && <FormError message={formError} />}

      {/* Submit */}
      <Pressable
        onPress={submit}
        disabled={submitting}
        accessibilityRole="button"
        accessibilityState={{ disabled: submitting }}
        className={`mt-1 h-14 flex-row items-center justify-center rounded-2xl bg-emerald ${
          submitting ? 'opacity-60' : ''
        }`}
      >
        {submitting ? (
          <View className="flex-row items-center gap-2">
            <Spinner size="sm" color={colors.white} />
            <Text className="text-base font-bold text-white">{t('common.saving')}</Text>
          </View>
        ) : (
          <Text className="text-base font-bold text-white">{t('recurrences.actions.create')}</Text>
        )}
      </Pressable>
    </View>
  )
}
