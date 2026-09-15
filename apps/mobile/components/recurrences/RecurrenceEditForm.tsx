import { useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context'
import { X } from 'lucide-react-native'
import { useQueryClient } from '@tanstack/react-query'
import { parseMoneyInput } from '@grana/validation'
import {
  endConditionColumns,
  endDraftForRule,
  formatDateISO,
  getTodayAR,
  hasBothEndConditions,
  presetToInterval,
  validateEndCondition,
} from '@grana/money-logic'
import type {
  IntervalUnit,
  RecurrenceEndDraft,
  RecurrenceFrequency,
  RecurrenceFrequencyLabel,
} from '@grana/money-logic'
import { Switch } from '../ui/Switch'
import { EndConditionField } from './EndConditionField'
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
 * instance is a snapshot of the rule) and intentionally absent here. Frequency
 * offers the four presets to CHOOSE from, plus a non-selectable chip naming the
 * rule's own calendar while that calendar is custom — parity with web's edit
 * drawer, which renders the same thing as a disabled `<option>`. Rendered as the
 * panel content of a `Drawer`. On save it invalidates the detail + hub and
 * closes.
 */
export function RecurrenceEditForm({ rule, onClose }: Props) {
  const t = useT()
  const locale = useLocale()
  const queryClient = useQueryClient()

  const [amount, setAmount] = useState(String(rule.amount))
  const [frequency, setFrequency] = useState<RecurrenceFrequencyLabel>(rule.frequency)
  // The rule's calendar anchor. A rule created from a movement inherits that
  // movement's date, and that date can be off — a salary that landed on the 8th
  // because the 10th was a holiday anchors the rule to the 8th forever.
  const [startDate, setStartDate] = useState(rule.start_date)
  const [effectiveFrom, setEffectiveFrom] = useState<string | null>(null)
  // «¿Cómo termina?», seeded from the rule. A rule carrying BOTH conditions
  // opens on «después de N» and is not quietly stripped of the other — the
  // warning below names it and waits for a yes.
  const [endCondition, setEndCondition] = useState<RecurrenceEndDraft>(() =>
    endDraftForRule(rule),
  )
  const [bothAcknowledged, setBothAcknowledged] = useState(false)
  const [description, setDescription] = useState(rule.description ?? '')
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const anchorMoved = startDate !== rule.start_date
  // The pair the save will send, derived from the chosen answer — so the
  // reference-date options below are computed against the calendar being SAVED.
  const endColumns = endConditionColumns(endCondition)
  // The rule stored both conditions and the user has not been told yet.
  const showsBothWarning = hasBothEndConditions(rule) && !bothAcknowledged

  // THE CALENDAR BEING SAVED, not the one on the row. The server recomputes the
  // dates it will accept from the patch, so a form that offers dates from the
  // stored frequency offers dates the server refuses — which is what happens the
  // moment somebody changes the frequency and the reference date in one pass.
  //
  // `custom` has no preset to derive: the mutation leaves the rule's interval
  // untouched when the label stays custom, so the calendar being saved is the
  // one the rule already has. Asking `presetToInterval` about it returns nothing
  // and the form throws before it can render.
  const interval =
    frequency === 'custom'
      ? { count: rule.interval_count, unit: rule.interval_unit as IntervalUnit }
      : presetToInterval(frequency)
  const choice = referenceDateChoice(
    {
      status: rule.status,
      interval_count: interval.count,
      interval_unit: interval.unit,
      end_date: endColumns.end_date,
      max_occurrences: endColumns.max_occurrences,
      positionsSpent: rule.positions_spent,
    },
    startDate,
    formatDateISO(getTodayAR()),
  )

  // THE ANSWER HAS TO BE ONE OF THE QUESTIONS CURRENTLY ON SCREEN. Editing the
  // reference date, the frequency or the end date rebuilds the options; a
  // selection made against the previous set is not an answer to this one, and
  // sending it means sending a date the server never offered.
  const options = choice.kind === 'ask' ? choice.options : []
  const selected = effectiveFrom != null && options.includes(effectiveFrom) ? effectiveFrom : null

  const submit = async () => {
    setFormError(null)
    const parsedAmount = parseMoneyInput(amount)
    if (parsedAmount === null || parsedAmount <= 0) {
      setFormError(t('recurrences.errors.amount_invalid'))
      return
    }

    const endProblem = validateEndCondition(endCondition, {
      startDate,
      positionsSpent: rule.positions_spent,
    })
    if (endProblem != null) {
      setFormError(
        endProblem.kind === 'date-before-start'
          ? t('recurrences.errors.end_before_start')
          : endProblem.kind === 'date-missing'
            ? t('recurrences.create.errors.end_date_required')
            : endProblem.kind === 'count-below-spent'
              ? t('recurrences.create.errors.end_count_below_spent', {
                  spent: endProblem.spent,
                })
              : t('recurrences.create.errors.end_count_required'),
      )
      return
    }

    // A rule carrying both conditions loses one on save. Saying which, and
    // waiting for a yes, is what keeps this from being the silent discard that
    // made #142 — the same defect from the other side.
    if (showsBothWarning) {
      setFormError(t('recurrences.create.end_both_title'))
      return
    }

    // A rule with nothing left ahead has no date that could be the first under a
    // new reference, and the database refuses the change for exactly that
    // reason. Saying so here is the difference between a sentence the user can
    // act on and a failed save they have to interpret.
    if (anchorMoved && choice.kind === 'exhausted') {
      setFormError(t('recurrences.reference_date_exhausted'))
      return
    }

    // Asked, and unanswered. Picking the first option on the user's behalf is
    // the inference this whole change exists to remove: from the data, "the
    // cycle in flight is settled" and "it is not" look identical.
    if (anchorMoved && choice.kind === 'ask' && selected == null) {
      setFormError(t('recurrences.errors.reference_date_unanswered'))
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
        schedule_effective_from: anchorMoved && choice.kind === 'ask' ? selected : null,
        end_date: endColumns.end_date,
        max_occurrences: endColumns.max_occurrences,
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
    // ITS OWN PROVIDER, and that is not redundant with the root one. `Drawer`
    // hosts this panel inside an RN `Modal`, which is a SEPARATE NATIVE WINDOW:
    // the `SafeAreaProvider` in `app/_layout.tsx` does not reach into it, so the
    // `SafeAreaView` below reads insets of zero and plants the header at y=0 —
    // under the Dynamic Island, with the title behind the pill and the close
    // button pushed against it. Same reason `Drawer` mounts its own
    // `KeyboardProvider` rather than relying on the root one.
    <SafeAreaProvider>
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
              {/* Only while the rule IS custom, and not selectable: no preset
                  carries that calendar, so without this chip all four sit dark
                  and the field reads as unanswered on a rule that fires every
                  three days. It is not a choice, it is the truth about where the
                  rule stands — the same chip web renders as a disabled
                  `<option>`. Tapping a preset from here still replaces the
                  custom calendar, which is the only way out of it. */}
              {frequency === 'custom' ? (
                <View
                  accessibilityRole="text"
                  className="rounded-lg border border-navy bg-card px-3.5 py-2"
                >
                  <Text className="text-sm font-bold text-navy">
                    {t('recurrences.frequencies.custom')}
                  </Text>
                </View>
              ) : null}
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
                const isSelected = selected === option
                return (
                  <Pressable
                    key={option}
                    onPress={() => setEffectiveFrom(option)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: isSelected }}
                    className="flex-row items-center gap-2 py-1"
                  >
                    {/* `border-text-muted`, NOT `border-border`. This block sits
                        on `bg-border-soft` (#EEF1F4) and `border` is #E6EAEF —
                        a contrast ratio of about 1.05:1, which is to say the
                        unselected radio is invisible and the question reads as
                        two dates nobody can tell are tappable. Web gets this for
                        free from a native `<input type="radio">`; a circle
                        painted by hand has to earn it. #6B7683 lands near 4.5:1,
                        past the 3:1 a non-text control needs. */}
                    <View
                      className={`h-4 w-4 rounded-full border ${
                        isSelected ? 'border-navy bg-navy' : 'border-text-muted bg-card'
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

          {/* «¿Cómo termina?» — editable here for the first time. A rule created
              with a limit could neither have it changed nor removed: this form
              only ever offered the end date. */}
          <EndConditionField
            value={endCondition}
            onChange={setEndCondition}
            startDate={startDate}
          />

          {showsBothWarning ? (
            <View className="flex-col gap-2 rounded-xl border border-border bg-surface-soft p-4">
              <Text className="text-sm font-semibold text-text">
                {t('recurrences.create.end_both_title')}
              </Text>
              <Text className="text-xs text-text-muted">
                {t('recurrences.create.end_both_body', {
                  keeping: t(
                    endCondition.answer === 'after-count'
                      ? 'recurrences.create.end_after_count'
                      : endCondition.answer === 'on-date'
                        ? 'recurrences.create.end_on_date'
                        : 'recurrences.create.end_never',
                  ),
                  dropping: t(
                    endCondition.answer === 'after-count'
                      ? 'recurrences.create.end_on_date'
                      : 'recurrences.create.end_after_count',
                  ),
                })}
              </Text>
              <View className="flex-row items-center justify-between gap-3">
                <Text className="flex-1 text-sm text-text">
                  {t('recurrences.create.end_both_confirm')}
                </Text>
                <Switch
                  ariaLabel={t('recurrences.create.end_both_confirm')}
                  checked={bothAcknowledged}
                  onValueChange={setBothAcknowledged}
                />
              </View>
            </View>
          ) : null}

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
    </SafeAreaProvider>
  )
}
