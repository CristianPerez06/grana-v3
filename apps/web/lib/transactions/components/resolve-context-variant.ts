import type { FinancialMovement } from '../movements'
import type { TransactionWithDetails } from '../types'

// Pure helper that decides which in-context pedagogy note to render below the
// hero of the transaction detail. Tested in __tests__/resolve-context-variant.
// test.ts. Returns null when no copy applies (income cash, expense cash,
// transfer, exchange, ajuste, reimbursement received, etc.).
//
// Editorial copy lives in i18n under `transactions.detail.context.{variant}`.

export type ContextVariant =
  | 'card-pending'           // consumo/cuota hija en cuenta de tarjeta, período no pagado
  | 'card-paid-installment'  // cuota hija ya pagada (segunda en adelante)
  | 'card-payment'           // pago de resumen
  | 'reimbursement-pending'  // reintegro esperado, no recibido
  | 'reimbursement-cancelled' // reintegro cancelado

export const resolveContextVariant = (
  movement: FinancialMovement,
  transaction: TransactionWithDetails,
): ContextVariant | null => {
  // Pago de resumen: detectable por la presencia de `period_payments` en la
  // transaction. Lo chequeamos primero porque un statement payment es un
  // expense con `card_period_id IS NULL` que cubre cuotas off-ledger.
  if (movement.kind === 'card_payment') return 'card-payment'

  // Reintegros: solo tienen variant cuando son pending o cancelled (received
  // ya impacta el saldo, no necesita pedagogía).
  if (movement.kind === 'reimbursement') {
    if (movement.state === 'pending') return 'reimbursement-pending'
    if (movement.state === 'cancelled') return 'reimbursement-cancelled'
    return null
  }

  // Cuota hija ya pagada (segunda en adelante). La primera la omitimos para
  // no ruidear el detalle de la primer cuota recién pagada.
  if (
    transaction.parent_id &&
    transaction.status === 'paid' &&
    (transaction.installment_n ?? 0) > 1
  ) {
    return 'card-paid-installment'
  }

  // Consumo directo o cuota hija en cuenta de tarjeta cuyo período aún no fue
  // pagado. `source_account.type === 'credit'` + `status === 'pending'` cubre
  // ambos casos.
  if (
    transaction.source_account?.type === 'credit' &&
    transaction.status === 'pending'
  ) {
    return 'card-pending'
  }

  return null
}
