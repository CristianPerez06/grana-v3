import type { RecurrenceDetail } from '@/lib/recurrences/types'

// Resumen puro de la regla recurrente para el tile del detalle. Deriva de las
// instancias (confirmadas) — sin lógica nueva en el server.

export type RecurrenceHistoryBar = { date: string; amount: number; isCurrent: boolean }

export type RecurrenceSummaryVM = {
  nextDate: string | null
  startDate: string
  confirmedCount: number
  accumulated: number
  currency: 'ARS' | 'USD'
  /** Up to 6 most recent confirmed charges, oldest → newest. */
  history: RecurrenceHistoryBar[]
}

export const summarizeRecurrence = (detail: RecurrenceDetail): RecurrenceSummaryVM => {
  const confirmed = detail.instances.filter((i) => i.status === 'confirmed')
  const asc = [...confirmed].sort((a, b) => a.scheduled_date.localeCompare(b.scheduled_date))
  const last6 = asc.slice(-6)
  const lastDate = asc[asc.length - 1]?.scheduled_date ?? null

  return {
    nextDate: detail.next_occurrence,
    startDate: detail.start_date,
    confirmedCount: confirmed.length,
    accumulated: confirmed.reduce((sum, i) => sum + i.amount, 0),
    currency: detail.currency_code,
    history: last6.map((i) => ({
      date: i.scheduled_date,
      amount: i.amount,
      isCurrent: i.scheduled_date === lastDate,
    })),
  }
}
