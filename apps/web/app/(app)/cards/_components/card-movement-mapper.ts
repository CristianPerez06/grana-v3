import type { CardPeriodDetail } from '@/lib/cards/queries'
import type { FinancialMovement } from '@/lib/transactions/movements'

type CardTx = CardPeriodDetail['transactions'][number]

/**
 * Map a card-period transaction (the shape returned by `getCardPeriods` /
 * `getCardPeriodDetail`) to a `FinancialMovement`, so the statement movements
 * pane can reuse the exact `MovementRow`/`MovementList` from transactions.
 *
 * Card-period rows are children (never parents): regular consumptions and
 * installment children are shown as `expense`; received statement
 * reimbursements as `reimbursement`. The installment "Cuota X de Y" chip is
 * NOT carried on the movement (the type has no slot for it) — the caller builds
 * an id→label map via `installmentChip` and passes it to `MovementList`.
 */
export const cardPeriodTransactionToMovement = (tx: CardTx): FinancialMovement => {
  const base = {
    id: tx.id,
    date: tx.date,
    created_at: tx.date,
    amount: Math.abs(Number(tx.amount)),
    currency_code: (tx.currency_code === 'USD' ? 'USD' : 'ARS') as 'ARS' | 'USD',
    description: tx.description,
    account_id: null,
    account_name: null,
    category_id: tx.category_id ?? null,
    category_name: tx.category?.name ?? null,
    category_icon: tx.category?.icon ?? null,
    category_color: tx.category?.color ?? null,
    subcategory_id: null,
    subcategory_name: tx.subcategory?.name ?? null,
    detail_href: `/transactions/${tx.id}`,
    review_flags: [] as never[],
  }

  if (tx.type === 'reimbursement') {
    return {
      ...base,
      kind: 'reimbursement',
      title: tx.description ?? 'Reintegro',
      sign: '+',
      target: 'statement',
      state: tx.received_at ? 'received' : tx.cancelled_at ? 'cancelled' : 'pending',
      linked_transaction_id: null,
    }
  }

  return {
    ...base,
    kind: 'expense',
    title: tx.description ?? tx.category?.name ?? 'Consumo',
    sign: '-',
  }
}

/** "Cuota X de Y" chip label for an installment child, or null. */
export const installmentChip = (
  tx: CardTx,
  label: (n: number, total: number) => string,
): string | null => {
  if (tx.installments_total && tx.installments_total > 1 && tx.installment_n) {
    return label(tx.installment_n, tx.installments_total)
  }
  return null
}
