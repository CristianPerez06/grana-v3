'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Alert } from '@/components/ui/alert'
import { updateAccount } from '@/app/_actions/accounts'
import { AccountAvatarPicker } from '@/components/ui/account-avatar-picker'
import type { AccountColorKey, AccountIconKey } from '@grana/ui-contracts'
import type { AccountWithDetails, Institution } from '@/lib/accounts/types'

type Props = {
  account: AccountWithDetails
  institutions: Institution[]
}

export const EditAccountForm = ({ account, institutions }: Props) => {
  const t = useTranslations('accounts')
  const tCommon = useTranslations('common')
  const router = useRouter()
  const [formError, setFormError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [name, setName] = useState(account.name)
  const [institutionId, setInstitutionId] = useState(account.institution_id ?? '')
  const [institutionSearch, setInstitutionSearch] = useState(account.institution?.name ?? '')
  const [colorKey, setColorKey] = useState<AccountColorKey | null>(
    account.color_key as AccountColorKey | null,
  )
  const [iconKey, setIconKey] = useState<AccountIconKey | null>(
    account.icon_key as AccountIconKey | null,
  )
  const [errors, setErrors] = useState<Record<string, string>>({})

  const filteredInstitutions = institutions.filter((i) =>
    i.name.toLowerCase().includes(institutionSearch.toLowerCase()),
  )

  const selectedInstitution = institutions.find((i) => i.id === institutionId) ?? null
  const inheritedColor = account.type === 'bank' ? selectedInstitution?.brand_color ?? null : null
  const autoIcon: AccountIconKey =
    account.type === 'cash'
      ? 'wallet'
      : selectedInstitution?.icon_type === 'wallet'
        ? 'wallet'
        : 'landmark'
  const monogram = (name.trim()[0] ?? '?').toUpperCase()

  const validate = () => {
    const errs: Record<string, string> = {}
    if (!name.trim()) errs.name = t('errors.name_required')
    if (name.trim().length > 50) errs.name = t('errors.name_too_long')
    if (account.type === 'bank' && !institutionId) errs.institution = t('errors.institution_required_short')
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return

    setFormError(null)
    setIsSubmitting(true)

    try {
      const payload: {
        name: string
        institution_id?: string | null
        color_key: AccountColorKey | null
        icon_key: AccountIconKey | null
      } = { name: name.trim(), color_key: colorKey, icon_key: iconKey }
      if (account.type === 'bank') payload.institution_id = institutionId || null

      const result = await updateAccount(account.id, payload)

      if (result.ok) {
        router.push(`/accounts/${account.id}`)
        return
      }

      if (result.formError) setFormError(result.formError)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6" noValidate>
      {/* Type — read-only */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-foreground">{t('labels.type')}</label>
        <div className="rounded-md border border-input bg-muted px-3 py-2 text-sm text-muted-foreground">
          {account.type === 'cash' ? t('types.cash') : t('types.bank')}
        </div>
        <p className="text-xs text-muted-foreground">{t('readonly.type')}</p>
      </div>

      {/* Name */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-foreground">{t('labels.name')}</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
        {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
      </div>

      {/* Institution (bank only) */}
      {account.type === 'bank' && (
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-foreground">{t('labels.institution')}</label>
          <input
            type="text"
            value={institutionSearch}
            onChange={(e) => setInstitutionSearch(e.target.value)}
            placeholder={t('placeholders.institutionSearch')}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <div className="max-h-48 overflow-y-auto rounded-md border border-input">
            {filteredInstitutions.map((inst) => (
              <button
                key={inst.id}
                type="button"
                onClick={() => {
                  setInstitutionId(inst.id)
                  setInstitutionSearch(inst.name)
                }}
                className={[
                  'w-full px-3 py-2 text-left text-sm hover:bg-muted transition-colors',
                  institutionId === inst.id ? 'bg-muted font-medium' : '',
                ].join(' ')}
              >
                {inst.name}
              </button>
            ))}
          </div>
          {errors.institution && (
            <p className="text-xs text-destructive">{errors.institution}</p>
          )}
        </div>
      )}

      {/* Appearance — color + icon avatar (auto when left unset) */}
      <AccountAvatarPicker
        colorKey={colorKey}
        iconKey={iconKey}
        onColorChange={setColorKey}
        onIconChange={setIconKey}
        inheritedColor={inheritedColor}
        autoIcon={autoIcon}
        monogram={monogram}
      />

      {/* Initial balance — read-only */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-foreground">{t('labels.initialBalance')}</label>
        {account.currencies.map((c) => (
          <div
            key={c.currency_code}
            className="rounded-md border border-input bg-muted px-3 py-2 text-sm text-muted-foreground"
          >
            {c.currency_code}: {c.initial_balance.toFixed(2)}
          </div>
        ))}
        <p className="text-xs text-muted-foreground">
          {t('readonly.initialBalance')}
        </p>
      </div>

      {formError && <Alert variant="error">{formError}</Alert>}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="flex-1 rounded-md border border-input px-4 py-2 text-sm font-medium hover:bg-muted transition-colors"
        >
          {tCommon('cancel')}
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="flex-1 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {isSubmitting ? tCommon('saving') : tCommon('save_changes')}
        </button>
      </div>
    </form>
  )
}
