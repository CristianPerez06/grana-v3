import { Pressable, Text, View } from 'react-native'
import {
  sanitizeOccurrenceCount,
  type RecurrenceEndAnswer,
  type RecurrenceEndDraft,
} from '@grana/money-logic'
import { Label } from '../ui/Label'
import { Input } from '../ui/Input'
import { DateField } from '../ui/DateField'
import { useT } from '../../lib/locale-context'

type Props = {
  value: RecurrenceEndDraft
  onChange: (draft: RecurrenceEndDraft) => void
  /** The rule's start date; the date field is invalid below it. */
  startDate: string
  /**
   * How much chrome to draw.
   *
   * `card` is the recurrence form's own box; `bare` is the movement drawer's
   * repeat strip, which already sits inside a card and whose chips are narrow.
   * Drawing only — the question, the three answers and what each sends are the
   * same shared model either way.
   */
  variant?: 'card' | 'bare'
}

const ANSWERS: RecurrenceEndAnswer[] = ['never', 'on-date', 'after-count']

const LABEL_KEY: Record<RecurrenceEndAnswer, string> = {
  never: 'recurrences.create.end_never',
  'on-date': 'recurrences.create.end_on_date',
  'after-count': 'recurrences.create.end_after_count',
}

/** The same three answers, named short enough to sit in a chip. */
const SHORT_LABEL_KEY: Record<RecurrenceEndAnswer, string> = {
  never: 'transactions.drawer.end_never_short',
  'on-date': 'transactions.drawer.end_on_date_short',
  'after-count': 'transactions.drawer.end_after_count_short',
}

/**
 * «¿Cómo termina?» — one question, three answers, natively.
 *
 * The twin of `apps/web/lib/recurrences/components/end-condition-field.tsx`:
 * different JSX, the same model from `@grana/money-logic`, so neither platform
 * can drift on what an answer means or on what it sends.
 *
 * The whole draft travels back on every change, hidden field included, so
 * switching answers and back does not lose what was typed. It cannot leak into
 * the payload either way: `endConditionColumns` reads only the field the chosen
 * answer names.
 *
 * The count keeps `number-pad` and the digit filter the native form already had
 * — that half was right here before it was right on web. What changes is that
 * the three answers are now exclusive, so a count typed under one answer and
 * abandoned under another is no longer sent.
 */
export const EndConditionField = ({
  value,
  onChange,
  startDate,
  variant = 'card',
}: Props) => {
  const t = useT()
  const bare = variant === 'bare'

  return (
    <View
      className={
        bare ? 'flex-col gap-2' : 'flex-col gap-3 rounded-xl border border-border bg-card p-4'
      }
    >
      {bare ? null : (
        <Text className="text-sm font-semibold text-text">
          {t('recurrences.create.end_question')}
        </Text>
      )}

      <View className={bare ? 'flex-row flex-wrap gap-1.5' : 'flex-col gap-1'}>
        {ANSWERS.map((answer) => {
          const selected = value.answer === answer
          return (
            <Pressable
              key={answer}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              onPress={() => onChange({ ...value, answer })}
              // The 44px touch target platforms ask for; web gets it from the
              // label's own box.
              hitSlop={8}
              className={
                bare
                  ? `rounded-full border px-2.5 py-2 ${
                      selected ? 'border-emerald bg-emerald-soft' : 'border-border bg-card'
                    }`
                  : 'flex-row items-center gap-3 py-2'
              }
            >
              {bare ? (
                <Text
                  className={`text-xs ${
                    selected ? 'font-semibold text-emerald-deep' : 'font-medium text-text-muted'
                  }`}
                >
                  {t(SHORT_LABEL_KEY[answer])}
                </Text>
              ) : (
                <>
                  <View
                    className={`size-5 items-center justify-center rounded-full border-2 ${
                      selected ? 'border-navy' : 'border-border'
                    }`}
                  >
                    {selected ? <View className="size-2.5 rounded-full bg-navy" /> : null}
                  </View>
                  <Text className="flex-1 text-sm font-semibold text-text">
                    {t(LABEL_KEY[answer])}
                  </Text>
                </>
              )}
            </Pressable>
          )
        })}
      </View>

      {value.answer === 'never' && !bare ? (
        <Text className="text-xs text-text-muted">{t('recurrences.create.end_never_hint')}</Text>
      ) : null}

      {value.answer === 'on-date' ? (
        <View className={bare ? '' : 'border-t border-border-soft pt-3'}>
          {bare ? null : <Label>{t('recurrences.create.repeat_until')}</Label>}
          <DateField
            value={value.endDate}
            onChange={(endDate) => onChange({ ...value, endDate })}
            placeholder={t('common.pick_date')}
            invalid={value.endDate !== '' && value.endDate < startDate}
          />
        </View>
      ) : null}

      {value.answer === 'after-count' ? (
        <View className={`flex-col gap-1.5 ${bare ? '' : 'border-t border-border-soft pt-3'}`}>
          {bare ? null : <Label>{t('recurrences.create.end_count_label')}</Label>}
          <Input
            value={value.maxOccurrences}
            onChangeText={(raw) =>
              onChange({ ...value, maxOccurrences: sanitizeOccurrenceCount(raw) })
            }
            keyboardType="number-pad"
            placeholder="—"
          />
          {bare ? null : (
            <Text className="text-xs text-text-muted">
              {t('recurrences.create.end_count_hint')}
            </Text>
          )}
        </View>
      ) : null}
    </View>
  )
}
