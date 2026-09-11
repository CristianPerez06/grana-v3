'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { updateRecurrence } from '@/app/_actions/recurrences'
import { parseMoneyInput } from '@grana/validation'
import { referenceDateChoice } from '@grana/recurrences'
import { formatDateISO, getTodayAR } from '@grana/money-logic'
import { presetToInterval } from '@grana/money-logic'
import { formatShortDate } from '@/lib/date'
import { Drawer } from '@/components/ui/drawer'
import { MoneyAmountInput } from '@/components/ui/money-amount-input'
import { MoneyCalculatorPopover } from '@/components/ui/money-calculator-popover'
import { DatePicker } from '@/components/ui/date-picker'
import type { RecurrenceDetail } from '@/lib/recurrences/types'

type FrequencyValue = 'weekly' | 'biweekly' | 'monthly' | 'annual'
const FREQUENCY_VALUES: FrequencyValue[] = ['weekly', 'biweekly', 'monthly', 'annual']

type Props = {
  rule: RecurrenceDetail
  open: boolean
  onClose: () => void
}

const FIELD_BG = '#FAFBFC'

// Edit drawer for a recurring rule. Edits only the mutable field set —
// amount / frequency / reference date / end_date / description. Account,
// category and movement type are fixed at creation and intentionally absent
// here (see the recurrence-detail-rework design). On a successful save the drawer closes and
// the RSC page is refreshed so the read-only summary reflects the new values.
export const RecurrenceEditDrawer = ({ rule, open, onClose }: Props) => {
  const router = useRouter()
  const t = useTranslations('recurrences')
  const tCommon = useTranslations('common')
  const [isPending, startTransition] = useTransition()
  const [formError, setFormError] = useState<string | null>(null)

  const [amount, setAmount] = useState(String(rule.amount))
  const [frequency, setFrequency] = useState<FrequencyValue>(rule.frequency as FrequencyValue)
  // The rule's calendar anchor. A rule created from a movement inherits that
  // movement's date, and that date can be off — a salary that landed on the 8th
  // because the 10th was a holiday anchors the rule to the 8th forever.
  const [startDate, setStartDate] = useState(rule.start_date)
  const [effectiveFrom, setEffectiveFrom] = useState<string | null>(null)
  const [endDate, setEndDate] = useState(rule.end_date ?? '')
  const [description, setDescription] = useState(rule.description ?? '')

  const anchorMoved = startDate !== rule.start_date
  // THE CALENDAR BEING SAVED, not the one on the row. The server recomputes the
  // dates it will accept from the patch, so a form that offers dates from the
  // stored frequency offers dates the server refuses — which is what happens the
  // moment somebody changes the frequency and the reference date in one pass.
  const interval = presetToInterval(frequency)
  const choice = referenceDateChoice(
    {
      status: rule.status,
      interval_count: interval.count,
      interval_unit: interval.unit,
      end_date: endDate || null,
      max_occurrences: rule.max_occurrences,
      positionsSpent: rule.positions_spent,
    },
    startDate,
    formatDateISO(getTodayAR()),
  )

  // THE ANSWER HAS TO BE ONE OF THE QUESTIONS CURRENTLY ON SCREEN. Editing the
  // reference date, the frequency or the end date rebuilds the options; a
  // selection made against the previous set is not an answer to this one, and
  // sending it means sending a date the server never offered. Derived rather
  // than reset from an effect: there is no moment where the two disagree.
  const options = choice.kind === 'ask' ? choice.options : []
  const selected = effectiveFrom != null && options.includes(effectiveFrom) ? effectiveFrom : null

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)

    const parsedAmount = parseMoneyInput(amount)
    if (parsedAmount === null || parsedAmount <= 0) {
      setFormError(t('errors.amount_invalid'))
      return
    }

    // A rule with nothing left ahead has no date that could be the first under a
    // new reference, and the database refuses the change for exactly that
    // reason. Saying so here is the difference between a sentence the user can
    // act on and a failed save they have to interpret.
    if (anchorMoved && choice.kind === 'exhausted') {
      setFormError(t('reference_date_exhausted'))
      return
    }

    // Asked, and unanswered. Picking the first option on the user's behalf is
    // the inference this whole change exists to remove: from the data, "the
    // cycle in flight is settled" and "it is not" look identical.
    if (anchorMoved && choice.kind === 'ask' && selected == null) {
      setFormError(t('errors.reference_date_unanswered'))
      return
    }

    startTransition(async () => {
      const result = await updateRecurrence(rule.id, {
        amount: parsedAmount,
        frequency,
        start_date: startDate,
        // Only meaningful when the anchor moves; the mutation ignores it
        // otherwise. `null` is the paused rule's answer — from today, waiting —
        // and the database refuses a date there.
        schedule_effective_from: anchorMoved && choice.kind === 'ask' ? selected : null,
        end_date: endDate || null,
        description: description || null,
      })
      if (!result.ok) {
        setFormError(result.formError ?? t('errors.save_failed'))
        return
      }
      onClose()
      router.refresh()
    })
  }

  const labelClass = 'text-[11px] font-bold uppercase tracking-[0.08em] text-text-soft'
  const fieldClass =
    'w-full rounded-[11px] border border-border bg-card px-3 py-2.5 text-[15px] font-semibold text-text outline-none transition-colors focus-visible:border-[#C9CFD7] focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50'

  return (
    <Drawer open={open} onClose={onClose} ariaLabel={t('edit_title')}>
      <form onSubmit={handleSave} className="flex flex-col gap-4 p-5">
        <h2 className="text-[16px] font-bold text-text">{t('edit_title')}</h2>

        {formError && (
          <div className="rounded-[12px] border border-terracotta/40 bg-terracotta-soft px-3.5 py-2.5 text-sm font-medium text-terracotta">
            {formError}
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <label htmlFor="amount" className={labelClass}>
            {t('labels.amount')}
          </label>
          <div className="relative flex items-center">
            <MoneyAmountInput
              id="amount"
              required
              value={amount}
              onChange={setAmount}
              className={`${fieldClass} pr-11`}
              style={{ backgroundColor: FIELD_BG }}
            />
            <MoneyCalculatorPopover
              seed={amount}
              onResult={setAmount}
              className="absolute right-1.5 top-1/2 -translate-y-1/2"
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="frequency" className={labelClass}>
            {t('labels.frequency')}
          </label>
          <select
            id="frequency"
            value={frequency}
            onChange={(e) => setFrequency(e.target.value as FrequencyValue)}
            className={fieldClass}
            style={{ backgroundColor: FIELD_BG }}
          >
            {FREQUENCY_VALUES.map((value) => (
              <option key={value} value={value}>
                {t(`frequencies.${value}`)}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="start_date" className={labelClass}>
            {t('labels.reference_date')}
          </label>
          <DatePicker
            id="start_date"
            value={startDate}
            onChange={setStartDate}
            label={t('labels.reference_date')}
          />
          {/* What the user cannot deduce: the change rules from here on, and the
              occurrences that already exist keep their own date — an old one
              sitting on the old day is not a bug. It deliberately does NOT say
              what to do with it: confirming or skipping it is the user's call. */}
          <p className="text-[12px] text-text-soft">{t('reference_date_hint')}</p>
        </div>

        {/* THE AMBIGUITY IS THE USER'S TO RESOLVE, and only when the anchor
            actually moves. The cycle in flight may already be settled — in which
            case the corrected schedule has to rule from the NEXT one, or the
            month gets a second salary — or it may not be, and then it rules now.
            From the data both look the same. Two concrete dates, never the word
            "month": a rule every three days has none. */}
        {anchorMoved && choice.kind === 'ask' && (
          <div className="flex flex-col gap-2 rounded-xl border border-border bg-surface-soft px-4 py-3">
            <p className="text-[13px] font-semibold text-text">{t('reference_date_question')}</p>
            <div className="flex flex-col gap-1.5">
              {choice.options.map((option) => (
                <label key={option} className="flex items-center gap-2 text-[13px] text-text">
                  <input
                    type="radio"
                    name="schedule_effective_from"
                    value={option}
                    checked={selected === option}
                    onChange={() => setEffectiveFrom(option)}
                  />
                  {formatShortDate(option)}
                </label>
              ))}
            </div>
          </div>
        )}
        {anchorMoved && choice.kind === 'paused' && (
          <p className="text-[12px] text-text-soft">{t('reference_date_paused')}</p>
        )}
        {anchorMoved && choice.kind === 'exhausted' && (
          <p className="text-[12px] text-text-soft">{t('reference_date_exhausted')}</p>
        )}

        <div className="flex flex-col gap-1.5">
          <label htmlFor="end_date" className={labelClass}>
            {t('labels.end_date')}{' '}
            <span className="font-normal normal-case tracking-normal text-text-soft">
              {tCommon('optional')}
            </span>
          </label>
          <DatePicker id="end_date" value={endDate} onChange={setEndDate} label={t('labels.end_date')} />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="description" className={labelClass}>
            {t('labels.description')}{' '}
            <span className="font-normal normal-case tracking-normal text-text-soft">
              {tCommon('optional')}
            </span>
          </label>
          <input
            id="description"
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className={fieldClass}
            style={{ backgroundColor: FIELD_BG }}
          />
        </div>

        <div className="mt-1 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="h-[44px] rounded-[12px] border border-border bg-card px-4 text-[14px] font-medium text-text-muted transition-colors hover:text-text disabled:opacity-50"
          >
            {tCommon('cancel')}
          </button>
          <button
            type="submit"
            disabled={isPending}
            className="inline-flex h-[44px] items-center justify-center rounded-[12px] bg-emerald px-5 text-[14px] font-bold text-white shadow-[0_8px_20px_-4px_rgba(16,185,129,0.35)] transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {isPending ? tCommon('saving') : t('actions.save_changes')}
          </button>
        </div>
      </form>
    </Drawer>
  )
}
