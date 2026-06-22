'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { updateRecurrence } from '@/app/_actions/recurrences'
import { parseMoneyInput } from '@grana/validation'
import { Drawer } from '@/components/ui/drawer'
import { MoneyAmountInput } from '@/components/ui/money-amount-input'
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
// amount / frequency / end_date / description. Account, category and movement
// type are fixed at creation and intentionally absent here (see the
// recurrence-detail-rework design). On a successful save the drawer closes and
// the RSC page is refreshed so the read-only summary reflects the new values.
export const RecurrenceEditDrawer = ({ rule, open, onClose }: Props) => {
  const router = useRouter()
  const t = useTranslations('recurrences')
  const tCommon = useTranslations('common')
  const [isPending, startTransition] = useTransition()
  const [formError, setFormError] = useState<string | null>(null)

  const [amount, setAmount] = useState(String(rule.amount))
  const [frequency, setFrequency] = useState<FrequencyValue>(rule.frequency as FrequencyValue)
  const [endDate, setEndDate] = useState(rule.end_date ?? '')
  const [description, setDescription] = useState(rule.description ?? '')

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)

    const parsedAmount = parseMoneyInput(amount)
    if (parsedAmount === null || parsedAmount <= 0) {
      setFormError(t('errors.amount_invalid'))
      return
    }

    startTransition(async () => {
      const result = await updateRecurrence(rule.id, {
        amount: parsedAmount,
        frequency,
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
          <MoneyAmountInput
            id="amount"
            required
            value={amount}
            onChange={setAmount}
            className={fieldClass}
            style={{ backgroundColor: FIELD_BG }}
          />
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
