'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { completeNovatoOnboarding } from '@/app/_actions/credit-cards'
import { getTodayAR } from '@/lib/date'

const formatDateISO = (d: Date) => {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export const NovatoOnboardingForm = () => {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [formError, setFormError] = useState<string | null>(null)

  const minDate = formatDateISO(
    (() => {
      const d = getTodayAR()
      d.setDate(d.getDate() - 7)
      return d
    })(),
  )

  const [closeDate, setCloseDate] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!closeDate) return
    setFormError(null)

    startTransition(async () => {
      const result = await completeNovatoOnboarding({ close_date: closeDate })
      if (!result.ok) {
        setFormError(result.formError ?? 'Error al configurar tu cuenta.')
        return
      }
      router.push('/cards')
    })
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <label htmlFor="close_date" className="text-sm font-medium">
          ¿Cuándo cierra tu actual resumen?
        </label>
        <p className="text-xs text-muted-foreground">
          Mirá la fecha de cierre en tu resumen bancario o en la app del banco.
          Usamos esto para armar tu calendario de pagos.
        </p>
        <input
          id="close_date"
          type="date"
          required
          min={minDate}
          value={closeDate}
          onChange={(e) => setCloseDate(e.target.value)}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        {closeDate && (
          <div className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground space-y-0.5">
            <p>Vencimiento estimado: <strong>{
              (() => {
                const [y, m, d] = closeDate.split('-').map(Number)
                const due = new Date(y, m - 1, d + 15)
                return `${String(due.getDate()).padStart(2, '0')}/${String(due.getMonth() + 1).padStart(2, '0')}/${due.getFullYear()}`
              })()
            }</strong></p>
            <p className="text-xs opacity-70">📅 Estimado — lo podés confirmar al pagar el primer resumen.</p>
          </div>
        )}
      </div>

      {formError && <p className="text-sm text-destructive">{formError}</p>}

      <button
        type="submit"
        disabled={isPending || !closeDate}
        className="w-full rounded-md bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
      >
        {isPending ? 'Configurando…' : 'Empezar'}
      </button>
    </form>
  )
}
