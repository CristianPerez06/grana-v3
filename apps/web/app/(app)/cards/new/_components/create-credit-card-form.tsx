'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Alert } from '@/components/ui/alert'
import { createCreditCard } from '@/app/_actions/credit-cards'
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
  const [formError, setFormError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const [institutionId, setInstitutionId] = useState('')
  const [institutionSearch, setInstitutionSearch] = useState('')
  const [network, setNetwork] = useState<NetworkSelection>(null)
  const [name, setName] = useState('')
  const [includeUSD, setIncludeUSD] = useState(false)
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

    if (!institutionId) errs.institution = 'Seleccioná el banco emisor.'

    if (!network) {
      errs.network = 'Seleccioná la red de la tarjeta.'
    } else if (network.type === 'other' && !network.name.trim()) {
      errs.network = 'Ingresá el nombre de la red.'
    }

    const limit = creditLimit ? parseFloat(creditLimit) : null
    if (creditLimit && (isNaN(limit!) || limit! <= 0)) {
      errs.creditLimit = 'El límite debe ser mayor a cero.'
    }

    if (!currentEndDate) errs.currentEndDate = 'Requerido.'
    if (!currentDueDate) errs.currentDueDate = 'Requerido.'
    if (!nextEndDate) errs.nextEndDate = 'Requerido.'
    if (!nextDueDate) errs.nextDueDate = 'Requerido.'

    if (currentEndDate && currentDueDate && currentDueDate <= currentEndDate) {
      errs.currentDueDate = 'El vencimiento debe ser posterior al cierre.'
    }
    if (currentEndDate && nextEndDate && nextEndDate <= currentEndDate) {
      errs.nextEndDate = 'El próximo cierre debe ser posterior al cierre actual.'
    }
    if (nextEndDate && nextDueDate && nextDueDate <= nextEndDate) {
      errs.nextDueDate = 'El próximo vencimiento debe ser posterior al cierre.'
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
      const currencies = [
        { currency_code: 'ARS', initial_balance: 0 },
        ...(includeUSD ? [{ currency_code: 'USD', initial_balance: 0 }] : []),
      ]

      const result = await createCreditCard({
        institution_id: institutionId,
        network_id: network?.type === 'catalog' ? network.networkId : undefined,
        other_network_name: network?.type === 'other' ? network.name.trim() : undefined,
        name: name.trim() || undefined,
        currencies,
        credit_limit: creditLimit ? parseFloat(creditLimit) : undefined,
        current_end_date: currentEndDate,
        current_due_date: currentDueDate,
        next_end_date: nextEndDate,
        next_due_date: nextDueDate,
      })

      if (!result.ok) {
        setFormError(result.formError ?? 'Error al crear la tarjeta')
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
        <label className="text-sm font-medium">Banco / institución</label>
        <input
          type="text"
          value={institutionSearch}
          onChange={(e) => {
            setInstitutionSearch(e.target.value)
            if (institutionId) setInstitutionId('')
          }}
          placeholder="Buscar banco…"
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
            {filteredInstitutions.length === 0 && (
              <p className="px-3 py-2 text-sm text-muted-foreground">Sin resultados.</p>
            )}
          </div>
        )}
        {errors.institution && <p className="text-xs text-destructive">{errors.institution}</p>}
      </div>

      {/* 2. Red */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium">Red de la tarjeta</label>
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
          Nombre <span className="text-muted-foreground font-normal">(opcional)</span>
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Se auto-genera si lo dejás en blanco"
          maxLength={50}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      {/* 4. Monedas */}
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium">Monedas</label>
        <div className="flex items-center gap-3 rounded-md border border-input p-3 bg-muted/30">
          <span className="text-sm flex-1">Pesos (ARS)</span>
          <span className="text-xs text-muted-foreground">Siempre activa</span>
        </div>
        <div className="flex items-center gap-3 rounded-md border border-input p-3">
          <input
            type="checkbox"
            id="currency-usd"
            checked={includeUSD}
            onChange={(e) => setIncludeUSD(e.target.checked)}
            className="h-4 w-4 rounded border-input"
          />
          <label htmlFor="currency-usd" className="text-sm flex-1 cursor-pointer">
            Dólares (USD)
          </label>
        </div>
      </div>

      {/* 5. Límite */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium">
          Límite de crédito <span className="text-muted-foreground font-normal">(opcional)</span>
        </label>
        <LimitInputWithSuffix
          value={creditLimit}
          onChange={setCreditLimit}
          error={errors.creditLimit}
        />
      </div>

      {/* 6. Fechas */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium">Fechas del ciclo</label>
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
        {isSubmitting ? 'Creando…' : 'Crear tarjeta'}
      </button>
    </form>
  )
}
