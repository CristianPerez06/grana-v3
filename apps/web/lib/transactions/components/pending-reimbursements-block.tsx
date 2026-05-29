'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { formatARS, formatUSD } from '@grana/i18n-messages'
import { parseMoneyInput } from '@grana/validation'
import { confirmReimbursement, cancelReimbursement } from '@/app/_actions/reimbursements'
import { useShowCents } from '@/lib/preferences-context'
import { MoneyAmountInput } from '@/components/ui/money-amount-input'
import type { PendingReimbursementVM } from '../queries'

type Props = {
  pending: PendingReimbursementVM[]
  /** Financial "today" (AR) for the default received date. */
  todayISO: string
}

export const PendingReimbursementsBlock = ({ pending, todayISO }: Props) => {
  const router = useRouter()
  const showCents = useShowCents()
  const t = useTranslations('transactions')
  const [isPending, startTransition] = useTransition()

  const [activeId, setActiveId] = useState<string | null>(null)
  const [amountById, setAmountById] = useState<Record<string, string>>({})
  const [dateById, setDateById] = useState<Record<string, string>>({})
  const [errorById, setErrorById] = useState<Record<string, string>>({})
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

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
      router.refresh()
    })
  }

  return (
    <section className="flex flex-col gap-3 rounded-md border border-border bg-muted/30 p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold tracking-tight">{t('reimbursement.pending.title')}</h2>
        {pending.length > 1 && (
          <span className="text-xs text-muted-foreground">
            {t('reimbursement.pending.count', { count: pending.length })}
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
            aria-label={t('reimbursement.pending.close_notice')}
          >
            <X size={14} />
          </button>
        </div>
      )}

      <ul className="flex flex-col gap-2">
        {pending.map((r) => {
          const busy = isPending && activeId === r.id
          const error = errorById[r.id]
          const primary = r.expenseDescription ?? r.categoryName ?? t('reimbursement.label')
          const targetLabel = t(`reimbursement.target.${r.target}`)

          return (
            <li
              key={r.id}
              className="flex flex-col gap-2 rounded-md border border-border bg-background p-3"
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
                  <input
                    id={`reimb-date-${r.id}`}
                    type="date"
                    value={dateById[r.id] ?? r.expenseDate ?? todayISO}
                    onChange={(e) => setDateById((prev) => ({ ...prev, [r.id]: e.target.value }))}
                    className="rounded-md border border-input bg-background px-2 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => handleConfirm(r)}
                  disabled={busy}
                  className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {busy ? t('reimbursement.pending.confirming') : t('reimbursement.confirm')}
                </button>
                <button
                  type="button"
                  onClick={() => handleCancel(r)}
                  disabled={busy}
                  className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:border-foreground disabled:opacity-50"
                >
                  {t('reimbursement.cancel')}
                </button>
              </div>

              {error && <p className="text-xs text-destructive">{error}</p>}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
