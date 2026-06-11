'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { CreditCard, Lock, X } from 'lucide-react'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { MoneyAmountInput } from '@/components/ui/money-amount-input'
import { parseMoneyInput } from '@grana/validation'
import {
  updateCreditCard,
  deactivateCreditCardAccount,
  updatePeriodDates,
} from '@/app/_actions/credit-cards'
import { deleteAccount } from '@/app/_actions/accounts'
import { cardMonogram } from '../../_components/card-presentation'
import {
  BankSelectorField,
  CardPreview,
  DateField,
  FieldIcon,
  FieldLabel,
  Hint,
  SectionLabel,
  dayMonth,
  fmtMoney,
} from '../../_components/card-form-ui'
import { DeactivateBlockDialog } from '../../_components/deactivate-block-dialog'
import type { Institution } from '@/lib/accounts/types'

/**
 * Editable billing-cycle dates. Backend models the cycle as periods (statements),
 * not a card-level set of 4 dates: the "resumen actual" is one period and the
 * "próximo" is the next. Each pair is persisted via `updatePeriodDates`, which
 * cascades the boundary (shifting the next period's start + moving consumos) and
 * blocks edits when a period is already paid.
 */
export type EditCardCycle = {
  currentPeriodId: string | null
  currentEndDate: string | null
  currentDueDate: string | null
  /** Projected dates not yet confirmed against a statement (is_estimated). */
  currentPeriodIsEstimated?: boolean
  nextPeriodId: string | null
  nextEndDate: string | null
  nextDueDate: string | null
  nextPeriodIsPaid: boolean
  nextPeriodIsEstimated?: boolean
}

export type EditCardFormProps = {
  cardId: string
  initialName: string
  initialInstitutionId: string | null
  initialCreditLimit: number | null
  /** Display label of the (immutable) network, e.g. "Visa" / custom name. */
  networkLabel: string
  /** Network brand colour for the read-only chip, when known. */
  networkColor: string | null
  /** Backend-assigned accent colour (CSS value) for the preview avatar/stripe. */
  accent: string
  /** Committed (used) amount in ARS, to draw the live limit bar. */
  committedARS: number
  /** Editable billing-cycle dates (current + next statement). */
  cycle: EditCardCycle
  /** Governs delete (false) vs archive-only (true), per the README rule. */
  hasMovements: boolean
  institutions: Institution[]
  /** `'drawer'` renders the hi-fi shell; `'page'` renders the body inline (fallback route). */
  variant?: 'drawer' | 'page'
  /** Drawer chrome: close handler for the header ✕ / footer cancel. */
  onClose?: () => void
  /** When provided, a successful save refreshes the route and calls this instead of navigating. */
  onSuccess?: () => void
}

export const EditCardForm = ({
  cardId,
  initialName,
  initialInstitutionId,
  initialCreditLimit,
  networkLabel,
  networkColor,
  accent,
  committedARS,
  cycle,
  hasMovements,
  institutions,
  variant = 'page',
  onClose,
  onSuccess,
}: EditCardFormProps) => {
  const router = useRouter()
  const t = useTranslations('cards')
  const tCommon = useTranslations('common')
  const isDrawer = variant === 'drawer'

  const [name, setName] = useState(initialName)
  const [institutionId, setInstitutionId] = useState(initialInstitutionId ?? '')
  const [institutionSearch, setInstitutionSearch] = useState(
    institutions.find((i) => i.id === initialInstitutionId)?.name ?? '',
  )
  const [creditLimit, setCreditLimit] = useState(
    initialCreditLimit != null ? String(initialCreditLimit) : '',
  )

  // Billing-cycle dates (empty string when the corresponding period is absent).
  const [currentEnd, setCurrentEnd] = useState(cycle.currentEndDate ?? '')
  const [currentDue, setCurrentDue] = useState(cycle.currentDueDate ?? '')
  const [nextEnd, setNextEnd] = useState(cycle.nextEndDate ?? '')
  const [nextDue, setNextDue] = useState(cycle.nextDueDate ?? '')

  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  // Archive / delete share a transition + the pending-debt block dialog.
  const [isActionPending, startAction] = useTransition()
  const [blockDialogOpen, setBlockDialogOpen] = useState(false)

  // ── Derived live-preview values ─────────────────────────────────────────────
  const previewName = name.trim() || initialName
  const bankName = institutions.find((i) => i.id === institutionId)?.name ?? institutionSearch.trim()
  const monogram = cardMonogram(previewName)
  const parsedLimit = creditLimit ? parseMoneyInput(creditLimit) : null
  const limitDisplay =
    parsedLimit !== null && parsedLimit > 0 ? `$ ${fmtMoney(parsedLimit)}` : t('edit.limit_none')
  const limitPct =
    parsedLimit !== null && parsedLimit > 0
      ? Math.min(100, Math.max(0, (committedARS / parsedLimit) * 100))
      : 0
  const previewMeta =
    bankName.length > 0
      ? t('edit.preview_meta', { network: networkLabel, bank: bankName })
      : t('edit.preview_meta_no_bank', { network: networkLabel })
  const previewCloseLabel = dayMonth(currentEnd)
  const previewDueLabel = dayMonth(currentDue)

  const cycleDirty =
    currentEnd !== (cycle.currentEndDate ?? '') ||
    currentDue !== (cycle.currentDueDate ?? '') ||
    nextEnd !== (cycle.nextEndDate ?? '') ||
    nextDue !== (cycle.nextDueDate ?? '')

  const dirty =
    name.trim() !== initialName.trim() ||
    institutionId !== (initialInstitutionId ?? '') ||
    (creditLimit ? parseMoneyInput(creditLimit) : null) !== initialCreditLimit ||
    cycleDirty

  // ── Validation + persistence (name / bank / limit only — backend scope) ──────
  const validate = () => {
    const errs: Record<string, string> = {}
    const trimmed = name.trim()
    if (trimmed.length < 1) errs.name = tCommon('required_short')
    if (trimmed.length > 50) errs.name = t('errors.name_too_long')
    if (parsedLimit !== null && parsedLimit <= 0) errs.creditLimit = t('errors.limit_invalid')

    // Cycle dates: required when a period exists; chronological ordering mirrors
    // the create form (due > close; next close > current close; next due > next close).
    if (cycle.currentPeriodId) {
      if (!currentEnd) errs.currentEnd = tCommon('required_short')
      if (!currentDue) errs.currentDue = tCommon('required_short')
      if (currentEnd && currentDue && currentDue <= currentEnd) {
        errs.currentDue = t('errors.due_after_close')
      }
    }
    if (cycle.nextPeriodId) {
      if (!nextEnd) errs.nextEnd = tCommon('required_short')
      if (!nextDue) errs.nextDue = tCommon('required_short')
      if (currentEnd && nextEnd && nextEnd <= currentEnd) {
        errs.nextEnd = t('errors.next_close_after_current')
      }
      if (nextEnd && nextDue && nextDue <= nextEnd) {
        errs.nextDue = t('errors.next_due_after_close')
      }
    }

    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return

    setFormError(null)
    setIsSubmitting(true)
    try {
      const result = await updateCreditCard(cardId, {
        name: name.trim() || undefined,
        institution_id: institutionId || undefined,
        credit_limit: parsedLimit ?? null,
        // TODO(backend): red/marca y moneda principal no se persisten todavía
        // (la red es inmutable; las tarjetas son bimoneda por defecto).
      })
      if (!result.ok) {
        setFormError(result.formError ?? t('errors.save_failed'))
        return
      }

      // Cycle dates persist per period. Update the current period FIRST: it can
      // cascade the boundary (shifting the next period's start), so the next
      // period's own end/due must be written after that settles.
      if (
        cycle.currentPeriodId &&
        (currentEnd !== (cycle.currentEndDate ?? '') || currentDue !== (cycle.currentDueDate ?? ''))
      ) {
        const r = await updatePeriodDates(cycle.currentPeriodId, {
          end_date: currentEnd,
          due_date: currentDue,
        })
        if (!r.ok) {
          setFormError(r.formError ?? t('errors.edit_dates_failed'))
          return
        }
      }
      if (
        cycle.nextPeriodId &&
        (nextEnd !== (cycle.nextEndDate ?? '') || nextDue !== (cycle.nextDueDate ?? ''))
      ) {
        const r = await updatePeriodDates(cycle.nextPeriodId, {
          end_date: nextEnd,
          due_date: nextDue,
        })
        if (!r.ok) {
          setFormError(r.formError ?? t('errors.edit_dates_failed'))
          return
        }
      }

      if (onSuccess) {
        router.refresh()
        onSuccess()
      } else {
        router.push(`/cards/${cardId}`)
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const requestClose = () => {
    if (dirty && !window.confirm(t('edit.discard_confirm'))) return
    if (onClose) onClose()
    else router.back()
  }

  const handleArchive = () => {
    startAction(async () => {
      setFormError(null)
      const result = await deactivateCreditCardAccount(cardId)
      if (!result.ok) {
        if (result.formError === 'pending_debt') setBlockDialogOpen(true)
        else setFormError(result.formError ?? t('errors.archive_failed'))
        return
      }
      router.refresh()
      if (onSuccess) onSuccess()
    })
  }

  const handleDelete = () => {
    if (hasMovements) return
    if (!window.confirm(t('confirmations.delete_body'))) return
    startAction(async () => {
      setFormError(null)
      const result = await deleteAccount(cardId)
      if (!result.ok) {
        setFormError(result.formError ?? t('errors.delete_failed'))
        return
      }
      router.push('/cards')
    })
  }

  // ── Body ─────────────────────────────────────────────────────────────────────
  const body = (
    <div className="flex flex-col gap-0">
      {/* Live preview */}
      <div className="mb-[22px]">
        <CardPreview
          caption={t('edit.preview')}
          accent={accent}
          monogram={monogram}
          name={previewName}
          meta={previewMeta}
          limitLabel={t('labels.limit')}
          limitValue={limitDisplay}
          limitPct={limitPct}
          closeLabel={previewCloseLabel}
          dueLabel={previewDueLabel}
          cycleUnknownLabel={t('edit.cycle_unknown')}
          closePrefix={t('period.close_prefix')}
          duePrefix={t('period.due_prefix')}
        />
      </div>

      {/* Identidad */}
      <SectionLabel>{t('edit.section_identity')}</SectionLabel>
      {/* No overflow-hidden here: the bank dropdown is absolutely positioned and
          would be clipped. Round the edge rows instead to keep the framed look. */}
      <div className="rounded-[15px] border border-border [&>*+*]:border-t [&>*+*]:border-[#F1F3F6] [&>*:first-child]:rounded-t-[14px] [&>*:last-child]:rounded-b-[14px]">
        <div className="flex items-center gap-[13px] bg-card px-4 py-3">
          <FieldIcon><CreditCard className="size-[18px]" /></FieldIcon>
          <div className="min-w-0 flex-1">
            <FieldLabel>{t('edit.name_field_label')}</FieldLabel>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={50}
              aria-label={t('edit.name_field_label')}
              className="w-full border-none bg-transparent p-0 text-[15px] font-semibold tracking-[-0.01em] text-text outline-none placeholder:font-medium placeholder:text-text-soft"
            />
          </div>
        </div>
        <BankSelectorField
          institutions={institutions}
          institutionId={institutionId}
          search={institutionSearch}
          onSearchChange={(value) => {
            setInstitutionSearch(value)
            if (institutionId) {
              const selected = institutions.find((i) => i.id === institutionId)
              if (selected && selected.name !== value) setInstitutionId('')
            }
          }}
          onSelect={(inst) => {
            setInstitutionId(inst.id)
            setInstitutionSearch(inst.name)
          }}
          label={t('edit.bank_field_label')}
          placeholder={t('placeholders.bank_search_short')}
          noResultsLabel={tCommon('no_results')}
        />
      </div>
      {errors.name && <p className="mt-1.5 px-0.5 text-xs text-destructive">{errors.name}</p>}

      {/* Red / marca — read-only (immutable post-creation) */}
      <SectionLabel className="mt-[22px]">{t('edit.section_network')}</SectionLabel>
      <div className="flex flex-wrap items-center gap-2">
        <span
          className="inline-flex cursor-default items-center gap-1.5 rounded-full px-[15px] py-[9px] text-[13.5px] font-bold text-white"
          style={{ backgroundColor: networkColor ?? 'var(--navy)' }}
        >
          <Lock className="size-3.5" aria-hidden />
          {networkLabel}
        </span>
      </div>
      <Hint>{t('edit.network_locked_hint')}</Hint>

      {/* Ciclo de facturación — editable (persists per statement period) */}
      <SectionLabel className="mt-[22px]">{t('edit.section_cycle')}</SectionLabel>
      {cycle.currentPeriodId ? (
        <>
          <div className="flex flex-col gap-3.5 rounded-[15px] border border-border bg-card p-4">
            <div className="flex flex-col gap-2.5">
              <p className="text-[11px] font-bold uppercase tracking-[0.05em] text-text-soft">
                {t('labels.current_period')}
              </p>
              <div className="grid grid-cols-2 gap-3">
                <DateField
                  label={t('labels.close_date')}
                  value={currentEnd}
                  onChange={setCurrentEnd}
                  error={errors.currentEnd}
                  dotColor={accent}
                />
                <DateField
                  label={t('labels.due_date')}
                  value={currentDue}
                  onChange={setCurrentDue}
                  error={errors.currentDue}
                  dotColor="var(--terracotta)"
                />
              </div>
            </div>
            {cycle.nextPeriodId && (
              <div className="flex flex-col gap-2.5 border-t border-[#F1F3F6] pt-3.5">
                <p className="text-[11px] font-bold uppercase tracking-[0.05em] text-text-soft">
                  {t('labels.next_period')}
                  {cycle.nextPeriodIsEstimated && (
                    <span className="ml-2 rounded-full bg-border-soft px-2 py-0.5 font-semibold normal-case tracking-normal text-text-muted">
                      {t('payment.estimated_badge')}
                    </span>
                  )}
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <DateField
                    label={t('labels.close_date')}
                    value={nextEnd}
                    onChange={setNextEnd}
                    error={errors.nextEnd}
                  />
                  <DateField
                    label={t('labels.due_date')}
                    value={nextDue}
                    onChange={setNextDue}
                    error={errors.nextDue}
                  />
                </div>
              </div>
            )}
          </div>
          <Hint>
            {cycle.nextPeriodIsPaid
              ? t('edit.cycle_next_paid_hint')
              : cycle.nextPeriodIsEstimated
                ? t('edit.cycle_estimated_hint')
                : t('edit.cycle_hint')}
          </Hint>
        </>
      ) : (
        <div className="rounded-[15px] border border-border bg-card px-4 py-3.5">
          <p className="text-[13px] font-semibold text-text-muted">{t('edit.cycle_unknown')}</p>
        </div>
      )}

      {/* Límite — flat field */}
      <SectionLabel className="mt-[22px]">
        {t('edit.section_limit')}{' '}
        <span className="font-semibold normal-case tracking-normal text-text-soft">{tCommon('optional')}</span>
      </SectionLabel>
      <div className="flex items-center gap-[13px] rounded-[15px] border border-border bg-card px-4 py-3">
        <span className="text-base font-extrabold text-text-muted">$</span>
        <MoneyAmountInput
          value={creditLimit}
          onChange={setCreditLimit}
          placeholder={t('labels.limit_placeholder')}
          aria-label={t('labels.credit_limit')}
          className="min-w-0 flex-1 border-none bg-transparent p-0 text-[17px] font-bold tracking-[-0.01em] tabular-nums text-text outline-none placeholder:font-semibold placeholder:text-text-soft"
        />
        <span className="shrink-0 text-xs font-semibold text-text-soft">{t('labels.limit_suffix')}</span>
      </div>
      {errors.creditLimit ? (
        <p className="mt-1.5 px-0.5 text-xs text-destructive">{errors.creditLimit}</p>
      ) : (
        <Hint>{t('edit.limit_hint')}</Hint>
      )}

      {/* Acciones */}
      <SectionLabel className="mt-[22px]">{t('edit.section_actions')}</SectionLabel>
      <div className="overflow-hidden rounded-[15px] border border-border [&>*+*]:border-t [&>*+*]:border-border">
        <div className="flex items-center gap-4 bg-card px-4 py-[15px]">
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-bold tracking-[-0.01em] text-text">{t('edit.archive_title')}</p>
            <p className="mt-1 text-xs leading-snug text-text-muted">{t('edit.archive_sub')}</p>
          </div>
          <Button
            type="button"
            variant="secondary"
            onClick={handleArchive}
            disabled={isActionPending}
            className="w-auto shrink-0 rounded-[10px] text-[13.5px] font-bold"
          >
            {t('actions.archive')}
          </Button>
        </div>
        <div className="flex items-center gap-4 bg-card px-4 py-[15px]">
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-[7px] text-[14px] font-bold tracking-[-0.01em] text-text">
              {hasMovements && <Lock className="size-3.5 text-text-soft" aria-hidden />}
              {t('edit.delete_title')}
            </p>
            <p className="mt-1 text-xs leading-snug text-text-muted">
              {hasMovements ? t('edit.delete_sub_blocked') : t('edit.delete_sub_ok')}
            </p>
          </div>
          <Button
            type="button"
            variant="destructive"
            onClick={handleDelete}
            disabled={hasMovements || isActionPending}
            className="w-auto shrink-0 rounded-[10px] text-[13.5px] font-bold"
          >
            {t('actions.delete')}
          </Button>
        </div>
      </div>
    </div>
  )

  const footer = (
    <div className="flex items-center gap-3">
      <Button
        type="button"
        variant="secondary"
        onClick={requestClose}
        className="h-[52px] w-auto shrink-0 rounded-[14px] px-[22px] text-sm font-bold"
      >
        {tCommon('cancel')}
      </Button>
      <Button
        type="submit"
        variant="primary"
        loading={isSubmitting}
        disabled={!dirty}
        className="h-[52px] flex-1 rounded-[14px] text-[15.5px] font-bold tracking-[-0.01em]"
      >
        {isSubmitting ? tCommon('saving') : tCommon('save_changes')}
      </Button>
    </div>
  )

  if (isDrawer) {
    return (
      <>
        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <header className="shrink-0 border-b border-border bg-card px-7 pb-5 pt-[22px]">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-text-muted">{t('edit.eyebrow')}</p>
                <h2 className="truncate text-[25px] font-extrabold leading-tight tracking-[-0.03em] text-text">
                  {initialName}
                </h2>
              </div>
              <button
                type="button"
                onClick={requestClose}
                aria-label={t('edit.close')}
                className="inline-flex size-[38px] shrink-0 items-center justify-center rounded-[11px] border border-border text-text transition-colors hover:bg-border-soft"
              >
                <X className="size-[18px]" aria-hidden />
              </button>
            </div>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto px-7 pb-7 pt-[22px]">
            {formError && <Alert variant="error" className="mb-4">{formError}</Alert>}
            {body}
          </div>

          <footer className="shrink-0 border-t border-border bg-card px-7 py-4">{footer}</footer>
        </form>
        <DeactivateBlockDialog open={blockDialogOpen} onClose={() => setBlockDialogOpen(false)} />
      </>
    )
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {formError && <Alert variant="error">{formError}</Alert>}
        {body}
        {footer}
      </form>
      <DeactivateBlockDialog open={blockDialogOpen} onClose={() => setBlockDialogOpen(false)} />
    </>
  )
}
