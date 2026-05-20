'use client'

import { useState, useTransition } from 'react'
import { updatePeriodDates } from '@/app/_actions/credit-cards'

type Props = {
  periodId: string
  currentEndDate: string
  currentDueDate: string
  nextPeriodStart: string | null
  nextPeriodIsPaid: boolean
}

const formatDMY = (iso: string) => {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

const addOneDay = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  date.setDate(date.getDate() + 1)
  const yr = date.getFullYear()
  const mo = String(date.getMonth() + 1).padStart(2, '0')
  const dy = String(date.getDate()).padStart(2, '0')
  return `${yr}-${mo}-${dy}`
}

export const EditDatesSheet = ({
  periodId,
  currentEndDate,
  currentDueDate,
  nextPeriodStart,
  nextPeriodIsPaid,
}: Props) => {
  const [open, setOpen] = useState(false)
  const [endDate, setEndDate] = useState(currentEndDate)
  const [dueDate, setDueDate] = useState(currentDueDate)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const newNextStart = nextPeriodStart !== null ? addOneDay(endDate) : null
  const boundaryMoves =
    nextPeriodStart !== null && newNextStart !== null && newNextStart !== nextPeriodStart
  const isExtending = boundaryMoves && endDate > currentEndDate
  const isShrinking = boundaryMoves && endDate < currentEndDate
  const blockedByPaidNext = boundaryMoves && nextPeriodIsPaid

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
                {isExtending && newNextStart && !blockedByPaidNext && (
                  <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-2 py-1.5 mt-1">
                    El próximo resumen va a pasar a empezar el {formatDMY(newNextStart)}{' '}
                    (antes empezaba el {formatDMY(nextPeriodStart!)}). Los consumos del próximo
                    resumen con fecha hasta el {formatDMY(endDate)} se van a mover a este resumen.
                  </p>
                )}
                {isShrinking && newNextStart && !blockedByPaidNext && (
                  <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-2 py-1.5 mt-1">
                    El próximo resumen va a pasar a empezar el {formatDMY(newNextStart)}{' '}
                    (antes empezaba el {formatDMY(nextPeriodStart!)}). Los consumos de este
                    resumen con fecha posterior al {formatDMY(endDate)} se van a mover al próximo
                    resumen.
                  </p>
                )}
                {blockedByPaidNext && (
                  <p className="text-xs text-destructive bg-destructive/10 border border-destructive/30 rounded-md px-2 py-1.5 mt-1">
                    No podés mover esta fecha: el próximo resumen ya está pagado.
                  </p>
                )}
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
                  disabled={isPending || blockedByPaidNext}
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
