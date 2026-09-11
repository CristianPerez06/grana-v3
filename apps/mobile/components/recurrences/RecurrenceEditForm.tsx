import { useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { X } from 'lucide-react-native'
import { useQueryClient } from '@tanstack/react-query'
import { parseMoneyInput } from '@grana/validation'
import { formatDateISO, getTodayAR } from '@grana/money-logic'
import type { IntervalUnit, RecurrenceFrequency } from '@grana/money-logic'
import { referenceDateChoice } from '@grana/recurrences'
import type { RecurrenceDetail } from '@grana/recurrences'
import { Label } from '../ui/Label'
import { Input } from '../ui/Input'
import { MoneyAmountInput } from '../ui/MoneyAmountInput'
import { DateField } from '../ui/DateField'
import { FormError } from '../ui/FormError'
import { Spinner } from '../ui/Spinner'
import { FormSheetBody } from '../layout/FormSheetBody'
import { colors } from '../../lib/colors'
import { useLocale, useT } from '../../lib/locale-context'
import { formatShortDate } from '../transactions/detail/format'
import { updateRecurrence } from '../../lib/recurrences/mutators'
import { invalidateAfterRecurrenceMutation } from '../../lib/recurrences/invalidate'

const PRESETS: RecurrenceFrequency[] = ['weekly', 'biweekly', 'monthly', 'annual']

type Props = {
  rule: RecurrenceDetail
  onClose: () => void
}

/**
 * Edit a recurring rule's mutable fields — amount / frequency / reference date /
 * end date / description. Account, category and movement type are fixed at creation (the
 * instance is a snapshot of the rule) and intentionally absent here; frequency
 * offers only the presets (no custom) — parity with web's edit drawer. Rendered
 * as the panel content of a `Drawer`. On save it invalidates the detail + hub
 * and closes.
 */
export function RecurrenceEditForm({ rule, onClose }: Props) {
  const t = useT()
  const locale = useLocale()
  const queryClient = useQueryClient()

  const [amount, setAmount] = useState(String(rule.amount))
  const [frequency, setFrequency] = useState<RecurrenceFrequency>(rule.frequency)
  // The rule's calendar anchor. A rule created from a movement inherits that
  // movement's date, and that date can be off — a salary that landed on the 8th
  // because the 10th was a holiday anchors the rule to the 8th forever.
  const [startDate, setStartDate] = useState(rule.start_date)
  const [effectiveFrom, setEffectiveFrom] = useState<string | null>(null)
  const [endDate, setEndDate] = useState(rule.end_date ?? '')
  const [description, setDescription] = useState(rule.description ?? '')
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const anchorMoved = startDate !== rule.start_date
  const choice = referenceDateChoice(
    {
      status: rule.status,
      interval_count: rule.interval_count,
      // The row carries it as text; the calendar is the one that narrows it, and
      // the database CHECK is what guarantees the four values.
      interval_unit: rule.interval_unit as IntervalUnit,
      end_date: endDate || null,
      max_occurrences: rule.max_occurrences,
      positionsSpent: rule.positions_spent,
    },
    startDate,
    formatDateISO(getTodayAR()),
  )

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
        start_date: startDate,
        // Only meaningful when the anchor moves; the mutation ignores it
        // otherwise. `null` is the paused rule's answer — from today, waiting —
        // and the database refuses a date there.
        schedule_effective_from:
          choice.kind === 'ask' ? (effectiveFrom ?? choice.options[0]) : null,
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

      <FormSheetBody contentClassName="gap-5 px-5 py-6">
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

        {/* Reference date — the rule's calendar anchor */}
        <View className="flex-col gap-1.5">
          <Label>{t('recurrences.labels.reference_date')}</Label>
          <DateField
            value={startDate}
            onChange={setStartDate}
            placeholder={t('common.pick_date')}
          />
          {/* What the user cannot deduce: the change rules from here on, and the
              occurrences that already exist keep their own date — an old one
              sitting on the old day is not a bug. It deliberately does NOT say
              what to do with it: confirming or skipping it is the user's call. */}
          <Text className="text-[12px] text-text-soft">
            {t('recurrences.reference_date_hint')}
          </Text>
        </View>

        {/* THE AMBIGUITY IS THE USER'S TO RESOLVE, and only when the anchor
            actually moves. The cycle in flight may already be settled — in which
            case the corrected schedule has to rule from the NEXT one, or the
            month gets a second salary — or it may not be, and then it rules now.
            From the data both look the same. Two concrete dates, never the word
            "month": a rule every three days has none. */}
        {anchorMoved && choice.kind === 'ask' ? (
          <View className="flex-col gap-2 rounded-xl border border-border bg-border-soft px-4 py-3">
            <Text className="text-[13px] font-semibold text-text">
              {t('recurrences.reference_date_question')}
            </Text>
            {choice.options.map((option) => {
              const selected = (effectiveFrom ?? choice.options[0]) === option
              return (
                <Pressable
                  key={option}
                  onPress={() => setEffectiveFrom(option)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  className="flex-row items-center gap-2 py-1"
                >
                  <View
                    className={`h-4 w-4 rounded-full border ${
                      selected ? 'border-navy bg-navy' : 'border-border bg-card'
                    }`}
                  />
                  <Text className="text-[13px] text-text">
                    {formatShortDate(option, locale)}
                  </Text>
                </Pressable>
              )
            })}
          </View>
        ) : null}
        {anchorMoved && choice.kind === 'paused' ? (
          <Text className="text-[12px] text-text-soft">
            {t('recurrences.reference_date_paused')}
          </Text>
        ) : null}
        {anchorMoved && choice.kind === 'exhausted' ? (
          <Text className="text-[12px] text-text-soft">
            {t('recurrences.reference_date_exhausted')}
          </Text>
        ) : null}

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
      </FormSheetBody>
    </SafeAreaView>
  )
}
