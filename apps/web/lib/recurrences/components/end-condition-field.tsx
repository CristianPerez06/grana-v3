'use client'

import { useTranslations } from 'next-intl'
import {
  sanitizeOccurrenceCount,
  type RecurrenceEndAnswer,
  type RecurrenceEndDraft,
} from '@grana/money-logic'
import { DatePicker } from '@/components/ui/date-picker'

type Props = {
  value: RecurrenceEndDraft
  onChange: (draft: RecurrenceEndDraft) => void
  /** The rule's start date; the date field never goes below it. */
  startDate: string
  /** Prefix for the field ids, so two of these can live on one page. */
  idPrefix?: string
  /**
   * How much chrome to draw around the question.
   *
   * `row` is the create modal's list-row look (full-bleed, its own divider);
   * `plain` is the same content with no chrome, for a form that already has a
   * box around it; `compact` is the movement drawer's chip strip, where the
   * question shares a narrow card with the frequency chips and three stacked
   * radios would not fit.
   *
   * They differ in DRAWING only — the question, its three answers and what each
   * one sends come from the same model, which is the point of having one.
   */
  variant?: 'row' | 'plain' | 'compact'
}

const ANSWERS: RecurrenceEndAnswer[] = ['never', 'on-date', 'after-count']

const LABEL_KEY: Record<RecurrenceEndAnswer, string> = {
  never: 'create.end_never',
  'on-date': 'create.end_on_date',
  'after-count': 'create.end_after_count',
}

/** The same three answers, named short enough to sit in a chip. */
const SHORT_LABEL_KEY: Record<RecurrenceEndAnswer, string> = {
  never: 'drawer.end_never_short',
  'on-date': 'drawer.end_on_date_short',
  'after-count': 'drawer.end_after_count_short',
}

/**
 * «¿Cómo termina?» — one question, three answers, on web.
 *
 * The drawing is web's; the model is shared (`@grana/money-logic`), so this and
 * the native control cannot drift on what each answer means or what it sends.
 *
 * TWO THINGS ARE DELIBERATE HERE:
 *
 *   · The whole draft is kept in the caller's state and handed back on every
 *     change, INCLUDING the field that is not showing. Switching answers and
 *     switching back does not lose what was typed — and it costs nothing,
 *     because the payload comes from `endConditionColumns`, which reads only the
 *     field the answer names. The hidden value has no way out.
 *   · The count is `type="text" inputMode="numeric"`, never `type="number"`.
 *     That one changes with the mouse wheel and the arrow keys, silently: the
 *     same reason money amounts are banned from it. A limit that moved without
 *     anyone typing is a limit nobody knows about.
 */
export const EndConditionField = ({
  value,
  onChange,
  startDate,
  idPrefix = 'rec',
  variant = 'row',
}: Props) => {
  const tRec = useTranslations('recurrences')
  const tTx = useTranslations('transactions')

  if (variant === 'compact') {
    return (
      <div className="flex flex-col gap-1.5">
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={tTx('drawer.end_question')}>
          {ANSWERS.map((answer) => {
            const active = value.answer === answer
            return (
              <button
                key={answer}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => onChange({ ...value, answer })}
                className={`rounded-full border px-2.5 py-1.5 text-[11.5px] leading-none transition-colors ${
                  active ? 'font-semibold text-emerald-deep' : 'border-border font-medium text-text-muted'
                }`}
                style={
                  active
                    ? { backgroundColor: 'var(--emerald-soft)', borderColor: '#BFE9D6' }
                    : { backgroundColor: '#fff' }
                }
              >
                {tTx(SHORT_LABEL_KEY[answer])}
              </button>
            )
          })}
        </div>

        {value.answer === 'on-date' && (
          <DatePicker
            id={`${idPrefix}-end-date`}
            value={value.endDate}
            onChange={(endDate) => onChange({ ...value, endDate })}
            min={startDate}
            modal
            label={tRec('create.repeat_until')}
          />
        )}

        {value.answer === 'after-count' && (
          <input
            id={`${idPrefix}-end-count`}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            aria-label={tRec('create.end_count_label')}
            value={value.maxOccurrences}
            onChange={(event) =>
              onChange({ ...value, maxOccurrences: sanitizeOccurrenceCount(event.target.value) })
            }
            placeholder={tRec('create.end_count_label')}
            className="h-9 w-full rounded-[9px] border border-border px-2.5 text-[12.5px] text-text outline-none focus-visible:ring-2 focus-visible:ring-ring"
            style={{ backgroundColor: '#FAFBFC' }}
          />
        )}
      </div>
    )
  }

  return (
    <fieldset
      className={variant === 'row' ? '-mx-4 border-t px-4 py-3' : 'py-1'}
      style={variant === 'row' ? { borderColor: 'rgba(0,0,0,0.06)' } : undefined}
    >
      <legend className="sr-only">{tRec('create.end_question')}</legend>
      <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-text-soft">
        {tRec('create.end_question')}
      </p>

      <div className="mt-2 flex flex-col gap-1">
        {ANSWERS.map((answer) => (
          <label key={answer} className="flex items-center gap-3 py-1.5 text-[14px] text-text">
            <input
              type="radio"
              name={`${idPrefix}-end-answer`}
              value={answer}
              checked={value.answer === answer}
              onChange={() => onChange({ ...value, answer })}
              className="size-4 accent-navy"
            />
            <span className="font-semibold">{tRec(LABEL_KEY[answer])}</span>
          </label>
        ))}
      </div>

      {value.answer === 'never' && (
        <p className="mt-1 text-xs text-text-muted">{tRec('create.end_never_hint')}</p>
      )}

      {value.answer === 'on-date' && (
        <div className="mt-2 flex flex-col gap-1.5">
          <label htmlFor={`${idPrefix}-end-date`} className="text-xs text-text-muted">
            {tRec('create.repeat_until')}
          </label>
          <div className="w-44">
            <DatePicker
              id={`${idPrefix}-end-date`}
              value={value.endDate}
              onChange={(endDate) => onChange({ ...value, endDate })}
              min={startDate}
              label={tRec('create.repeat_until')}
            />
          </div>
        </div>
      )}

      {value.answer === 'after-count' && (
        <div className="mt-2 flex flex-col gap-1.5">
          <label htmlFor={`${idPrefix}-end-count`} className="text-xs text-text-muted">
            {tRec('create.end_count_label')}
          </label>
          <input
            id={`${idPrefix}-end-count`}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            value={value.maxOccurrences}
            onChange={(event) =>
              onChange({ ...value, maxOccurrences: sanitizeOccurrenceCount(event.target.value) })
            }
            placeholder="—"
            className="w-28 rounded-[10px] border border-border bg-card px-3 py-2 text-sm text-text outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <p className="text-xs text-text-muted">{tRec('create.end_count_hint')}</p>
        </div>
      )}
    </fieldset>
  )
}
