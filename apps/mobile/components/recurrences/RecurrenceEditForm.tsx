import { useState } from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { X } from 'lucide-react-native'
import { useQueryClient } from '@tanstack/react-query'
import { parseMoneyInput } from '@grana/validation'
import type { RecurrenceFrequency } from '@grana/money-logic'
import type { RecurrenceDetail } from '@grana/recurrences'
import { Label } from '../ui/Label'
import { Input } from '../ui/Input'
import { MoneyAmountInput } from '../ui/MoneyAmountInput'
import { DateField } from '../ui/DateField'
import { FormError } from '../ui/FormError'
import { Spinner } from '../ui/Spinner'
import { colors } from '../../lib/colors'
import { useT } from '../../lib/locale-context'
import { updateRecurrence } from '../../lib/recurrences/mutators'
import { invalidateAfterRecurrenceMutation } from '../../lib/recurrences/invalidate'

const PRESETS: RecurrenceFrequency[] = ['weekly', 'biweekly', 'monthly', 'annual']

type Props = {
  rule: RecurrenceDetail
  onClose: () => void
}

/**
 * Edit a recurring rule's mutable fields — amount / frequency / end date /
 * description. Account, category and movement type are fixed at creation (the
 * instance is a snapshot of the rule) and intentionally absent here; frequency
 * offers only the presets (no custom) — parity with web's edit drawer. Rendered
 * as the panel content of a `Drawer`. On save it invalidates the detail + hub
 * and closes.
 */
export function RecurrenceEditForm({ rule, onClose }: Props) {
  const t = useT()
  const queryClient = useQueryClient()

  const [amount, setAmount] = useState(String(rule.amount))
  const [frequency, setFrequency] = useState<RecurrenceFrequency>(rule.frequency)
  const [endDate, setEndDate] = useState(rule.end_date ?? '')
  const [description, setDescription] = useState(rule.description ?? '')
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const submit = async () => {
    setFormError(null)
    const parsedAmount = parseMoneyInput(amount)
    if (parsedAmount === null || parsedAmount <= 0) {
      setFormError(t('recurrences.errors.amount_invalid'))
      return
    }
    setSubmitting(true)
    const result = await updateRecurrence(
      rule.id,
      {
        amount: parsedAmount,
        frequency,
        end_date: endDate || null,
        description: description || null,
      },
      t,
    )
    setSubmitting(false)
    if (!result.ok) {
      setFormError(result.formError)
      return
    }
    invalidateAfterRecurrenceMutation(queryClient)
    onClose()
  }

  return (
    <SafeAreaView edges={['top', 'bottom']} className="flex-1 bg-page">
      {/* Panel header — title + close */}
      <View className="flex-row items-center justify-between border-b border-border-soft px-5 py-4">
        <Text className="text-[17px] font-bold text-text">{t('recurrences.edit_title')}</Text>
        <Pressable
          onPress={onClose}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={t('common.cancel')}
          className="h-9 w-9 items-center justify-center rounded-lg"
        >
          <X size={20} color={colors.textMuted} />
        </Pressable>
      </View>

      <ScrollView contentContainerClassName="gap-5 px-5 py-6" keyboardShouldPersistTaps="handled">
        {/* Amount */}
        <View className="flex-col gap-1.5">
          <Label>{t('recurrences.labels.amount')}</Label>
          <MoneyAmountInput value={amount} onChangeText={setAmount} placeholder="0" />
        </View>

        {/* Frequency (presets only) */}
        <View className="flex-col gap-1.5">
          <Label>{t('recurrences.labels.frequency')}</Label>
          <View className="flex-row flex-wrap gap-2">
            {PRESETS.map((f) => {
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
                    {t(`recurrences.frequencies.${f}`)}
                  </Text>
                </Pressable>
              )
            })}
          </View>
        </View>

        {/* End date (optional) */}
        <View className="flex-col gap-1.5">
          <Label>{t('recurrences.labels.end_date')}</Label>
          <DateField value={endDate} onChange={setEndDate} placeholder={t('common.pick_date')} />
        </View>

        {/* Description (optional) */}
        <View className="flex-col gap-1.5">
          <Label>{t('recurrences.labels.description')}</Label>
          <Input value={description} onChangeText={setDescription} />
        </View>

        {formError && <FormError message={formError} />}

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
            <Text className="text-base font-bold text-white">
              {t('recurrences.actions.save_changes')}
            </Text>
          )}
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  )
}
