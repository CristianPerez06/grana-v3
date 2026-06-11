'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { CreditCard, X } from 'lucide-react'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { MoneyAmountInput } from '@/components/ui/money-amount-input'
import { parseMoneyInput } from '@grana/validation'
import { createCreditCard } from '@/app/_actions/credit-cards'
import { cardMonogram } from './card-presentation'
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
} from './card-form-ui'
import type { Institution } from '@/lib/accounts/types'

const DEFAULT_ACCENT = 'var(--account-slate)'

export type CardNetwork = {
  id: string
  slug: string
  name: string
  brand_color: string | null
}

type NetworkSelection =
  | { type: 'catalog'; networkId: string }
  | { type: 'other'; name: string }
  | null

export type CreateCardFormProps = {
  institutions: Institution[]
  networks: CardNetwork[]
  /** `'drawer'` renders the hi-fi shell; `'page'` renders the body inline (fallback route). */
  variant?: 'drawer' | 'page'
  /** Drawer chrome: close handler for the header ✕ / footer cancel. */
  onClose?: () => void
  /** When provided, a successful create refreshes the route and calls this instead of navigating. */
  onSuccess?: () => void
}

/** Strip a leading "Banco " so the auto-name reads "Visa Galicia", not "Visa Banco Galicia". */
const shortBankName = (name: string) => name.replace(/^banco\s+/i, '').trim()

export const CreateCardForm = ({
  institutions,
  networks,
  variant = 'page',
  onClose,
  onSuccess,
}: CreateCardFormProps) => {
  const router = useRouter()
  const t = useTranslations('cards')
  const tCommon = useTranslations('common')
  const isDrawer = variant === 'drawer'

  const [institutionId, setInstitutionId] = useState('')
  const [institutionSearch, setInstitutionSearch] = useState('')
  const [network, setNetwork] = useState<NetworkSelection>(null)
  const [name, setName] = useState('')
  const [creditLimit, setCreditLimit] = useState('')
  const [currentEnd, setCurrentEnd] = useState('')
  const [currentDue, setCurrentDue] = useState('')

  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // ── Derived live-preview values ─────────────────────────────────────────────
  const selectedInstitution = institutions.find((i) => i.id === institutionId) ?? null
  const accent = selectedInstitution?.brand_color ?? DEFAULT_ACCENT
  const bankName = selectedInstitution?.name ?? ''

  // Network label for the meta line; "Otra red" with no name counts as empty so
  // the auto-name never reads "Otra red Galicia".
  const catalogNetwork = network?.type === 'catalog' ? networks.find((n) => n.id === network.networkId) : null
  const networkLabel =
    network?.type === 'catalog'
      ? catalogNetwork?.name ?? ''
      : network?.type === 'other'
        ? network.name.trim()
        : ''

  const autoName = [networkLabel, shortBankName(bankName)].filter(Boolean).join(' ').trim()
  const displayName = name.trim() || autoName

  // Ghost (empty) preview until the user has touched any of institution / red / nombre.
  const ghost = !institutionId && !networkLabel && !name.trim()

  const parsedLimit = creditLimit ? parseMoneyInput(creditLimit) : null
  const limitDisplay =
    parsedLimit !== null && parsedLimit > 0 ? `$ ${fmtMoney(parsedLimit)}` : t('edit.limit_none')

  const previewMeta = bankName
    ? t('edit.preview_meta', { network: networkLabel || '—', bank: bankName })
    : t('edit.preview_meta_no_bank', { network: networkLabel || '—' })

  // ── Form gating + validation ────────────────────────────────────────────────
  const networkValid =
    network?.type === 'catalog' || (network?.type === 'other' && network.name.trim().length > 0)
  const canSubmit = !!institutionId && networkValid && !!currentEnd && !!currentDue
  const dirty =
    !!institutionId ||
    !!institutionSearch ||
    !!network ||
    !!name ||
    !!creditLimit ||
    !!currentEnd ||
    !!currentDue

  const validate = () => {
    const errs: Record<string, string> = {}

    if (!institutionId) errs.institution = t('errors.bank_required')

    if (!network) errs.network = t('errors.network_required')
    else if (network.type === 'other' && !network.name.trim()) errs.network = t('errors.network_other_required')

    if (creditLimit && (parsedLimit === null || parsedLimit <= 0)) {
      errs.creditLimit = t('errors.limit_invalid')
    }

    if (!currentEnd) errs.currentEnd = tCommon('required_short')
    if (!currentDue) errs.currentDue = tCommon('required_short')

    if (currentEnd && currentDue && currentDue <= currentEnd) errs.currentDue = t('errors.due_after_close')

    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return

    setFormError(null)
    setIsSubmitting(true)
    try {
      // Bimoneda por defecto: cards are always provisioned with ARS + USD.
      const currencies = [
        { currency_code: 'ARS', initial_balance: 0 },
        { currency_code: 'USD', initial_balance: 0 },
      ]

      const result = await createCreditCard({
        institution_id: institutionId,
        network_id: network?.type === 'catalog' ? network.networkId : undefined,
        other_network_name: network?.type === 'other' ? network.name.trim() : undefined,
        name: name.trim() || undefined,
        currencies,
        credit_limit: parsedLimit ?? undefined,
        current_end_date: currentEnd,
        current_due_date: currentDue,
      })

      if (!result.ok) {
        setFormError(result.formError ?? t('errors.create_failed'))
        return
      }

      if (onSuccess) {
        router.refresh()
        onSuccess()
        if (result.id) router.push(`/cards/${result.id}`)
      } else if (result.id) {
        router.push(`/cards/${result.id}`)
      } else {
        router.push('/cards')
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

  // ── Network pills (single-select + "Otra red") ───────────────────────────────
  const pillClass = (active: boolean) =>
    `inline-flex items-center rounded-full border px-[15px] py-[9px] text-[13.5px] font-bold transition-colors ${
      active
        ? 'border-navy bg-navy text-white'
        : 'border-border bg-card text-text-muted hover:border-[#C9CFD7] hover:text-text'
    }`

  // ── Body ─────────────────────────────────────────────────────────────────────
  const body = (
    <div className="flex flex-col gap-0">
      {/* Live preview */}
      <div className="mb-[22px]">
        <CardPreview
          caption={t('edit.preview')}
          accent={accent}
          monogram={cardMonogram(displayName)}
          name={ghost ? t('new.preview_ghost_name') : displayName}
          meta={ghost ? t('new.preview_ghost_meta') : previewMeta}
          limitLabel={t('labels.limit')}
          limitValue={limitDisplay}
          limitPct={0}
          closeLabel={dayMonth(currentEnd)}
          dueLabel={dayMonth(currentDue)}
          cycleUnknownLabel={t('edit.cycle_unknown')}
          closePrefix={t('period.close_prefix')}
          duePrefix={t('period.due_prefix')}
          ghost={ghost}
        />
      </div>

      {/* Identidad — nombre + banco */}
      <SectionLabel>{t('edit.section_identity')}</SectionLabel>
      {/* No overflow-hidden here: the bank dropdown is absolutely positioned and
          would be clipped. Round the edge rows instead to keep the framed look. */}
      <div className="rounded-[15px] border border-border [&>*+*]:border-t [&>*+*]:border-[#F1F3F6] [&>*:first-child]:rounded-t-[14px] [&>*:last-child]:rounded-b-[14px]">
        <div className="flex items-center gap-[13px] bg-card px-4 py-3">
          <FieldIcon>
            <CreditCard className="size-[18px]" />
          </FieldIcon>
          <div className="min-w-0 flex-1">
            <FieldLabel>
              {t('labels.name')}{' '}
              <span className="font-semibold normal-case tracking-normal text-text-soft">
                {tCommon('optional')}
              </span>
            </FieldLabel>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={50}
              placeholder={t('placeholders.name_auto')}
              aria-label={t('labels.name')}
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
      {errors.institution && <p className="mt-1.5 px-0.5 text-xs text-destructive">{errors.institution}</p>}
      <Hint>{t('new.bank_hint')}</Hint>

      {/* Red / marca — pills editables */}
      <SectionLabel className="mt-[22px]">{t('edit.section_network')}</SectionLabel>
      <div className="flex flex-wrap items-center gap-2">
        {networks.map((n) => {
          const active = network?.type === 'catalog' && network.networkId === n.id
          return (
            <button
              key={n.id}
              type="button"
              onClick={() => setNetwork({ type: 'catalog', networkId: n.id })}
              className={pillClass(active)}
            >
              {n.name}
            </button>
          )
        })}
        <button
          type="button"
          onClick={() => setNetwork({ type: 'other', name: '' })}
          className={pillClass(network?.type === 'other')}
        >
          {t('actions.network_other')}
        </button>
      </div>
      {network?.type === 'other' && (
        <input
          type="text"
          value={network.name}
          onChange={(e) => setNetwork({ type: 'other', name: e.target.value })}
          placeholder={t('placeholders.network_other')}
          maxLength={50}
          aria-label={t('placeholders.network_other')}
          className="mt-2 w-full rounded-[12px] border border-border bg-card px-3 py-2.5 text-sm font-semibold text-text outline-none focus-visible:ring-2 focus-visible:ring-ring placeholder:font-medium placeholder:text-text-soft"
        />
      )}
      {errors.network && <p className="mt-1.5 px-0.5 text-xs text-destructive">{errors.network}</p>}

      {/* Ciclo de facturación — solo el resumen actual; el próximo nace estimado
          y se confirma al pagar (las fechas reales llegan con ese resumen). */}
      <SectionLabel className="mt-[22px]">{t('edit.section_cycle')}</SectionLabel>
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
      </div>
      <Hint>{t('new.cycle_hint')}</Hint>

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
        <Hint>{t('new.limit_hint')}</Hint>
      )}
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
        disabled={!canSubmit}
        className="h-[52px] flex-1 rounded-[14px] text-[15.5px] font-bold tracking-[-0.01em]"
      >
        {isSubmitting ? tCommon('creating') : t('new.submit')}
      </Button>
    </div>
  )

  if (isDrawer) {
    return (
      <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
        <header className="shrink-0 border-b border-border bg-card px-7 pb-5 pt-[22px]">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-emerald-deep">
                {t('new.eyebrow')}
              </p>
              <h2 className="truncate text-[25px] font-extrabold leading-tight tracking-[-0.03em] text-text">
                {t('new.drawer_title')}
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
          {formError && (
            <Alert variant="error" className="mb-4">
              {formError}
            </Alert>
          )}
          {body}
        </div>

        <footer className="shrink-0 border-t border-border bg-card px-7 py-4">{footer}</footer>
      </form>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {formError && <Alert variant="error">{formError}</Alert>}
      {body}
      {footer}
    </form>
  )
}
