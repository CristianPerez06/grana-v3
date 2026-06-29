'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Landmark, Wallet, X } from 'lucide-react'
import { formatARS, formatUSD } from '@grana/i18n-messages'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { SectionLabel, Hint } from '@/components/ui/form-primitives'
import { useShowCents } from '@/lib/preferences-context'
import { updateAccount } from '@/app/_actions/accounts'
import { invalidateAfterAccountMutation } from '@/lib/transactions/invalidation'
import {
  AccountPreview,
  LockedField,
  LockedMoneyGroup,
  type PreviewAvatar,
} from '../../../_components/account-form-ui'
import { BankSelector } from '../../../_components/bank-selector'
import { accountAccent, shortBankName, softFromHex } from '../../../_components/account-presentation'
import type { AccountWithDetails, Institution } from '@/lib/accounts/types'

type Props = {
  account: AccountWithDetails
  institutions: Institution[]
  /** `'drawer'` renders the hi-fi shell; `'page'` renders the body inline (fallback route). */
  variant?: 'drawer' | 'page'
  /** Drawer chrome: close handler for the header ✕ / footer cancel. */
  onClose?: () => void
  /** When provided, a successful save refreshes the route and calls this instead of navigating. */
  onSuccess?: () => void
}

export const EditAccountForm = ({
  account,
  institutions,
  variant = 'page',
  onClose,
  onSuccess,
}: Props) => {
  const t = useTranslations('accounts')
  const tCommon = useTranslations('common')
  const router = useRouter()
  const qc = useQueryClient()
  const showCents = useShowCents()
  const isDrawer = variant === 'drawer'
  const isBank = account.type === 'bank'

  const [name, setName] = useState(account.name)
  const [institutionId, setInstitutionId] = useState(account.institution_id ?? '')
  const [institutionSearch, setInstitutionSearch] = useState(account.institution?.name ?? '')

  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // ── Derived live-preview values ─────────────────────────────────────────────
  const selectedInstitution = institutions.find((i) => i.id === institutionId) ?? null
  const brandColor = selectedInstitution?.brand_color ?? null
  const bankShort = selectedInstitution ? shortBankName(selectedInstitution.name) : ''
  const displayName = name.trim() || (isBank ? bankShort : account.name)

  const accent = accountAccent(isBank ? 'bank' : 'cash', brandColor)
  const accentSoft = isBank && brandColor ? softFromHex(brandColor) : 'var(--terracotta-soft)'

  const avatar: PreviewAvatar = isBank
    ? brandColor
      ? { kind: 'monogram', monogram: (bankShort[0] ?? '?').toUpperCase(), bg: brandColor, fg: '#fff' }
      : { kind: 'bank', bg: 'var(--border)', fg: 'var(--text-soft)' }
    : { kind: 'wallet', bg: 'var(--terracotta)', fg: '#fff' }

  const badgeLabel = isBank ? t('preview.badge_bank') : t('preview.badge_cash')
  const badgeBg = isBank ? (brandColor ? accentSoft : 'var(--border-soft)') : 'var(--terracotta-soft)'
  const badgeColor = isBank ? (brandColor ? accent : 'var(--text-muted)') : 'var(--terracotta)'
  const meta = isBank
    ? t('preview.meta_bank', { bank: bankShort || t('preview.meta_bank_empty') })
    : t('preview.meta_cash')

  // Initial balances are read-only here; shown in both preview and locked group.
  const arsInit = Number(account.currencies.find((c) => c.currency_code === 'ARS')?.initial_balance ?? 0)
  const usdInit = Number(account.currencies.find((c) => c.currency_code === 'USD')?.initial_balance ?? 0)
  const arsLabel = formatARS(arsInit, showCents).replace(/^\$\s?/, '')
  const usdPreviewLabel = usdInit > 0 ? formatUSD(usdInit, showCents) : null

  const dirty = name.trim() !== account.name.trim() || institutionId !== (account.institution_id ?? '')

  // ── Validation + persistence (name + institution only; type/saldos locked) ───
  const validate = () => {
    const errs: Record<string, string> = {}
    if (!name.trim()) errs.name = t('errors.name_required')
    if (name.trim().length > 50) errs.name = t('errors.name_too_long')
    if (isBank && !institutionId) errs.institution = t('errors.institution_required_short')
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return

    setFormError(null)
    setIsSubmitting(true)
    try {
      // Only editable fields go in the payload — type and initial balances are
      // locked and intentionally omitted. color_key/icon_key stay untouched.
      const payload: { name: string; institution_id?: string | null } = { name: name.trim() }
      if (isBank) payload.institution_id = institutionId || null

      const result = await updateAccount(account.id, payload)
      if (!result.ok) {
        setFormError(result.formError ?? t('errors.save_failed'))
        return
      }

      invalidateAfterAccountMutation(qc)

      if (onSuccess) {
        router.refresh()
        onSuccess()
      } else {
        router.push(`/accounts/${account.id}`)
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const requestClose = () => {
    if (dirty && !window.confirm(t('discard_confirm'))) return
    if (onClose) onClose()
    else router.back()
  }

  // ── Body ─────────────────────────────────────────────────────────────────────
  const body = (
    <div className="flex flex-col gap-0">
      {/* Live preview */}
      <div className="mb-6">
        <AccountPreview
          caption={t('preview.caption')}
          avatar={avatar}
          name={displayName || t('preview.name_placeholder')}
          nameGhost={false}
          meta={meta}
          badgeLabel={badgeLabel}
          badgeBg={badgeBg}
          badgeColor={badgeColor}
          arsLabel={arsLabel}
          usdLabel={usdPreviewLabel}
        />
      </div>

      {/* Tipo — bloqueado */}
      <SectionLabel>{t('labels.type')}</SectionLabel>
      <LockedField
        icon={isBank ? <Landmark className="size-[18px]" /> : <Wallet className="size-[18px]" />}
        value={isBank ? t('types.bank') : t('types.cash')}
      />
      <Hint>{t('readonly.type')}</Hint>

      {/* Nombre — editable */}
      <SectionLabel className="mt-[22px]">{t('labels.name')}</SectionLabel>
      <div className="flex items-center gap-[13px] rounded-[15px] border border-border bg-card px-4 py-3">
        <span
          className="flex size-9 shrink-0 items-center justify-center rounded-[11px] bg-[#FAFBFC] text-text-muted"
          aria-hidden
        >
          {isBank ? <Landmark className="size-[18px]" /> : <Wallet className="size-[18px]" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="mb-0.5 text-[11px] font-bold uppercase tracking-[0.05em] text-text-soft">
            {t('labels.name')}
          </p>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={50}
            aria-label={t('labels.name')}
            className="w-full border-none bg-transparent p-0 text-[15px] font-semibold tracking-[-0.01em] text-text outline-none placeholder:font-medium placeholder:text-text-soft"
          />
        </div>
      </div>
      {errors.name && <p className="mt-1.5 px-0.5 text-xs text-destructive">{errors.name}</p>}

      {/* Institución — editable (solo bancaria) */}
      {isBank && (
        <>
          <SectionLabel className="mt-[22px]">{t('labels.institution')}</SectionLabel>
          <div className="rounded-[15px] border border-border">
            <BankSelector
              institutions={institutions}
              institutionId={institutionId}
              search={institutionSearch}
              onSearchChange={(value) => {
                setInstitutionSearch(value)
                if (institutionId && selectedInstitution && selectedInstitution.name !== value) {
                  setInstitutionId('')
                }
              }}
              onSelect={(inst) => {
                setInstitutionId(inst.id)
                setInstitutionSearch(inst.name)
              }}
              label={t('labels.institution')}
              placeholder={t('placeholders.institutionSearch')}
            />
          </div>
          {errors.institution && (
            <p className="mt-1.5 px-0.5 text-xs text-destructive">{errors.institution}</p>
          )}
        </>
      )}

      {/* Saldo inicial — bloqueado */}
      <SectionLabel className="mt-[22px]">{t('labels.initialBalance')}</SectionLabel>
      <LockedMoneyGroup
        arsLabel={t('labels.ars')}
        usdLabel={t('labels.usd')}
        arsSub="ARS"
        usdSub="USD"
        arsValue={formatARS(arsInit, true)}
        usdValue={formatUSD(usdInit, true)}
      />
      <Hint>{t('readonly.initialBalance')}</Hint>
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
      <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
        <header className="shrink-0 border-b border-border bg-card px-5 pb-5 pt-[22px] sm:px-7">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.15em] text-text-muted">
                <ArrowLeft className="size-[13px]" aria-hidden />
                <span className="truncate">{account.name}</span>
              </p>
              <h2 className="truncate text-[20px] font-extrabold leading-tight tracking-[-0.03em] text-text sm:text-[25px]">
                {t('edit_title')}
              </h2>
            </div>
            <button
              type="button"
              onClick={requestClose}
              aria-label={tCommon('close')}
              className="inline-flex size-[38px] shrink-0 items-center justify-center rounded-[11px] border border-border text-text transition-colors hover:bg-border-soft"
            >
              <X className="size-[18px]" aria-hidden />
            </button>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-7 pt-[22px] sm:px-7">
          {formError && (
            <Alert variant="error" className="mb-4">
              {formError}
            </Alert>
          )}
          {body}
        </div>

        <footer className="shrink-0 border-t border-border bg-card px-5 py-4 sm:px-7">{footer}</footer>
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
