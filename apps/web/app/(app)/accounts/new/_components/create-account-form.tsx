'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { Landmark, X } from 'lucide-react'
import { formatARS, formatUSD } from '@grana/i18n-messages'
import { parseMoneyInput } from '@grana/validation'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { SectionLabel, Hint } from '@/components/ui/form-primitives'
import { useShowCents } from '@/lib/preferences-context'
import { invalidateAfterAccountMutation } from '@/lib/transactions/invalidation'
import { createAccount } from '@/app/_actions/accounts'
import {
  AccountPreview,
  EditableMoneyGroup,
  type PreviewAvatar,
} from '../../_components/account-form-ui'
import { BankSelector } from '../../_components/bank-selector'
import { accountAccent, shortBankName, softFromHex } from '../../_components/account-presentation'
import type { Institution } from '@/lib/accounts/types'

type Props = {
  institutions: Institution[]
  /** `'drawer'` renders the hi-fi shell; `'page'` renders the body inline (fallback route). */
  variant?: 'drawer' | 'page'
  /** Drawer chrome: close handler for the header ✕ / footer cancel. */
  onClose?: () => void
  /** When provided, a successful create refreshes the route and calls this instead of navigating. */
  onSuccess?: () => void
}

const CURRENCY_CODES = ['ARS', 'USD'] as const

export const CreateAccountForm = ({ institutions, variant = 'page', onClose, onSuccess }: Props) => {
  const t = useTranslations('accounts')
  const tCommon = useTranslations('common')
  const router = useRouter()
  const queryClient = useQueryClient()
  const showCents = useShowCents()
  const isDrawer = variant === 'drawer'

  // Cash accounts exist only as the onboarding-provisioned Billetera, so this
  // form creates bank/debit accounts only — the type is fixed, no selector.
  const type = 'bank' as const
  const [name, setName] = useState('')
  const [institutionId, setInstitutionId] = useState('')
  const [institutionSearch, setInstitutionSearch] = useState('')
  // Bimoneda por defecto: every account is provisioned with ARS + USD; the user
  // only edits the initial balance per currency (both rows always shown).
  const [arsValue, setArsValue] = useState('0')
  const [usdValue, setUsdValue] = useState('0')

  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // ── Derived live-preview values ─────────────────────────────────────────────
  const selectedInstitution = institutions.find((i) => i.id === institutionId) ?? null
  const brandColor = selectedInstitution?.brand_color ?? null
  const bankShort = selectedInstitution ? shortBankName(selectedInstitution.name) : ''
  const autoName = bankShort
  const displayName = name.trim() || autoName
  const hasContent = !!name.trim() || !!institutionId

  const accent = accountAccent(type, brandColor)
  const accentSoft = brandColor ? softFromHex(brandColor) : 'var(--terracotta-soft)'

  const avatar: PreviewAvatar = brandColor
    ? { kind: 'monogram', monogram: (bankShort[0] ?? '?').toUpperCase(), bg: brandColor, fg: '#fff' }
    : { kind: 'bank', bg: 'var(--border)', fg: 'var(--text-soft)' }

  const badgeLabel = t('preview.badge_bank')
  const badgeBg = brandColor ? accentSoft : 'var(--border-soft)'
  const badgeColor = brandColor ? accent : 'var(--text-muted)'

  const meta = t('preview.meta_bank', { bank: bankShort || t('preview.meta_bank_empty') })

  const arsNum = parseMoneyInput(arsValue, { allowNegative: true }) ?? 0
  const usdNum = parseMoneyInput(usdValue, { allowNegative: true }) ?? 0
  const arsLabel = formatARS(arsNum, showCents).replace(/^\$\s?/, '')
  const usdLabel = usdNum !== 0 ? formatUSD(usdNum, showCents) : null

  // ── Form gating + validation ────────────────────────────────────────────────
  // A negative opening balance is allowed (account "en rojo"); only an
  // unparseable / empty field is invalid.
  const balancesValid = CURRENCY_CODES.every((code) => {
    const v = parseMoneyInput(code === 'ARS' ? arsValue : usdValue, { allowNegative: true })
    return v !== null
  })
  const canSubmit = !!institutionId && balancesValid
  const dirty = !!name.trim() || !!institutionId || arsValue !== '0' || usdValue !== '0'

  const validate = () => {
    const errs: Record<string, string> = {}
    // Name is optional — it falls back to the (short) institution name.
    if (name.trim().length > 50) errs.name = t('errors.name_too_long')
    if (!institutionId) errs.institution = t('errors.institution_required_short')
    if (parseMoneyInput(arsValue, { allowNegative: true }) === null)
      errs.balance_ARS = t('errors.balance_invalid')
    if (parseMoneyInput(usdValue, { allowNegative: true }) === null)
      errs.balance_USD = t('errors.balance_invalid')
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return

    setFormError(null)
    setIsSubmitting(true)
    try {
      const currencies = [
        { currency_code: 'ARS', initial_balance: parseMoneyInput(arsValue, { allowNegative: true }) ?? 0 },
        { currency_code: 'USD', initial_balance: parseMoneyInput(usdValue, { allowNegative: true }) ?? 0 },
      ]
      // No explicit name falls back to the (short) institution name.
      const finalName = name.trim() || bankShort || (selectedInstitution?.name ?? '')

      const result = await createAccount({
        name: finalName,
        type,
        institution_id: institutionId,
        currencies,
        color_key: null,
        icon_key: null,
      })

      if (!result.ok) {
        setFormError(result.formError ?? t('errors.create_failed'))
        return
      }

      // Refresh the react-query caches (accounts list, institutions) so the new
      // account shows up immediately in the movement form's account picker and
      // elsewhere, without a manual page refresh.
      invalidateAfterAccountMutation(queryClient)

      if (onSuccess) {
        router.refresh()
        onSuccess()
        if (result.id) router.push(`/accounts/${result.id}`)
      } else if (result.id) {
        router.push(`/accounts/${result.id}`)
      } else {
        router.push('/accounts')
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
          nameGhost={!displayName}
          meta={meta}
          badgeLabel={badgeLabel}
          badgeBg={badgeBg}
          badgeColor={badgeColor}
          arsLabel={arsLabel}
          usdLabel={usdLabel}
          ghost={!hasContent}
        />
      </div>

      {/* Banco / institución */}
      <SectionLabel>{t('labels.institution')}</SectionLabel>
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

      {/* Nombre */}
      <SectionLabel className="mt-[22px]">{t('labels.name')}</SectionLabel>
      <div className="flex items-center gap-[13px] rounded-[15px] border border-border bg-card px-4 py-3">
        <span
          className="flex size-9 shrink-0 items-center justify-center rounded-[11px] bg-[#FAFBFC] text-text-muted"
          aria-hidden
        >
          <Landmark className="size-[18px]" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="mb-0.5 text-[11px] font-bold uppercase tracking-[0.05em] text-text-soft">
            {t('labels.name')}
          </p>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={50}
            placeholder={t('placeholders.name_bank')}
            aria-label={t('labels.name')}
            className="w-full border-none bg-transparent p-0 text-[15px] font-semibold tracking-[-0.01em] text-text outline-none placeholder:font-medium placeholder:text-text-soft"
          />
        </div>
      </div>
      {errors.name && <p className="mt-1.5 px-0.5 text-xs text-destructive">{errors.name}</p>}

      {/* Saldo inicial — ARS + USD (ambos para todo tipo, incl. Efectivo) */}
      <SectionLabel className="mt-[22px]">{t('labels.initialBalance')}</SectionLabel>
      <EditableMoneyGroup
        arsLabel={t('labels.ars')}
        usdLabel={t('labels.usd')}
        arsSub="ARS"
        usdSub="USD"
        arsValue={arsValue}
        usdValue={usdValue}
        onArsChange={setArsValue}
        onUsdChange={setUsdValue}
        allowNegative
      />
      {errors.balance_ARS || errors.balance_USD ? (
        <p className="mt-1.5 px-0.5 text-xs text-destructive">
          {errors.balance_ARS ?? errors.balance_USD}
        </p>
      ) : (
        <Hint>{t('hints.initialBalance')}</Hint>
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
        {isSubmitting ? tCommon('creating') : t('actions.create')}
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
                {t('actions.create')}
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
