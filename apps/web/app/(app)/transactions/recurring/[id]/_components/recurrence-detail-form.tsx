'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
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

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={handlePauseToggle}
          disabled={isPending || isDeleted}
          className="rounded-md border border-border px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:border-foreground disabled:opacity-50"
        >
          {isPaused ? t('actions.resume') : t('actions.pause')}
        </button>
        <button
          type="button"
          onClick={handleDelete}
          disabled={isPending || isDeleted}
          className="rounded-md border border-destructive/40 px-3 py-1.5 text-sm font-medium text-destructive hover:bg-destructive/5 disabled:opacity-50"
        >
          {t('actions.delete')}
        </button>
      </div>

      {formSuccess && (
        <div className="rounded-md border border-green-600/40 bg-green-600/10 px-3 py-2 text-sm text-green-700 dark:text-green-400">
          {formSuccess}
        </div>
      )}
      {formError && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {formError}
        </div>
      )}

      <form onSubmit={handleSave} className="flex flex-col gap-5">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="amount" className="text-sm font-medium">
            {t('labels.amount')}
          </label>
          <MoneyAmountInput
            id="amount"
            required
            value={amount}
            onChange={setAmount}
            disabled={isDeleted}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="frequency" className="text-sm font-medium">
            {t('labels.frequency')}
          </label>
          <select
            id="frequency"
            value={frequency}
            onChange={(e) =>
              setFrequency(e.target.value as typeof frequency)
            }
            disabled={isDeleted}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          >
            {FREQUENCY_VALUES.map((value) => (
              <option key={value} value={value}>
                {t(`frequencies.${value}`)}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="end_date" className="text-sm font-medium">
            {t('labels.end_date')}{' '}
            <span className="text-muted-foreground text-xs">{tCommon('optional')}</span>
          </label>
          <input
            id="end_date"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            disabled={isDeleted}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="description" className="text-sm font-medium">
            {t('labels.description')}{' '}
            <span className="text-muted-foreground text-xs">{tCommon('optional')}</span>
          </label>
          <input
            id="description"
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={isDeleted}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          />
        </div>

        <button
          type="submit"
          disabled={isPending || isDeleted}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {isPending ? tCommon('saving') : t('actions.save_changes')}
        </button>
      </form>
    </div>
  )
}
