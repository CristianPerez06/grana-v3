'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Check, Pause, Play, Trash2, X } from 'lucide-react'
import {
  deleteRecurrence,
  pauseRecurrence,
  resumeRecurrence,
  updateRecurrence,
} from '@/app/_actions/recurrences'
import { parseMoneyInput } from '@grana/validation'
import { MoneyAmountInput } from '@/components/ui/money-amount-input'
import type { RecurrenceDetail } from '@/lib/recurrences/types'

type FrequencyValue = 'weekly' | 'biweekly' | 'monthly' | 'annual'
const FREQUENCY_VALUES: FrequencyValue[] = ['weekly', 'biweekly', 'monthly', 'annual']

type Props = {
  rule: RecurrenceDetail
}

const FIELD_BG = '#FAFBFC'

export const RecurrenceDetailForm = ({ rule }: Props) => {
  const router = useRouter()
  const t = useTranslations('recurrences')
  const tCommon = useTranslations('common')
  const [isPending, startTransition] = useTransition()
  const [formError, setFormError] = useState<string | null>(null)
  const [formSuccess, setFormSuccess] = useState<string | null>(null)

  const [amount, setAmount] = useState(String(rule.amount))
  const [frequency, setFrequency] = useState<FrequencyValue>(
    rule.frequency as FrequencyValue,
  )
  const [endDate, setEndDate] = useState(rule.end_date ?? '')
  const [description, setDescription] = useState(rule.description ?? '')

  const isPaused = rule.status === 'paused'
  const isDeleted = rule.status === 'deleted'

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)
    setFormSuccess(null)

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
      setFormSuccess(t('messages.changes_saved'))
      router.refresh()
    })
  }

  const handlePauseToggle = () => {
    setFormError(null)
    setFormSuccess(null)
    startTransition(async () => {
      const result = isPaused
        ? await resumeRecurrence(rule.id)
        : await pauseRecurrence(rule.id)
      if (!result.ok) {
        setFormError(result.formError ?? t('errors.status_change_failed'))
        return
      }
      setFormSuccess(isPaused ? t('messages.rule_resumed') : t('messages.rule_paused'))
      router.refresh()
    })
  }

  const handleDelete = () => {
    if (!confirm(t('confirmations.delete'))) {
      return
    }
    setFormError(null)
    setFormSuccess(null)
    startTransition(async () => {
      const result = await deleteRecurrence(rule.id)
      if (!result.ok) {
        setFormError(result.formError ?? t('errors.delete_failed'))
        return
      }
      router.push('/transactions/recurring')
    })
  }

  const labelClass = 'text-[11px] font-bold uppercase tracking-[0.08em] text-text-soft'
  const fieldClass =
    'w-full rounded-[11px] border border-border bg-card px-3 py-2.5 text-[15px] font-semibold text-text outline-none transition-colors focus-visible:border-[#C9CFD7] focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50'

  return (
    <div className="flex flex-col gap-5">
      {/* Status actions */}
      <div className="flex flex-wrap items-center gap-2.5">
        <button
          type="button"
          onClick={handlePauseToggle}
          disabled={isPending || isDeleted}
          className="inline-flex items-center gap-1.5 rounded-[11px] border border-border bg-card px-3.5 py-2 text-sm font-semibold text-text-muted transition-colors hover:bg-page hover:text-navy disabled:opacity-50"
        >
          {isPaused ? <Play className="size-4" aria-hidden /> : <Pause className="size-4" aria-hidden />}
          {isPaused ? t('actions.resume') : t('actions.pause')}
        </button>
        <button
          type="button"
          onClick={handleDelete}
          disabled={isPending || isDeleted}
          className="inline-flex items-center gap-1.5 rounded-[11px] border border-terracotta/40 px-3.5 py-2 text-sm font-semibold text-terracotta transition-colors hover:bg-terracotta-soft disabled:opacity-50"
        >
          <Trash2 className="size-4" aria-hidden />
          {t('actions.delete')}
        </button>
      </div>

      {formSuccess && (
        <div className="flex items-center justify-between gap-2 rounded-[12px] border border-emerald/30 bg-[var(--emerald-soft)] px-3.5 py-2.5 text-sm font-medium text-emerald-deep">
          <span className="flex items-center gap-2">
            <Check className="size-4" aria-hidden />
            {formSuccess}
          </span>
          <button
            type="button"
            onClick={() => setFormSuccess(null)}
            className="text-emerald-deep/70 hover:text-emerald-deep"
            aria-label={tCommon('cancel')}
          >
            <X size={14} />
          </button>
        </div>
      )}
      {formError && (
        <div className="rounded-[12px] border border-terracotta/40 bg-terracotta-soft px-3.5 py-2.5 text-sm font-medium text-terracotta">
          {formError}
        </div>
      )}

      {/* Edit form in a hi-fi card */}
      <form onSubmit={handleSave} className="flex flex-col gap-4">
        <div className="flex flex-col gap-4 rounded-[15px] border border-border bg-card p-5">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="amount" className={labelClass}>
              {t('labels.amount')}
            </label>
            <MoneyAmountInput
              id="amount"
              required
              value={amount}
              onChange={setAmount}
              disabled={isDeleted}
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
              onChange={(e) => setFrequency(e.target.value as typeof frequency)}
              disabled={isDeleted}
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
            <input
              id="end_date"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              disabled={isDeleted}
              className={fieldClass}
              style={{ backgroundColor: FIELD_BG }}
            />
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
              disabled={isDeleted}
              className={fieldClass}
              style={{ backgroundColor: FIELD_BG }}
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={isPending || isDeleted}
          className="inline-flex h-[48px] items-center justify-center rounded-[14px] bg-emerald px-5 text-[15px] font-bold text-white shadow-[0_8px_20px_-4px_rgba(16,185,129,0.35)] transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {isPending ? tCommon('saving') : t('actions.save_changes')}
        </button>
      </form>
    </div>
  )
}
