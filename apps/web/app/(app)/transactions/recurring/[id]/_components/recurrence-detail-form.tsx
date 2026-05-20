'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  deleteRecurrence,
  pauseRecurrence,
  resumeRecurrence,
  updateRecurrence,
} from '@/app/_actions/recurrences'
import { parseMoneyInput } from '@grana/validation'
import { MoneyAmountInput } from '@/components/ui/money-amount-input'
import type { RecurrenceDetail } from '@/lib/recurrences/types'

const FREQUENCY_OPTIONS: { value: 'weekly' | 'biweekly' | 'monthly' | 'annual'; label: string }[] =
  [
    { value: 'weekly', label: 'Semanal' },
    { value: 'biweekly', label: 'Quincenal' },
    { value: 'monthly', label: 'Mensual' },
    { value: 'annual', label: 'Anual' },
  ]

type Props = {
  rule: RecurrenceDetail
}

export const RecurrenceDetailForm = ({ rule }: Props) => {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [formError, setFormError] = useState<string | null>(null)
  const [formSuccess, setFormSuccess] = useState<string | null>(null)

  const [amount, setAmount] = useState(String(rule.amount))
  const [frequency, setFrequency] = useState<typeof FREQUENCY_OPTIONS[number]['value']>(
    rule.frequency as typeof FREQUENCY_OPTIONS[number]['value'],
  )
  const [endDate, setEndDate] = useState(rule.end_date ?? '')
  const [description, setDescription] = useState(rule.description ?? '')

  const isPaused = rule.status === 'paused'
  const isDeleted = rule.status === 'deleted'

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)
    setFormSuccess(null)

    const parsedAmount = parseMoneyInput(amount)
    if (parsedAmount === null || parsedAmount <= 0) {
      setFormError('El monto debe ser mayor a cero.')
      return
    }

    startTransition(async () => {
      const result = await updateRecurrence(rule.id, {
        amount: parsedAmount,
        frequency,
        end_date: endDate || null,
        description: description || null,
      })
      if (!result.ok) {
        setFormError(result.formError ?? 'No se pudo guardar.')
        return
      }
      setFormSuccess('Cambios guardados.')
      router.refresh()
    })
  }

  const handlePauseToggle = () => {
    setFormError(null)
    setFormSuccess(null)
    startTransition(async () => {
      const result = isPaused
        ? await resumeRecurrence(rule.id)
        : await pauseRecurrence(rule.id)
      if (!result.ok) {
        setFormError(result.formError ?? 'No se pudo cambiar el estado.')
        return
      }
      setFormSuccess(isPaused ? 'Regla reanudada.' : 'Regla pausada.')
      router.refresh()
    })
  }

  const handleDelete = () => {
    if (!confirm('¿Eliminar esta regla? Las instancias pendientes se cancelarán.')) {
      return
    }
    setFormError(null)
    setFormSuccess(null)
    startTransition(async () => {
      const result = await deleteRecurrence(rule.id)
      if (!result.ok) {
        setFormError(result.formError ?? 'No se pudo eliminar.')
        return
      }
      router.push('/transactions/recurring')
    })
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={handlePauseToggle}
          disabled={isPending || isDeleted}
          className="rounded-md border border-border px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:border-foreground disabled:opacity-50"
        >
          {isPaused ? 'Reanudar' : 'Pausar'}
        </button>
        <button
          type="button"
          onClick={handleDelete}
          disabled={isPending || isDeleted}
          className="rounded-md border border-destructive/40 px-3 py-1.5 text-sm font-medium text-destructive hover:bg-destructive/5 disabled:opacity-50"
        >
          Eliminar
        </button>
      </div>

      {formSuccess && (
        <div className="rounded-md border border-green-600/40 bg-green-600/10 px-3 py-2 text-sm text-green-700 dark:text-green-400">
          {formSuccess}
        </div>
      )}
      {formError && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {formError}
        </div>
      )}

      <form onSubmit={handleSave} className="flex flex-col gap-5">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="amount" className="text-sm font-medium">
            Monto
          </label>
          <MoneyAmountInput
            id="amount"
            required
            value={amount}
            onChange={setAmount}
            disabled={isDeleted}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="frequency" className="text-sm font-medium">
            Frecuencia
          </label>
          <select
            id="frequency"
            value={frequency}
            onChange={(e) =>
              setFrequency(e.target.value as typeof frequency)
            }
            disabled={isDeleted}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          >
            {FREQUENCY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="end_date" className="text-sm font-medium">
            Fecha de fin{' '}
            <span className="text-muted-foreground text-xs">(opcional)</span>
          </label>
          <input
            id="end_date"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            disabled={isDeleted}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="description" className="text-sm font-medium">
            Descripción{' '}
            <span className="text-muted-foreground text-xs">(opcional)</span>
          </label>
          <input
            id="description"
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={isDeleted}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          />
        </div>

        <button
          type="submit"
          disabled={isPending || isDeleted}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {isPending ? 'Guardando…' : 'Guardar cambios'}
        </button>
      </form>
    </div>
  )
}
