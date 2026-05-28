'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Alert } from '@/components/ui/alert'
import { updateAccount } from '@/app/_actions/accounts'
import { InstitutionPicker } from '../../../_components/institution-picker'
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
  const [errors, setErrors] = useState<Record<string, string>>({})

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
      // color_key/icon_key are intentionally omitted: the form no longer
      // surfaces an appearance picker, so existing values are preserved.
      const payload: { name: string; institution_id?: string | null } = { name: name.trim() }
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
          <InstitutionPicker
            institutions={institutions}
            selectedId={institutionId}
            initialSearch={account.institution?.name ?? ''}
            onChange={(id) => setInstitutionId(id)}
            errorText={errors.institution}
          />
        </div>
      )}

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
