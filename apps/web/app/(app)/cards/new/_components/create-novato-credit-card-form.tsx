'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Alert } from '@/components/ui/alert'
import { createNovatoCreditCard } from '@/app/_actions/credit-cards'
import { NetworkSelector } from '../../_components/network-selector'
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

export const CreateNovatoCreditCardForm = ({ institutions, networks }: Props) => {
  const router = useRouter()
  const [formError, setFormError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const [institutionId, setInstitutionId] = useState('')
  const [institutionSearch, setInstitutionSearch] = useState('')
  const [institutionFocused, setInstitutionFocused] = useState(false)
  const [network, setNetwork] = useState<NetworkSelection>(null)
  const [name, setName] = useState('')
  const [closeDate, setCloseDate] = useState('')

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
    if (!closeDate) errs.closeDate = 'Requerido.'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return

    setFormError(null)
    setIsSubmitting(true)
    try {
      const result = await createNovatoCreditCard({
        institution_id: institutionId,
        network_id: network?.type === 'catalog' ? network.networkId : undefined,
        other_network_name: network?.type === 'other' ? network.name.trim() : undefined,
        name: name.trim() || undefined,
        close_date: closeDate,
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

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6" noValidate>
      {/* 1. Banco */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium">Banco / institución</label>
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
              setTimeout(() => setInstitutionFocused(false), 150)
            }}
            placeholder="Hacé click para ver los bancos…"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
          {institutionFocused && !institutionId && (
            <div className="absolute left-0 right-0 top-full z-10 mt-1 max-h-44 overflow-y-auto rounded-md border border-input bg-background shadow-md">
              {filteredInstitutions.map((inst) => (
                <button
                  key={inst.id}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
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
                <p className="px-3 py-2 text-sm text-muted-foreground">Sin resultados.</p>
              )}
            </div>
          )}
        </div>
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
          placeholder="Ej: Visa principal"
          maxLength={50}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      {/* 4. Fecha de cierre */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="close_date" className="text-sm font-medium">
          Fecha del próximo cierre
        </label>
        <p className="text-xs text-muted-foreground">
          Tomala del último resumen que te mandó el banco. La app va a ir generando los
          resúmenes siguientes sola.
        </p>
        <input
          id="close_date"
          type="date"
          required
          value={closeDate}
          onChange={(e) => setCloseDate(e.target.value)}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
        {errors.closeDate && <p className="text-xs text-destructive">{errors.closeDate}</p>}
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
