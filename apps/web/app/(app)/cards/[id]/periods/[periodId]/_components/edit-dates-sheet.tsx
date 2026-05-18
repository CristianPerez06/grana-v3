'use client'

import { useState, useTransition } from 'react'
import { updatePeriodDates } from '@/app/_actions/credit-cards'

type Props = {
  periodId: string
  currentEndDate: string
  currentDueDate: string
}

export const EditDatesSheet = ({ periodId, currentEndDate, currentDueDate }: Props) => {
  const [open, setOpen] = useState(false)
  const [endDate, setEndDate] = useState(currentEndDate)
  const [dueDate, setDueDate] = useState(currentDueDate)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      const result = await updatePeriodDates(periodId, { end_date: endDate, due_date: dueDate })
      if (!result.ok) {
        setError(result.formError ?? 'Error al actualizar fechas')
      } else {
        setOpen(false)
      }
    })
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-xs text-primary hover:underline"
      >
        Editar fechas
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-xl bg-background p-6 shadow-xl flex flex-col gap-4">
            <h2 className="text-base font-semibold">Editar fechas del resumen</h2>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium" htmlFor="end_date">
                  Fecha de cierre
                </label>
                <input
                  id="end_date"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  required
                  className="rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium" htmlFor="due_date">
                  Fecha de vencimiento
                </label>
                <input
                  id="due_date"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  required
                  className="rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              {error && <p className="text-sm text-destructive">{error}</p>}

              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="px-4 py-2 text-sm rounded-md border border-border hover:bg-muted transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-4 py-2 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  {isPending ? 'Guardando…' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
