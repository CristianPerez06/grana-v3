'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Alert } from '@/components/ui/alert'
import { createAccount } from '@/app/_actions/accounts'
import { parseMoneyInput } from '@grana/validation'
import { MoneyAmountInput } from '@/components/ui/money-amount-input'
import { AccountAvatarPicker } from '@/components/ui/account-avatar-picker'
import type { AccountColorKey, AccountIconKey } from '@grana/ui-contracts'
import type { Institution } from '@/lib/accounts/types'

type Props = {
  institutions: Institution[]
}

const CURRENCY_CODES = ['ARS', 'USD'] as const

export const CreateAccountForm = ({ institutions }: Props) => {
  const t = useTranslations('accounts')
  const tCommon = useTranslations('common')
  const router = useRouter()
  const [formError, setFormError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [type, setType] = useState<'cash' | 'bank'>('cash')
  const [name, setName] = useState('')
  const [institutionId, setInstitutionId] = useState('')
  const [institutionSearch, setInstitutionSearch] = useState('')
  // Bimoneda por defecto: every account is provisioned with ARS + USD.
  // The user only edits the initial balance per currency; toggling is not allowed.
  const [balances, setBalances] = useState<Record<string, string>>({ ARS: '0', USD: '0' })
  const [colorKey, setColorKey] = useState<AccountColorKey | null>(null)
  const [iconKey, setIconKey] = useState<AccountIconKey | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const selectedInstitution = institutions.find((i) => i.id === institutionId) ?? null
  const inheritedColor = type === 'bank' ? selectedInstitution?.brand_color ?? null : null
  const autoIcon: AccountIconKey =
    type === 'cash' ? 'wallet' : selectedInstitution?.icon_type === 'wallet' ? 'wallet' : 'landmark'
  const monogram = (name.trim()[0] ?? '?').toUpperCase()

  const CURRENCIES = [
    { code: 'ARS', label: t('currency_options.ars') },
    { code: 'USD', label: t('currency_options.usd') },
  ]

  const filteredInstitutions = institutions.filter((i) =>
    i.name.toLowerCase().includes(institutionSearch.toLowerCase()),
  )

  const validate = () => {
    const errs: Record<string, string> = {}
    if (!name.trim()) errs.name = t('errors.name_required')
    if (name.trim().length > 50) errs.name = t('errors.name_too_long')
    if (type === 'bank' && !institutionId) errs.institution = t('errors.institution_required_short')
    for (const code of CURRENCY_CODES) {
      const value = parseMoneyInput(balances[code] ?? '0')
      if (value === null || value < 0) errs[`balance_${code}`] = t('errors.balance_negative')
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
      const currencies = CURRENCY_CODES.map((code) => ({
        currency_code: code,
        initial_balance: parseMoneyInput(balances[code] ?? '0') ?? 0,
      }))

      const result = await createAccount({
        name: name.trim(),
        type,
        institution_id: type === 'bank' ? institutionId : undefined,
        currencies,
        color_key: type === 'bank' ? null : colorKey,
        icon_key: type === 'bank' ? null : iconKey,
      })

      if (!result.ok) {
        setFormError(result.formError ?? t('errors.create_failed'))
        return
      }

      if (result.id) router.push(`/accounts/${result.id}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6" noValidate>
      {/* Type selector */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-foreground">{t('labels.type')}</label>
        <div className="flex rounded-md border border-input overflow-hidden">
          {(['cash', 'bank'] as const).map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => setType(opt)}
              className={[
                'flex-1 py-2 text-sm font-medium transition-colors',
                type === opt
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-background text-muted-foreground hover:text-foreground',
              ].join(' ')}
            >
              {opt === 'cash' ? t('types.cash') : t('types.bank')}
            </button>
          ))}
        </div>
      </div>

      {/* Name */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-foreground">{t('labels.name')}</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={type === 'cash' ? t('placeholders.name') : t('placeholders.name_bank')}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
        {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
      </div>

      {/* Institution (bank only) */}
      {type === 'bank' && (
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
                  'flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted transition-colors',
                  institutionId === inst.id ? 'bg-muted font-medium' : '',
                ].join(' ')}
              >
                <span
                  className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded text-[10px] font-semibold text-white"
                  style={{ backgroundColor: inst.brand_color ?? 'var(--account-slate)' }}
                  aria-hidden
                >
                  {(inst.name[0] ?? '?').toUpperCase()}
                </span>
                <span>{inst.name}</span>
              </button>
            ))}
          </div>
          {errors.institution && (
            <p className="text-xs text-destructive">{errors.institution}</p>
          )}
        </div>
      )}

      {/* Bank accounts derive color/icon from the institution; no override UI. */}
      {type === 'cash' && (
        <AccountAvatarPicker
          colorKey={colorKey}
          iconKey={iconKey}
          onColorChange={setColorKey}
          onIconChange={setIconKey}
          inheritedColor={inheritedColor}
          autoIcon={autoIcon}
          monogram={monogram}
        />
      )}

      {/* Currencies — bimoneda por defecto: ambas monedas siempre activas. */}
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-foreground">{t('labels.initialBalance')}</label>
        {CURRENCIES.map(({ code, label }) => (
          <div key={code} className="flex items-center gap-3 rounded-md border border-input p-3">
            <span className="text-sm font-medium flex-1">{label}</span>
            <div className="flex flex-col gap-1">
              <MoneyAmountInput
                value={balances[code] ?? '0'}
                onChange={(value) =>
                  setBalances((prev) => ({ ...prev, [code]: value }))
                }
                placeholder="0.00"
                className="w-28 rounded-md border border-input bg-background px-2 py-1 text-sm text-right focus:outline-none focus:ring-2 focus:ring-ring"
              />
              {errors[`balance_${code}`] && (
                <p className="text-xs text-destructive">{errors[`balance_${code}`]}</p>
              )}
            </div>
          </div>
        ))}
      </div>

      {formError && <Alert variant="error">{formError}</Alert>}

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
      >
        {isSubmitting ? tCommon('creating') : t('actions.create')}
      </button>
    </form>
  )
}
