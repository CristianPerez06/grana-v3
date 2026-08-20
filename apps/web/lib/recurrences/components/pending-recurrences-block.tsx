'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { Check, ChevronDown, Clock, Pencil, Repeat, Users, X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { formatDateISO, getTodayAR } from '@/lib/date'
import { getCategoryName } from '@/lib/categories/display'
import {
  confirmRecurrenceInstance,
  skipRecurrenceInstance,
} from '@/app/_actions/recurrences'
import { formatARS, formatUSD } from '@grana/i18n-messages'
import { useShowCents } from '@/lib/preferences-context'
import { parseMoneyInput } from '@grana/validation'
import { Button } from '@/components/ui/button'
import { AccountAvatar } from '@/components/ui/account-avatar'
import { Popover } from '@/components/ui/popover'
import { MoneyAmountInput } from '@/components/ui/money-amount-input'
import { MoneyCalculatorPopover } from '@/components/ui/money-calculator-popover'
import { DatePicker } from '@/components/ui/date-picker'
import { checkNegativeBalance } from '@/lib/transactions/negative-balance-warning'
import { NegativeBalanceNotice } from '@/lib/transactions/components/negative-balance-notice'
import { invalidateAfterRecurrenceInstanceMutation } from '@/lib/transactions/invalidation'
import type { MovementFormAccount } from '@grana/movement-form'
import type { PendingRecurrenceInstance } from '@/lib/recurrences/types'

type Props = {
  pending: PendingRecurrenceInstance[]
  /**
   * Accounts the user can confirm an instance with (active ones only). Omitted
   * while the read is in flight — the account field then stays read-only.
   */
  accounts?: MovementFormAccount[]
  /** Current available balance per account+currency, for the soft warning. */
  availableByAccount?: Record<string, Record<'ARS' | 'USD', number>>
}


export const PendingRecurrencesBlock = ({
  pending,
  accounts,
  availableByAccount,
}: Props) => {
  const router = useRouter()
  const queryClient = useQueryClient()
  const showCents = useShowCents()
  const [isPending, startTransition] = useTransition()
  const t = useTranslations('recurrences')
  const tTx = useTranslations('transactions')
  const tRoot = useTranslations()

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
  const [errorByInstance, setErrorByInstance] = useState<Record<string, string>>({})
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  // Collapsible, like the recurrence-suggestion banner: open with one pending
  // instance, collapsed with several so it stays a thin header above the card.
  const [isOpen, setIsOpen] = useState(pending.length <= 1)

  // Edit mode: at most one instance edited at a time, to keep UI focused.
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editAmount, setEditAmount] = useState('')
  const [editDate, setEditDate] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editAccountId, setEditAccountId] = useState('')
  const [accountPickerOpen, setAccountPickerOpen] = useState(false)

  if (pending.length === 0 && !successMessage) return null

  // Accounts this instance can be confirmed with. The currency is fixed by the
  // instance (bimoneda: never mixed), and the movement type rules out families:
  // income and the source of a transfer can't be a credit card, and a transfer
  // can't leave from its own destination. Mirrors what the server revalidates.
  const eligibleAccountsFor = (
    instance: PendingRecurrenceInstance,
  ): MovementFormAccount[] => {
    if (!accounts) return []
    const currency = instance.currency_code as 'ARS' | 'USD'
    const movementType = instance.recurrence.movement_type
    return accounts.filter((account) => {
      if (!account.activeCurrencies.includes(currency)) return false
      if (movementType !== 'expense' && account.type === 'credit') return false
      if (
        movementType === 'transfer' &&
        account.id === instance.transfer_destination_account_id
      ) {
        return false
      }
      return true
    })
  }

  // The rule points at an account that is no longer selectable (archived). The
  // embed still resolves its name, so the row reads fine — but confirming as-is
  // fails, and the way out is picking another account, not editing the rule.
  const isAccountUnavailable = (instance: PendingRecurrenceInstance) =>
    Boolean(accounts && instance.account_id) &&
    !accounts?.some((account) => account.id === instance.account_id)

  const startEditing = (instance: PendingRecurrenceInstance) => {
    setEditingId(instance.id)
    setEditAmount(String(instance.amount))
    setEditDate(instance.scheduled_date)
    setEditDescription(instance.description ?? '')
    // An unavailable account starts empty so the user has to pick a valid one.
    setEditAccountId(isAccountUnavailable(instance) ? '' : instance.account_id ?? '')
    setAccountPickerOpen(false)
    setErrorByInstance((prev) => ({ ...prev, [instance.id]: '' }))
  }

  const cancelEditing = () => {
    setEditingId(null)
    setAccountPickerOpen(false)
  }

  const handleConfirm = (instance: PendingRecurrenceInstance) => {
    setActiveId(instance.id)
    setErrorByInstance((prev) => ({ ...prev, [instance.id]: '' }))

    // Cotización is no longer collected here: USD card consumos convert at
    // statement-payment time (payment-day rate).

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
      // Account is an override of THIS instance only — the rule keeps its own.
      if (!editAccountId) {
        setErrorByInstance((prev) => ({
          ...prev,
          [instance.id]: t('pending.account_required'),
        }))
        setActiveId(null)
        return
      }
      if (editAccountId !== instance.account_id) {
        overrides.account_id = editAccountId
      }
    }

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
      invalidateAfterRecurrenceInstanceMutation(queryClient, { confirmed: true })
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
      invalidateAfterRecurrenceInstanceMutation(queryClient, { confirmed: false })
      router.refresh()
    })
  }

  // Soft, non-blocking warning: confirming this instance would leave the source
  // account's available balance negative. Off-ledger credit consumptions and
  // incomes never warn. Compared per account + currency. Uses the edited amount
  // and the edited ACCOUNT when the instance is being edited — switching to a
  // credit card drops the warning, switching to a thinner account can raise it.
  const computeWarning = (instance: PendingRecurrenceInstance) => {
    if (!availableByAccount) return null
    const movementType = instance.recurrence.movement_type
    if (movementType !== 'expense' && movementType !== 'transfer') return null

    const isEditing = editingId === instance.id
    const accountId = isEditing ? editAccountId : instance.account_id
    if (!accountId) return null
    const accountType = isEditing
      ? accounts?.find((a) => a.id === accountId)?.type
      : instance.account?.type
    if (movementType === 'expense' && accountType === 'credit') return null

    const currency = instance.currency_code as 'ARS' | 'USD'
    let amount = Number(instance.amount)
    if (isEditing) {
      const parsed = parseMoneyInput(editAmount)
      if (parsed !== null && parsed > 0) amount = parsed
    }
    const available = availableByAccount[accountId]?.[currency] ?? 0
    const check = checkNegativeBalance(available, amount)
    return check.negative ? { projected: check.projected, currency } : null
  }

  return (
    <section
      className="overflow-hidden rounded-[22px] border bg-card"
      style={{ borderColor: '#EAD9A8', boxShadow: '0 0 0 4px rgba(181,138,30,0.06)' }}
    >
      {/* Hub header — collapsible toggle */}
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-expanded={isOpen}
        className="flex w-full items-center gap-3 px-4 pb-3.5 pt-4 text-left transition-colors hover:bg-page/40 sm:gap-3.5 sm:px-6 sm:pb-4 sm:pt-5"
      >
        <span
          className="flex size-10 shrink-0 items-center justify-center rounded-[13px] sm:size-11"
          style={{ backgroundColor: 'var(--warning-bg)', color: 'var(--warning)' }}
        >
          <Clock className="size-5 sm:size-[22px]" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-[15px] font-extrabold leading-tight tracking-[-0.02em] text-text sm:text-[18px]">{t('pending.title')}</h2>
          <p className="mt-0.5 hidden text-sm font-medium text-text-muted sm:block">{t('pending.subtitle')}</p>
        </div>
        {pending.length > 0 && (
          <span
            className="shrink-0 rounded-full px-2.5 py-1 text-[12px] font-bold sm:px-3.5 sm:py-1.5 sm:text-[13px]"
            style={{ backgroundColor: 'var(--warning-bg)', color: 'var(--warning)' }}
          >
            {t('pending.count', { count: pending.length })}
          </span>
        )}
        <ChevronDown
          className={`size-5 shrink-0 text-text-muted transition-transform ${isOpen ? '' : '-rotate-90'}`}
          aria-hidden
        />
      </button>

      {isOpen && successMessage && (
        <div className="mx-4 mb-3 flex items-center justify-between gap-2 rounded-[12px] border border-emerald/30 bg-[var(--emerald-soft)] px-3 py-2 text-sm font-medium text-emerald-deep sm:mx-6">
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

      {isOpen && (pending.length === 0 ? (
        <div
          className="flex items-center gap-3.5 border-t px-4 py-5 text-[15px] font-semibold text-emerald-deep sm:px-6 sm:py-6"
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
          const error = errorByInstance[instance.id]
          const busy = isPending && activeId === instance.id
          const isEditing = editingId === instance.id
          const warning = computeWarning(instance)
          const eligibleAccounts = isEditing ? eligibleAccountsFor(instance) : []
          const editAccount = eligibleAccounts.find((a) => a.id === editAccountId) ?? null
          // While the accounts read is in flight the eligible list is empty, but
          // the instance's own account is still the selected one — show its name
          // from the embed instead of falling back to the placeholder.
          const editAccountFallbackName =
            !editAccount && editAccountId && editAccountId === instance.account_id
              ? instance.account?.name ?? null
              : null
          const accountUnavailable = isAccountUnavailable(instance)

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
              className="flex flex-col gap-3 border-t px-4 py-4 sm:px-6"
              style={{ borderColor: 'var(--border-soft)' }}
            >
              <div className="flex items-center gap-3 sm:gap-4">
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
                    {instance.description ||
                      (instance.category ? getCategoryName(instance.category, tRoot) : null) ||
                      movementLabel}
                  </span>
                  <span className="flex items-center gap-1.5 text-[14px] font-medium text-text-muted">
                    <span className="truncate">
                      {freqLabel} ·{' '}
                      {instance.recurrence.movement_type === 'transfer'
                        ? `${accountName} → ${destinationName ?? '—'}`
                        : accountName}
                    </span>
                    {/* Shared recurrence: confirming will split this expense with
                        the household. Same badge as the movement list. */}
                    {instance.household_id && (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-border-soft px-1.5 py-0.5 text-[11px] font-semibold text-text-muted">
                        <Users size={10} />
                        {tTx('list.shared_short')}
                      </span>
                    )}
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
                  <span className={`text-[16px] font-bold tracking-[-0.025em] tabular-nums sm:text-[18px] ${amtClass}`}>
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
                    <div className="relative flex items-center">
                      <MoneyAmountInput
                        id={`amount-${instance.id}`}
                        value={editAmount}
                        onChange={setEditAmount}
                        className="w-full rounded-md border border-input bg-background px-2 py-1 pr-10 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      />
                      <MoneyCalculatorPopover
                        seed={editAmount}
                        onResult={setEditAmount}
                        className="absolute right-1 top-1/2 size-7 -translate-y-1/2"
                      />
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      {t('pending.amount_changes_rule')}
                    </p>
                  </div>

                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-muted-foreground">
                      {t('labels.account')}
                    </span>
                    <Popover
                      open={accountPickerOpen}
                      onOpenChange={setAccountPickerOpen}
                      trigger={
                        <button
                          type="button"
                          aria-label={t('labels.account')}
                          className="flex w-full items-center gap-2.5 rounded-md border border-input bg-background px-2 py-1.5 text-left text-sm transition-colors hover:bg-page focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          {editAccount ? (
                            <>
                              {editAccount.avatar && (
                                <AccountAvatar {...editAccount.avatar} size="sm" />
                              )}
                              <span className="min-w-0 flex-1 truncate font-semibold text-text">
                                {editAccount.name}
                              </span>
                              {editAccount.type === 'credit' && (
                                <span
                                  className="shrink-0 rounded px-1 py-0.5 text-[10px] font-bold uppercase tracking-wide text-terracotta"
                                  style={{ backgroundColor: 'var(--terracotta-soft)' }}
                                >
                                  {tTx('drawer.credit_badge')}
                                </span>
                              )}
                            </>
                          ) : editAccountFallbackName ? (
                            <span className="min-w-0 flex-1 truncate font-semibold text-text">
                              {editAccountFallbackName}
                            </span>
                          ) : (
                            <span className="min-w-0 flex-1 truncate text-text-muted">
                              {t('pending.account_placeholder')}
                            </span>
                          )}
                          <ChevronDown className="size-4 shrink-0 text-text-soft" aria-hidden />
                        </button>
                      }
                    >
                      {eligibleAccounts.length === 0 ? (
                        <p className="px-2.5 py-2 text-sm text-text-muted">
                          {t('pending.account_none_eligible')}
                        </p>
                      ) : (
                        <div className="flex flex-col gap-0.5">
                          {eligibleAccounts.map((account) => (
                            <button
                              key={account.id}
                              type="button"
                              onClick={() => {
                                setEditAccountId(account.id)
                                setAccountPickerOpen(false)
                              }}
                              className="flex items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-left transition-colors hover:bg-page"
                            >
                              {account.avatar && (
                                <AccountAvatar {...account.avatar} size="sm" />
                              )}
                              <span className="flex min-w-0 flex-1 flex-col">
                                <span className="flex items-center gap-1.5 truncate text-sm font-semibold text-text">
                                  {account.name}
                                  {account.type === 'credit' && (
                                    <span
                                      className="shrink-0 rounded px-1 py-0.5 text-[10px] font-bold uppercase tracking-wide text-terracotta"
                                      style={{ backgroundColor: 'var(--terracotta-soft)' }}
                                    >
                                      {tTx('drawer.credit_badge')}
                                    </span>
                                  )}
                                </span>
                                {account.institutionName && (
                                  <span className="truncate text-xs text-text-muted">
                                    {account.institutionName}
                                  </span>
                                )}
                              </span>
                              {editAccountId === account.id && (
                                <Check className="size-4 shrink-0 text-emerald" aria-hidden />
                              )}
                            </button>
                          ))}
                        </div>
                      )}
                    </Popover>
                    <p className="text-[11px] text-muted-foreground">
                      {t('pending.account_instance_only')}
                    </p>
                  </div>

                  <div className="flex flex-col gap-1">
                    <label
                      htmlFor={`date-${instance.id}`}
                      className="text-xs text-muted-foreground"
                    >
                      {t('labels_extra.date')}
                    </label>
                    <DatePicker
                      id={`date-${instance.id}`}
                      value={editDate}
                      onChange={setEditDate}
                      label={t('labels_extra.date')}
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

              {/* The rule's account is archived: confirming as-is fails, and the
                  way out is the account field, not editing the rule. */}
              {accountUnavailable && !isEditing && (
                <p className="text-xs font-semibold text-destructive">
                  {t('pending.account_unavailable')}
                </p>
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

              <div className="flex gap-2.5 pl-[58px] sm:pl-[62px]">
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  className="w-auto"
                  onClick={() => handleConfirm(instance)}
                  disabled={busy}
                  loading={busy}
                >
                  <Check className="size-4" aria-hidden />
                  {t('pending.confirm')}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="w-auto"
                  onClick={() => handleSkip(instance)}
                  disabled={busy}
                >
                  <X className="size-3.5" aria-hidden />
                  {t('pending.skip')}
                </Button>
              </div>
            </li>
          )
        })}
      </ul>
      ))}
    </section>
  )
}
