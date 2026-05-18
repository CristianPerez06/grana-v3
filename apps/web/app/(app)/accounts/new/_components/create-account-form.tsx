'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Alert } from '@/components/ui/alert'
import { createAccount } from '@/app/_actions/accounts'
import { parseMoneyInput } from '@grana/validation'
import type { Institution } from '@/lib/accounts/types'

type Props = {
  institutions: Institution[]
}

const CURRENCIES = [
  { code: 'ARS', label: 'Pesos (ARS)' },
  { code: 'USD', label: 'Dólares (USD)' },
]

export const CreateAccountForm = ({ institutions }: Props) => {
  const router = useRouter()
  const [formError, setFormError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [type, setType] = useState<'cash' | 'bank'>('cash')
  const [name, setName] = useState('')
  const [institutionId, setInstitutionId] = useState('')
  const [institutionSearch, setInstitutionSearch] = useState('')
  const [selectedCurrencies, setSelectedCurrencies] = useState<Set<string>>(new Set(['ARS']))
  const [balances, setBalances] = useState<Record<string, string>>({ ARS: '0', USD: '0' })
  const [errors, setErrors] = useState<Record<string, string>>({})

  const filteredInstitutions = institutions.filter((i) =>
    i.name.toLowerCase().includes(institutionSearch.toLowerCase()),
  )

  const toggleCurrency = (code: string) => {
    setSelectedCurrencies((prev) => {
      const next = new Set(prev)
      if (next.has(code)) {
        if (next.size > 1) next.delete(code)
      } else {
        next.add(code)
      }
      return next
    })
  }

  const validate = () => {
    const errs: Record<string, string> = {}
    if (!name.trim()) errs.name = 'El nombre es obligatorio.'
    if (name.trim().length > 50) errs.name = 'El nombre no puede tener más de 50 caracteres.'
    if (type === 'bank' && !institutionId) errs.institution = 'Seleccioná una institución.'
    if (selectedCurrencies.size === 0) errs.currencies = 'Seleccioná al menos una moneda.'
    for (const code of selectedCurrencies) {
      const value = parseMoneyInput(balances[code] ?? '0')
      if (value === null || value < 0) errs[`balance_${code}`] = 'El saldo inicial no puede ser negativo.'
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
      const currencies = Array.from(selectedCurrencies).map((code) => ({
        currency_code: code,
        initial_balance: parseMoneyInput(balances[code] ?? '0') ?? 0,
      }))

      const result = await createAccount({
        name: name.trim(),
        type,
        institution_id: type === 'bank' ? institutionId : undefined,
        currencies,
      })

      if (!result.ok) {
        setFormError(result.formError ?? 'Error al crear la cuenta')
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
        <label className="text-sm font-medium text-foreground">Tipo de cuenta</label>
        <div className="flex rounded-md border border-input overflow-hidden">
          {(['cash', 'bank'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setType(t)}
              className={[
                'flex-1 py-2 text-sm font-medium transition-colors',
                type === t
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-background text-muted-foreground hover:text-foreground',
              ].join(' ')}
            >
              {t === 'cash' ? 'Efectivo' : 'Bancaria / Débito'}
            </button>
          ))}
        </div>
      </div>

      {/* Name */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-foreground">Nombre</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={type === 'cash' ? 'Ej: Billetera, Caja chica' : 'Ej: Caja de ahorro Galicia'}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
        {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
      </div>

      {/* Institution (bank only) */}
      {type === 'bank' && (
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-foreground">Institución</label>
          <input
            type="text"
            value={institutionSearch}
            onChange={(e) => setInstitutionSearch(e.target.value)}
            placeholder="Buscar banco o billetera…"
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

      {/* Currencies */}
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-foreground">Monedas y saldo inicial</label>
        {errors.currencies && (
          <p className="text-xs text-destructive">{errors.currencies}</p>
        )}
        {CURRENCIES.map(({ code, label }) => (
          <div key={code} className="flex items-center gap-3 rounded-md border border-input p-3">
            <input
              type="checkbox"
              id={`currency-${code}`}
              checked={selectedCurrencies.has(code)}
              onChange={() => toggleCurrency(code)}
              className="h-4 w-4 rounded border-input"
            />
            <label htmlFor={`currency-${code}`} className="text-sm font-medium flex-1">
              {label}
            </label>
            {selectedCurrencies.has(code) && (
              <div className="flex flex-col gap-1">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={balances[code] ?? '0'}
                  onChange={(e) =>
                    setBalances((prev) => ({ ...prev, [code]: e.target.value }))
                  }
                  placeholder="0.00"
                  className="w-28 rounded-md border border-input bg-background px-2 py-1 text-sm text-right focus:outline-none focus:ring-2 focus:ring-ring"
                />
                {errors[`balance_${code}`] && (
                  <p className="text-xs text-destructive">{errors[`balance_${code}`]}</p>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {formError && <Alert variant="error">{formError}</Alert>}

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
      >
        {isSubmitting ? 'Creando…' : 'Crear cuenta'}
      </button>
    </form>
  )
}
