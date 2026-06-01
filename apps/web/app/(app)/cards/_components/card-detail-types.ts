import type { CardPeriodDetail, ActiveInstallment } from '@/lib/cards/queries'

/** Which statement the detail view is focused on. */
export type PeriodKey = 'apagar' | 'curso' | 'prox'

/** A statement enriched for the detail view (period + its display transactions). */
export type LifecyclePeriod = CardPeriodDetail

/**
 * Plain, serializable view model the server page builds and hands to the
 * client `CardDetailView`. No functions, no Date objects — only data.
 */
export type CardDetailViewModel = {
  cardId: string
  accent: string
  creditLimit: number | null
  /** Already-committed total in ARS (sum across visible statements), for the limit panel. */
  committedARS: number
  hasUSD: boolean
  /** Whether at least one statement is already paid (drives the timeline "Pagado" step). */
  hasPaid: boolean
  /** The three lifecycle statements; `apagar`/`prox` may be absent. */
  apagar: LifecyclePeriod | null
  curso: LifecyclePeriod
  prox: LifecyclePeriod | null
  /** Day X of the current cycle and its total length, for the cycle panel. */
  cursoCycleDay: number
  cursoCycleTotal: number
  /** Installments committed within the current cycle (ARS), or 0. */
  cursoInstallmentsARS: number
  /** Days until the current statement closes. */
  cursoDaysToClose: number
  /** Days until / since the a-pagar statement's due date (negative = overdue). */
  apagarDaysToDue: number | null
  /** Active installment purchases for the "Cuotas en curso" tab. */
  installments: ActiveInstallment[]
  installmentsTotalRemaining: number
}
