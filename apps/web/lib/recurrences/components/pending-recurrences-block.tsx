'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Clock, Pencil, Repeat, X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { formatDateISO, getTodayAR } from '@/lib/date'
import {
  confirmRecurrenceInstance,
  skipRecurrenceInstance,
} from '@/app/_actions/recurrences'
import { formatARS, formatUSD } from '@grana/i18n-messages'
import { useShowCents } from '@/lib/preferences-context'
import { parseMoneyInput } from '@grana/validation'
import { MoneyAmountInput } from '@/components/ui/money-amount-input'
import { checkNegativeBalance } from '@/lib/transactions/negative-balance-warning'
import { NegativeBalanceNotice } from '@/lib/transactions/components/negative-balance-notice'
import type { PendingRecurrenceInstance } from '@/lib/recurrences/types'

type Props = {
  pending: PendingRecurrenceInstance[]
  /** Current available balance per account+currency, for the soft warning. */
  availableByAccount?: Record<string, Record<'ARS' | 'USD', number>>
}

const isCardExpenseUSD = (instance: PendingRecurrenceInstance) =>
  instance.recurrence.movement_type === 'expense' &&
  instance.account?.type === 'credit' &&
  instance.currency_code === 'USD'

export const PendingRecurrencesBlock = ({ pending, availableByAccount }: Props) => {
  const router = useRouter()
  const showCents = useShowCents()
  const [isPending, startTransition] = useTransition()
  const t = useTranslations('recurrences')
  const tTx = useTranslations('transactions')

  // Urgency relative to today (accounting date). Drives the colored "Vence hoy /
  // Vencido hace N días / Vence en N días" line on each pending row.
  const todayISO = formatDateISO(getTodayAR())
  const daysBetween = (fromISO: string, toISO: string) => {
    const [ay, am, ad] = fromISO.split('-').map(Number)
    const [by, bm, bd] = toISO.split('-').map(Number)
    return Math.round(
      (Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86_400_000,
    )
  }
  const urgencyOf = (scheduledISO: string): { label: string; overdue: boolean } => {
    const diff = daysBetween(todayISO, scheduledISO)
    if (diff < 0) return { label: t('pending.overdue', { count: -diff }), overdue: true }
    if (diff === 0) return { label: t('pending.due_today'), overdue: true }
    return { label: t('pending.due_in', { count: diff }), overdue: false }
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

  // Soft, non-blocking warning: confirming this instance would leave the source
  // account's available balance negative. Off-ledger credit consumptions and
  // incomes never warn. Compared per account + currency. Uses the edited amount
  // when the instance is being edited.
  const computeWarning = (instance: PendingRecurrenceInstance) => {
    if (!availableByAccount) return null
    const movementType = instance.recurrence.movement_type
    if (movementType !== 'expense' && movementType !== 'transfer') return null
    if (movementType === 'expense' && instance.account?.type === 'credit') return null
    if (!instance.account_id) return null

    const currency = instance.currency_code as 'ARS' | 'USD'
    let amount = Number(instance.amount)
    if (editingId === instance.id) {
      const parsed = parseMoneyInput(editAmount)
      if (parsed !== null && parsed > 0) amount = parsed
    }
    const available = availableByAccount[instance.account_id]?.[currency] ?? 0
    const check = checkNegativeBalance(available, amount)
    return check.negative ? { projected: check.projected, currency } : null
  }

  return (
    <section
      className="overflow-hidden rounded-[22px] border bg-card"
      style={{ borderColor: '#EAD9A8', boxShadow: '0 0 0 4px rgba(181,138,30,0.06)' }}
    >
      {/* Hub header */}
      <div className="flex items-center gap-3.5 px-6 pb-4 pt-5">
        <span
          className="flex size-11 shrink-0 items-center justify-center rounded-[13px]"
          style={{ backgroundColor: 'var(--warning-bg)', color: 'var(--warning)' }}
        >
          <Clock className="size-[22px]" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-[18px] font-extrabold tracking-[-0.02em] text-text">{t('pending.title')}</h2>
          <p className="mt-0.5 text-sm font-medium text-text-muted">{t('pending.subtitle')}</p>
        </div>
        {pending.length > 0 && (
          <span
            className="shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-bold"
            style={{ backgroundColor: 'var(--warning-bg)', color: 'var(--warning)' }}
          >
            {t('pending.count', { count: pending.length })}
          </span>
        )}
      </div>

      {successMessage && (
        <div className="mx-6 mb-3 flex items-center justify-between gap-2 rounded-[12px] border border-emerald/30 bg-[var(--emerald-soft)] px-3 py-2 text-sm font-medium text-emerald-deep">
          <span className="flex items-center gap-2">
            <Check className="size-4" aria-hidden />
            {successMessage}
          </span>
          <button
            type="button"
            onClick={() => setSuccessMessage(null)}
            className="text-emerald-deep/70 hover:text-emerald-deep"
            aria-label={t('pending.close_notice')}
          >
            <X size={14} />
          </button>
        </div>
      )}

      {pending.length === 0 ? (
        <div
          className="flex items-center gap-3.5 border-t px-6 py-6 text-[15px] font-semibold text-emerald-deep"
          style={{ borderColor: 'var(--border-soft)' }}
        >
          <Check className="size-5 shrink-0" aria-hidden />
          {t('pending.all_clear')}
        </div>
      ) : (
      <ul className="flex flex-col">
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
          const warning = computeWarning(instance)

          const urgency = urgencyOf(instance.scheduled_date)
          const amtClass =
            instance.recurrence.movement_type === 'income'
              ? 'text-emerald-deep'
              : instance.recurrence.movement_type === 'transfer'
                ? 'text-navy'
                : 'text-terracotta'
          const amtSign = instance.recurrence.movement_type === 'income' ? '+' : instance.recurrence.movement_type === 'transfer' ? '' : '−'
          const tileColor = instance.category?.color ?? '#8C97A4'
          const tileIcon = instance.category?.icon

          return (
            <li
              key={instance.id}
              className="flex flex-col gap-3 border-t px-6 py-4"
              style={{ borderColor: 'var(--border-soft)' }}
            >
              <div className="flex items-center gap-4">
                {/* Category tile with repeat badge */}
                <span
                  className="relative flex size-[46px] shrink-0 items-center justify-center rounded-[13px] text-[21px]"
                  style={{ backgroundColor: `${tileColor}1A` }}
                >
                  {tileIcon ?? <Repeat className="size-5" style={{ color: tileColor }} aria-hidden />}
                  <span
                    className="absolute -bottom-1 -right-1 flex size-[19px] items-center justify-center rounded-full border-[1.5px] border-page bg-card text-text-muted"
                  >
                    <Repeat className="size-2.5" aria-hidden />
                  </span>
                </span>

                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="truncate text-[16px] font-bold tracking-[-0.01em] text-text">
                    {instance.description || instance.category?.name || movementLabel}
                  </span>
                  <span className="truncate text-[14px] font-medium text-text-muted">
                    {freqLabel} ·{' '}
                    {instance.recurrence.movement_type === 'transfer'
                      ? `${accountName} → ${destinationName ?? '—'}`
                      : accountName}
                  </span>
                  <span
                    className="mt-0.5 inline-flex items-center gap-1.5 text-[12px] font-extrabold uppercase tracking-[0.06em]"
                    style={{ color: urgency.overdue ? '#D9534F' : 'var(--warning)' }}
                  >
                    {urgency.overdue && (
                      <span className="size-1.5 rounded-full" style={{ backgroundColor: '#D9534F' }} />
                    )}
                    {urgency.label}
                  </span>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <span className={`text-[18px] font-bold tracking-[-0.025em] tabular-nums ${amtClass}`}>
                    {amtSign}{formatted}
                  </span>
                  {!isEditing && (
                    <button
                      type="button"
                      onClick={() => startEditing(instance)}
                      disabled={busy}
                      className="rounded-[9px] p-1.5 text-text-soft hover:bg-page hover:text-text disabled:opacity-50"
                      aria-label={t('pending.edit_aria')}
                      title={t('pending.edit_aria')}
                    >
                      <Pencil size={15} />
                    </button>
                  )}
                  {isEditing && (
                    <button
                      type="button"
                      onClick={cancelEditing}
                      disabled={busy}
                      className="rounded-[9px] p-1.5 text-text-soft hover:bg-page hover:text-text disabled:opacity-50"
                      aria-label={t('pending.cancel_edit_aria')}
                      title={t('pending.cancel_edit_aria')}
                    >
                      <X size={15} />
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

              {warning && (
                <NegativeBalanceNotice
                  projected={warning.projected}
                  currency={warning.currency}
                />
              )}

              <div className="flex gap-2.5 pl-[62px]">
                <button
                  type="button"
                  onClick={() => handleConfirm(instance)}
                  disabled={busy}
                  className="inline-flex items-center gap-1.5 rounded-[11px] bg-emerald px-4 py-2.5 text-sm font-bold text-white shadow-[0_4px_12px_rgba(16,185,129,0.28)] transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  <Check className="size-4" aria-hidden />
                  {busy ? t('pending.confirming') : t('pending.confirm')}
                </button>
                <button
                  type="button"
                  onClick={() => handleSkip(instance)}
                  disabled={busy}
                  className="inline-flex items-center gap-1.5 rounded-[11px] border border-border bg-card px-4 py-2.5 text-sm font-semibold text-text-muted transition-colors hover:bg-page hover:text-navy disabled:opacity-50"
                >
                  <X className="size-3.5" aria-hidden />
                  {t('pending.skip')}
                </button>
              </div>
            </li>
          )
        })}
      </ul>
      )}
    </section>
  )
}
