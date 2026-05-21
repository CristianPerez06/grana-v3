// TODO(@grana/cards): duplicación parcial de apps/web/lib/cards/utils.ts.
// Esta copia incluye SOLO los helpers que getCreditCards necesita
// (derivePeriodStatus, derivePeriodVariant, formatDateISO, sumMoneyValues).
// Cuando cards se prometa a package compartido, esta copia se borra. Mantener
// firmas sincronizadas con el archivo web hasta entonces.

import { Money } from '@grana/validation'
import type { PeriodStatus, PeriodVariant } from './types'

export function derivePeriodStatus(
  period: { end_date: string; due_date: string },
  today: Date,
  hasPayment: boolean,
): PeriodStatus {
  if (hasPayment) return 'paid'

  const todayStr = formatDateISO(today)
  if (todayStr <= period.end_date) return 'open'
  if (todayStr <= period.due_date) return 'closed'
  return 'overdue'
}

export function derivePeriodVariant(
  period: { start_date: string; end_date: string; due_date: string },
  today: Date,
  hasPayment: boolean,
  txCount: number,
): PeriodVariant {
  const status = derivePeriodStatus(period, today, hasPayment)

  if (status === 'paid') return 'pagado'
  if (status === 'overdue') return 'vencido'
  if (status === 'closed') return 'cerrado_esperando_pago'

  // status === 'open'
  const todayStr = formatDateISO(today)
  if (period.start_date > todayStr) return 'futuro'
  if (txCount === 0) return 'tarjeta_nueva'
  return 'actual'
}

export function sumMoneyValues(values: Array<number | string>): number {
  const total = values.reduce(
    (acc, value) => Money.add(acc, Money.from(value)),
    Money.from(0),
  )

  return Money.toNumber(total)
}

export function formatDateISO(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}
