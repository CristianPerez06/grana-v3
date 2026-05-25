'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Pencil, X } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import {
  confirmRecurrenceInstance,
  skipRecurrenceInstance,
} from '@/app/_actions/recurrences'
import { formatARS, formatUSD } from '@grana/i18n-messages'
import { useShowCents } from '@/lib/preferences-context'
import { parseMoneyInput } from '@grana/validation'
import { MoneyAmountInput } from '@/components/ui/money-amount-input'
import type { PendingRecurrenceInstance } from '@/lib/recurrences/types'

type Props = {
  pending: PendingRecurrenceInstance[]
}

const isCardExpenseUSD = (instance: PendingRecurrenceInstance) =>
  instance.recurrence.movement_type === 'expense' &&
  instance.account?.type === 'credit' &&
  instance.currency_code === 'USD'

export const PendingRecurrencesBlock = ({ pending }: Props) => {
  const router = useRouter()
  const showCents = useShowCents()
  const [isPending, startTransition] = useTransition()
  const locale = useLocale()
  const t = useTranslations('recurrences')
  const tTx = useTranslations('transactions')

  const localeCode = locale === 'en' ? 'en-US' : 'es-AR'

  const formatDate = (iso: string) => {
    const [y, m, d] = iso.split('-').map(Number)
    return new Date(y, m - 1, d).toLocaleDateString(localeCode, {
      day: 'numeric',
      month: 'short',
    })
  }
  const [activeId, setActiveId] = useState<string | null>(null)
  const [fxByInstance, setFxByInstance] = useState<Record<string, string>>({})
  const [errorByInstance, setErrorByInstance] = useState<Record<string, string>>({})
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // Edit mode: at most one instance edited at a time, to keep UI focused.
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editAmount, setEditAmount] = useState('')
  const [editDate, setEditDate] = useState('')
  const [editDescription, setEditDescription] = useState('')

  if (pending.length === 0 && !successMessage) return null

  const startEditing = (instance: PendingRecurrenceInstance) => {
    setEditingId(instance.id)
    setEditAmount(String(instance.amount))
    setEditDate(instance.scheduled_date)
    setEditDescription(instance.description ?? '')
    setErrorByInstance((prev) => ({ ...prev, [instance.id]: '' }))
  }

  const cancelEditing = () => setEditingId(null)

  const handleConfirm = (instance: PendingRecurrenceInstance) => {
    setActiveId(instance.id)
    setErrorByInstance((prev) => ({ ...prev, [instance.id]: '' }))

    let fxRate: number | undefined
    if (isCardExpenseUSD(instance)) {
      const raw = fxByInstance[instance.id]?.trim()
      const parsed = raw ? Number(raw.replace(',', '.')) : NaN
      if (!parsed || parsed <= 0) {
        setErrorByInstance((prev) => ({
          ...prev,
          [instance.id]: t('errors_extra.fx_required'),
        }))
        setActiveId(null)
        return
      }
      fxRate = parsed
    }

    // Build overrides from edit state if this instance is being edited.
    const overrides: Record<string, unknown> = {}
    if (editingId === instance.id) {
      const parsedAmount = parseMoneyInput(editAmount)
      if (parsedAmount === null || parsedAmount <= 0) {
        setErrorByInstance((prev) => ({
          ...prev,
          [instance.id]: t('errors.amount_invalid'),
        }))
        setActiveId(null)
        return
      }
      if (parsedAmount !== Number(instance.amount)) {
        overrides.amount = parsedAmount
      }
      if (editDate && editDate !== instance.scheduled_date) {
        overrides.date = editDate
      }
      const trimmedDescription = editDescription.trim()
      const originalDescription = instance.description ?? ''
      if (trimmedDescription !== originalDescription) {
        overrides.description = trimmedDescription || null
      }
    }

    if (fxRate !== undefined) overrides.fx_rate_to_ars = fxRate

    startTransition(async () => {
      const result = await confirmRecurrenceInstance(instance.id, overrides)
      if (!result.ok) {
        setErrorByInstance((prev) => ({
          ...prev,
          [instance.id]: result.formError ?? t('errors_extra.confirm_failed'),
        }))
        setActiveId(null)
        return
      }
      setActiveId(null)
      setEditingId(null)
      setSuccessMessage(t('pending.confirmed_success'))
      router.refresh()
    })
  }

  const handleSkip = (instance: PendingRecurrenceInstance) => {
    setActiveId(instance.id)
    setErrorByInstance((prev) => ({ ...prev, [instance.id]: '' }))
    startTransition(async () => {
      const result = await skipRecurrenceInstance(instance.id)
      if (!result.ok) {
        setErrorByInstance((prev) => ({
          ...prev,
          [instance.id]: result.formError ?? t('errors_extra.skip_failed'),
        }))
        setActiveId(null)
        return
      }
      setActiveId(null)
      setSuccessMessage(t('pending.skipped_success'))
      router.refresh()
    })
  }

  return (
    <section className="flex flex-col gap-3 rounded-md border border-border bg-muted/30 p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold tracking-tight">
          {t('pending.title')}
        </h2>
        {pending.length > 1 && (
          <span className="text-xs text-muted-foreground">
            {t('pending.count', { count: pending.length })}
          </span>
        )}
      </div>

      {successMessage && (
        <div className="flex items-center justify-between gap-2 rounded-md border border-green-600/40 bg-green-600/10 px-3 py-2 text-sm text-green-700 dark:text-green-400">
          <span>{successMessage}</span>
          <button
            type="button"
            onClick={() => setSuccessMessage(null)}
            className="text-green-700/70 hover:text-green-700 dark:text-green-400/70 dark:hover:text-green-400"
            aria-label={t('pending.close_notice')}
          >
            <X size={14} />
          </button>
        </div>
      )}

      <ul className="flex flex-col gap-2">
        {pending.map((instance) => {
          const amount = Number(instance.amount)
          const formatted =
            instance.currency_code === 'ARS'
              ? formatARS(amount, showCents)
              : formatUSD(amount, showCents)
          const accountName = instance.account?.name ?? '—'
          const destinationName = instance.destination_account?.name
          const movementLabel =
            tTx(`types.${instance.recurrence.movement_type}` as 'types.income') ?? '—'
          const freqLabel = t(
            `frequencies.${instance.recurrence.frequency}` as 'frequencies.weekly',
          )
          const showFxInput = isCardExpenseUSD(instance)
          const error = errorByInstance[instance.id]
          const busy = isPending && activeId === instance.id
          const isEditing = editingId === instance.id

          return (
            <li
              key={instance.id}
              className="flex flex-col gap-2 rounded-md border border-border bg-background p-3"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex flex-col">
                  <span className="text-sm font-medium">
                    {instance.description ||
                      instance.category?.name ||
                      movementLabel}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {instance.recurrence.movement_type === 'transfer'
                      ? `${accountName} → ${destinationName ?? '—'}`
                      : accountName}
                    {' · '}
                    {formatDate(instance.scheduled_date)} · {freqLabel}
                  </span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-sm font-semibold">{formatted}</span>
                  {!isEditing && (
                    <button
                      type="button"
                      onClick={() => startEditing(instance)}
                      disabled={busy}
                      className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
                      aria-label={t('pending.edit_aria')}
                      title={t('pending.edit_aria')}
                    >
                      <Pencil size={14} />
                    </button>
                  )}
                  {isEditing && (
                    <button
                      type="button"
                      onClick={cancelEditing}
                      disabled={busy}
                      className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
                      aria-label={t('pending.cancel_edit_aria')}
                      title={t('pending.cancel_edit_aria')}
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              </div>

              {isEditing && (
                <div className="flex flex-col gap-2 rounded-md border border-dashed border-border p-3">
                  <div className="flex flex-col gap-1">
                    <label
                      htmlFor={`amount-${instance.id}`}
                      className="text-xs text-muted-foreground"
                    >
                      {t('labels.amount')}
                    </label>
                    <MoneyAmountInput
                      id={`amount-${instance.id}`}
                      value={editAmount}
                      onChange={setEditAmount}
                      className="rounded-md border border-input bg-background px-2 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                    <p className="text-[11px] text-muted-foreground">
                      {t('pending.amount_changes_rule')}
                    </p>
                  </div>

                  <div className="flex flex-col gap-1">
                    <label
                      htmlFor={`date-${instance.id}`}
                      className="text-xs text-muted-foreground"
                    >
                      {t('labels_extra.date')}
                    </label>
                    <input
                      id={`date-${instance.id}`}
                      type="date"
                      value={editDate}
                      onChange={(e) => setEditDate(e.target.value)}
                      className="rounded-md border border-input bg-background px-2 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label
                      htmlFor={`description-${instance.id}`}
                      className="text-xs text-muted-foreground"
                    >
                      {t('labels.description')}
                    </label>
                    <input
                      id={`description-${instance.id}`}
                      type="text"
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      placeholder={t('pending.description_placeholder')}
                      className="rounded-md border border-input bg-background px-2 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                  </div>
                </div>
              )}

              {showFxInput && (
                <div className="flex flex-col gap-1">
                  <label
                    htmlFor={`fx-${instance.id}`}
                    className="text-xs text-muted-foreground"
                  >
                    {t('pending.fx_rate_label')}
                  </label>
                  <MoneyAmountInput
                    id={`fx-${instance.id}`}
                    value={fxByInstance[instance.id] ?? ''}
                    onChange={(value) =>
                      setFxByInstance((prev) => ({
                        ...prev,
                        [instance.id]: value,
                      }))
                    }
                    placeholder={t('pending.fx_rate_placeholder')}
                    className="w-32 rounded-md border border-input bg-background px-2 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </div>
              )}

              {error && (
                <p className="text-xs text-destructive">{error}</p>
              )}

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => handleConfirm(instance)}
                  disabled={busy}
                  className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {busy ? t('pending.confirming') : t('pending.confirm')}
                </button>
                <button
                  type="button"
                  onClick={() => handleSkip(instance)}
                  disabled={busy}
                  className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:border-foreground disabled:opacity-50"
                >
                  {t('pending.skip')}
                </button>
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
