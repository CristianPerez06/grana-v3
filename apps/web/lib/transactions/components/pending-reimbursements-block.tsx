'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { Check, ChevronDown, Undo2, X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { formatARS, formatUSD } from '@grana/i18n-messages'
import { parseMoneyInput } from '@grana/validation'
import { confirmReimbursement, cancelReimbursement } from '@/app/_actions/reimbursements'
import { useShowCents } from '@/lib/preferences-context'
import { translateCategoryLabel } from '@/lib/categories/display'
import { Button } from '@/components/ui/button'
import { MoneyAmountInput } from '@/components/ui/money-amount-input'
import { DatePicker } from '@/components/ui/date-picker'
import { invalidateAfterReimbursementMutation } from '../invalidation'
import type { PendingReimbursementVM } from '../queries'

type Props = {
  pending: PendingReimbursementVM[]
  /** Financial "today" (AR) for the default received date. */
  todayISO: string
}

export const PendingReimbursementsBlock = ({ pending, todayISO }: Props) => {
  const router = useRouter()
  const queryClient = useQueryClient()
  const showCents = useShowCents()
  const t = useTranslations('transactions')
  const tRoot = useTranslations()
  const [isPending, startTransition] = useTransition()

  const [activeId, setActiveId] = useState<string | null>(null)
  const [amountById, setAmountById] = useState<Record<string, string>>({})
  const [dateById, setDateById] = useState<Record<string, string>>({})
  const [errorById, setErrorById] = useState<Record<string, string>>({})
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  // Collapsible, like the pending-recurrences hub: open with one pending
  // reintegro, collapsed with several so it stays a thin header above the chart.
  const [isOpen, setIsOpen] = useState(pending.length <= 1)

  if (pending.length === 0 && !successMessage) return null

  const format = (amount: number, currency: 'ARS' | 'USD') =>
    currency === 'ARS' ? formatARS(amount, showCents) : formatUSD(amount, showCents)

  const handleConfirm = (r: PendingReimbursementVM) => {
    setErrorById((prev) => ({ ...prev, [r.id]: '' }))
    const parsed = parseMoneyInput(amountById[r.id] ?? String(r.estimatedAmount))
    if (parsed === null || parsed <= 0) {
      setErrorById((prev) => ({ ...prev, [r.id]: t('reimbursement.errors.amount_positive') }))
      return
    }
    setActiveId(r.id)
    startTransition(async () => {
      // For a statement reimbursement the server derives the card period from
      // this date (defaults to the consumption date; the user can change it).
      const result = await confirmReimbursement({
        id: r.id,
        amount: parsed,
        date: dateById[r.id] ?? r.expenseDate ?? todayISO,
      })
      setActiveId(null)
      if (!result.ok) {
        setErrorById((prev) => ({ ...prev, [r.id]: result.formError ?? t('errors.save_failed') }))
        return
      }
      setSuccessMessage(t('reimbursement.pending.confirmed_success'))
      invalidateAfterReimbursementMutation(queryClient)
      router.refresh()
    })
  }

  const handleCancel = (r: PendingReimbursementVM) => {
    setErrorById((prev) => ({ ...prev, [r.id]: '' }))
    setActiveId(r.id)
    startTransition(async () => {
      const result = await cancelReimbursement({ id: r.id })
      setActiveId(null)
      if (!result.ok) {
        setErrorById((prev) => ({ ...prev, [r.id]: result.formError ?? t('errors.save_failed') }))
        return
      }
      setSuccessMessage(t('reimbursement.pending.cancelled_success'))
      invalidateAfterReimbursementMutation(queryClient)
      router.refresh()
    })
  }

  return (
    <section
      className="overflow-hidden rounded-[22px] border bg-card"
      style={{ borderColor: '#C7D8E2', boxShadow: '0 0 0 4px rgba(58,107,138,0.06)' }}
    >
      {/* Notice header — collapsible toggle. Slate accent (informational), to
          read as distinct from the golden pending-recurrences hub above. */}
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-expanded={isOpen}
        className="flex w-full items-center gap-3.5 px-6 pb-4 pt-5 text-left transition-colors hover:bg-page/40"
      >
        <span
          className="flex size-11 shrink-0 items-center justify-center rounded-[13px]"
          style={{ backgroundColor: 'var(--slate-soft)', color: 'var(--slate)' }}
        >
          <Undo2 className="size-[22px]" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-[18px] font-extrabold tracking-[-0.02em] text-text">
            {t('reimbursement.pending.title')}
          </h2>
          <p className="mt-0.5 text-sm font-medium text-text-muted">
            {t('reimbursement.pending.subtitle')}
          </p>
        </div>
        {pending.length > 0 && (
          <span
            className="shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-bold"
            style={{ backgroundColor: 'var(--slate-soft)', color: 'var(--slate)' }}
          >
            {t('reimbursement.pending.count', { count: pending.length })}
          </span>
        )}
        <ChevronDown
          className={`size-5 shrink-0 text-text-muted transition-transform ${isOpen ? '' : '-rotate-90'}`}
          aria-hidden
        />
      </button>

      {isOpen && successMessage && (
        <div className="mx-6 mb-3 flex items-center justify-between gap-2 rounded-[12px] border border-emerald/30 bg-[var(--emerald-soft)] px-3 py-2 text-sm font-medium text-emerald-deep">
          <span className="flex items-center gap-2">
            <Check className="size-4" aria-hidden />
            {successMessage}
          </span>
          <button
            type="button"
            onClick={() => setSuccessMessage(null)}
            className="text-emerald-deep/70 hover:text-emerald-deep"
            aria-label={t('reimbursement.pending.close_notice')}
          >
            <X size={14} />
          </button>
        </div>
      )}

      {isOpen && (pending.length === 0 ? (
        <div
          className="flex items-center gap-3.5 border-t px-6 py-6 text-[15px] font-semibold text-emerald-deep"
          style={{ borderColor: 'var(--border-soft)' }}
        >
          <Check className="size-5 shrink-0" aria-hidden />
          {t('reimbursement.pending.all_clear')}
        </div>
      ) : (
      <ul className="flex flex-col">
        {pending.map((r) => {
          const busy = isPending && activeId === r.id
          const error = errorById[r.id]
          const primary =
            r.expenseDescription ??
            translateCategoryLabel(
              r.categoryName,
              r.categoryCanonicalName,
              r.categoryIsSystem,
              tRoot,
            ) ??
            t('reimbursement.label')
          const targetLabel = t(`reimbursement.target.${r.target}`)

          return (
            <li
              key={r.id}
              className="flex flex-col gap-2 border-t px-6 py-4"
              style={{ borderColor: 'var(--border-soft)' }}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  {r.categoryIcon && (
                    <span
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-sm"
                      style={{ backgroundColor: `${r.categoryColor ?? '#888'}1A` }}
                    >
                      {r.categoryIcon}
                    </span>
                  )}
                  <div className="flex flex-col min-w-0">
                    <span className="truncate text-sm font-medium">{primary}</span>
                    <span className="truncate text-xs text-muted-foreground">
                      {targetLabel}
                      {r.accountName ? ` · ${r.accountName}` : ''}
                    </span>
                  </div>
                </div>
                <span className="text-sm font-semibold text-pending tabular-nums">
                  +{format(r.estimatedAmount, r.currencyCode)}
                </span>
              </div>

              <div className="flex flex-wrap items-end gap-2">
                <div className="flex flex-col gap-1">
                  <label htmlFor={`reimb-amount-${r.id}`} className="text-[11px] text-muted-foreground">
                    {t('reimbursement.pending.real_amount')}
                  </label>
                  <MoneyAmountInput
                    id={`reimb-amount-${r.id}`}
                    value={amountById[r.id] ?? String(r.estimatedAmount)}
                    onChange={(v) => setAmountById((prev) => ({ ...prev, [r.id]: v }))}
                    className="w-28 rounded-md border border-input bg-background px-2 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label htmlFor={`reimb-date-${r.id}`} className="text-[11px] text-muted-foreground">
                    {t('reimbursement.pending.real_date')}
                  </label>
                  <DatePicker
                    id={`reimb-date-${r.id}`}
                    value={dateById[r.id] ?? r.expenseDate ?? todayISO}
                    onChange={(v) => setDateById((prev) => ({ ...prev, [r.id]: v }))}
                    label={t('reimbursement.pending.real_date')}
                  />
                </div>
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  className="w-auto"
                  onClick={() => handleConfirm(r)}
                  disabled={busy}
                  loading={busy}
                >
                  {t('reimbursement.confirm')}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="w-auto"
                  onClick={() => handleCancel(r)}
                  disabled={busy}
                >
                  {t('reimbursement.cancel')}
                </Button>
              </div>

              {error && <p className="text-xs text-destructive">{error}</p>}
            </li>
          )
        })}
      </ul>
      ))}
    </section>
  )
}
