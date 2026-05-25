'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Alert } from '@/components/ui/alert'
import { createCreditCard } from '@/app/_actions/credit-cards'
import { parseMoneyInput } from '@grana/validation'
import { NetworkSelector } from '../../_components/network-selector'
import { CardCycleSection } from '../../_components/card-cycle-section'
import { LimitInputWithSuffix } from '../../_components/limit-input-with-suffix'
import type { Institution } from '@/lib/accounts/types'

type Network = {
  id: string
  slug: string
  name: string
  brand_color: string | null
}

type NetworkSelection =
  | { type: 'catalog'; networkId: string }
  | { type: 'other'; name: string }
  | null

type Props = {
  institutions: Institution[]
  networks: Network[]
}

export const CreateCreditCardForm = ({ institutions, networks }: Props) => {
  const router = useRouter()
  const t = useTranslations('cards')
  const tCommon = useTranslations('common')
  const [formError, setFormError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const [institutionId, setInstitutionId] = useState('')
  const [institutionSearch, setInstitutionSearch] = useState('')
  const [institutionFocused, setInstitutionFocused] = useState(false)
  const [network, setNetwork] = useState<NetworkSelection>(null)
  const [name, setName] = useState('')
  const [creditLimit, setCreditLimit] = useState('')
  const [currentEndDate, setCurrentEndDate] = useState('')
  const [currentDueDate, setCurrentDueDate] = useState('')
  const [nextEndDate, setNextEndDate] = useState('')
  const [nextDueDate, setNextDueDate] = useState('')

  const filteredInstitutions = institutions.filter((i) =>
    i.name.toLowerCase().includes(institutionSearch.toLowerCase()),
  )

  const validate = () => {
    const errs: Record<string, string> = {}

    if (!institutionId) errs.institution = t('errors.bank_required')

    if (!network) {
      errs.network = t('errors.network_required')
    } else if (network.type === 'other' && !network.name.trim()) {
      errs.network = t('errors.network_other_required')
    }

    const limit = creditLimit ? parseMoneyInput(creditLimit) : null
    if (creditLimit && (limit === null || limit <= 0)) {
      errs.creditLimit = t('errors.limit_invalid')
    }

    if (!currentEndDate) errs.currentEndDate = tCommon('required_short')
    if (!currentDueDate) errs.currentDueDate = tCommon('required_short')
    if (!nextEndDate) errs.nextEndDate = tCommon('required_short')
    if (!nextDueDate) errs.nextDueDate = tCommon('required_short')

    if (currentEndDate && currentDueDate && currentDueDate <= currentEndDate) {
      errs.currentDueDate = t('errors.due_after_close')
    }
    if (currentEndDate && nextEndDate && nextEndDate <= currentEndDate) {
      errs.nextEndDate = t('errors.next_close_after_current')
    }
    if (nextEndDate && nextDueDate && nextDueDate <= nextEndDate) {
      errs.nextDueDate = t('errors.next_due_after_close')
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
      // Bimoneda por defecto: cards are always provisioned with ARS + USD.
      // USD visibility is a future per-user settings flag — not a per-card opt-in.
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
        credit_limit: creditLimit ? parseMoneyInput(creditLimit) ?? undefined : undefined,
        current_end_date: currentEndDate,
        current_due_date: currentDueDate,
        next_end_date: nextEndDate,
        next_due_date: nextDueDate,
      })

      if (!result.ok) {
        setFormError(result.formError ?? t('errors.create_failed'))
        return
      }

      if (result.id) router.push(`/cards/${result.id}`)
      else router.push('/cards')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCycleChange = (
    field: 'currentEndDate' | 'currentDueDate' | 'nextEndDate' | 'nextDueDate',
    value: string,
  ) => {
    if (field === 'currentEndDate') setCurrentEndDate(value)
    if (field === 'currentDueDate') setCurrentDueDate(value)
    if (field === 'nextEndDate') setNextEndDate(value)
    if (field === 'nextDueDate') setNextDueDate(value)
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6" noValidate>
      {/* 1. Banco */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium">{t('labels.bank')}</label>
        <div className="relative">
          <input
            type="text"
            value={institutionSearch}
            onChange={(e) => {
              setInstitutionSearch(e.target.value)
              if (institutionId) setInstitutionId('')
            }}
            onFocus={() => setInstitutionFocused(true)}
            onBlur={() => {
              // Delay blur so click on a dropdown option still registers.
              setTimeout(() => setInstitutionFocused(false), 150)
            }}
            placeholder={t('placeholders.bank_search')}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
          {institutionFocused && !institutionId && (
            <div className="absolute left-0 right-0 top-full z-10 mt-1 max-h-44 overflow-y-auto rounded-md border border-input bg-background shadow-md">
              {filteredInstitutions.map((inst) => (
                <button
                  key={inst.id}
                  type="button"
                  onMouseDown={(e) => {
                    // Prevent the input's onBlur from firing before the click.
                    e.preventDefault()
                  }}
                  onClick={() => {
                    setInstitutionId(inst.id)
                    setInstitutionSearch(inst.name)
                    setInstitutionFocused(false)
                  }}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-muted transition-colors"
                >
                  {inst.name}
                </button>
              ))}
              {filteredInstitutions.length === 0 && (
                <p className="px-3 py-2 text-sm text-muted-foreground">{tCommon('no_results')}</p>
              )}
            </div>
          )}
        </div>
        {errors.institution && <p className="text-xs text-destructive">{errors.institution}</p>}
      </div>

      {/* 2. Red */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium">{t('labels.network')}</label>
        <NetworkSelector
          networks={networks}
          value={network}
          onChange={setNetwork}
          error={errors.network}
        />
      </div>

      {/* 3. Nombre (opcional) */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium">
          {t('labels.name')} <span className="text-muted-foreground font-normal">{tCommon('optional')}</span>
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('placeholders.name_auto')}
          maxLength={50}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      {/* 4. Límite */}
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

      {/* 5. Fechas */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium">{t('labels.cycle_dates')}</label>
        <CardCycleSection
          currentEndDate={currentEndDate}
          currentDueDate={currentDueDate}
          nextEndDate={nextEndDate}
          nextDueDate={nextDueDate}
          onChange={handleCycleChange}
          errors={{
            currentEndDate: errors.currentEndDate,
            currentDueDate: errors.currentDueDate,
            nextEndDate: errors.nextEndDate,
            nextDueDate: errors.nextDueDate,
          }}
        />
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
