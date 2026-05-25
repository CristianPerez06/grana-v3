'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Alert } from '@/components/ui/alert'
import { updateCreditCard } from '@/app/_actions/credit-cards'
import { parseMoneyInput } from '@grana/validation'
import { LimitInputWithSuffix } from '../../../_components/limit-input-with-suffix'
import type { Institution } from '@/lib/accounts/types'

type Props = {
  cardId: string
  initialName: string
  initialInstitutionId: string | null
  initialCreditLimit: number | null
  networkLabel: string
  institutions: Institution[]
}

export const EditCreditCardForm = ({
  cardId,
  initialName,
  initialInstitutionId,
  initialCreditLimit,
  networkLabel,
  institutions,
}: Props) => {
  const router = useRouter()
  const t = useTranslations('cards')
  const tCommon = useTranslations('common')
  const [formError, setFormError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const [name, setName] = useState(initialName)
  const [institutionId, setInstitutionId] = useState(initialInstitutionId ?? '')
  const [institutionSearch, setInstitutionSearch] = useState(
    institutions.find((i) => i.id === initialInstitutionId)?.name ?? '',
  )
  const [creditLimit, setCreditLimit] = useState(
    initialCreditLimit != null ? String(initialCreditLimit) : '',
  )

  const filteredInstitutions = institutions.filter((i) =>
    i.name.toLowerCase().includes(institutionSearch.toLowerCase()),
  )

  const validate = () => {
    const errs: Record<string, string> = {}
    if (name.trim().length > 50) errs.name = t('errors.name_too_long')
    const limit = creditLimit ? parseMoneyInput(creditLimit) : null
    if (creditLimit && (limit === null || limit <= 0)) {
      errs.creditLimit = t('errors.limit_invalid')
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
        credit_limit: creditLimit ? parseMoneyInput(creditLimit) ?? undefined : undefined,
      })

      if (!result.ok) {
        setFormError(result.formError ?? t('errors.save_failed'))
        return
      }

      router.push(`/cards/${cardId}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6" noValidate>
      {/* Red — read-only */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-muted-foreground">{t('labels.network_short')}</label>
        <p className="text-sm px-3 py-2 rounded-md border border-input bg-muted/30 text-muted-foreground">
          {networkLabel} — {t('edit.network_readonly_hint')}
        </p>
      </div>

      {/* Banco */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium">{t('labels.bank')}</label>
        <input
          type="text"
          value={institutionSearch}
          onChange={(e) => {
            setInstitutionSearch(e.target.value)
            if (institutionId) setInstitutionId('')
          }}
          placeholder={t('placeholders.bank_search_short')}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
        {institutionSearch && !institutionId && (
          <div className="max-h-44 overflow-y-auto rounded-md border border-input">
            {filteredInstitutions.map((inst) => (
              <button
                key={inst.id}
                type="button"
                onClick={() => {
                  setInstitutionId(inst.id)
                  setInstitutionSearch(inst.name)
                }}
                className="w-full px-3 py-2 text-left text-sm hover:bg-muted transition-colors"
              >
                {inst.name}
              </button>
            ))}
          </div>
        )}
        {errors.institution && <p className="text-xs text-destructive">{errors.institution}</p>}
      </div>

      {/* Nombre */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium">{t('labels.name')}</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={50}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
        {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
      </div>

      {/* Límite */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium">
          {t('labels.credit_limit')} <span className="text-muted-foreground font-normal">{tCommon('optional')}</span>
        </label>
        <LimitInputWithSuffix
          value={creditLimit}
          onChange={setCreditLimit}
          error={errors.creditLimit}
        />
      </div>

      {formError && <Alert variant="error">{formError}</Alert>}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="flex-1 rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-muted transition-colors"
        >
          {tCommon('cancel')}
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="flex-1 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {isSubmitting ? tCommon('saving') : t('actions.save')}
        </button>
      </div>
    </form>
  )
}
