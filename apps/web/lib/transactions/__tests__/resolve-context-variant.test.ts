import { describe, expect, it } from 'vitest'
import { resolveContextVariant } from '@/lib/transactions/components/resolve-context-variant'
import type { FinancialMovement } from '@/lib/transactions/movements'
import type { TransactionWithDetails } from '@/lib/transactions/types'

// Minimal factories so tests stay focused on the decision matrix. The helper
// only looks at: movement.kind, movement.state (reimbursements), transaction
// .parent_id, .status, .installment_n, .source_account?.type. Anything else
// is filler that satisfies the type.

const tx = (overrides: Partial<TransactionWithDetails> = {}): TransactionWithDetails =>
  ({
    id: 'tx-1',
    user_id: 'u',
    account_id: 'a',
    category_id: null,
    subcategory_id: null,
    transfer_destination_account_id: null,
    type: 'expense',
    amount: 100,
    currency_code: 'ARS',
    destination_amount: null,
    destination_currency: null,
    date: '2026-05-27',
    description: null,
    created_at: '2026-05-27T00:00:00Z',
    status: null,
    due_date: null,
    is_parent: false,
    parent_id: null,
    installment_n: null,
    installments_total: null,
    card_period_id: null,
    fx_rate_to_ars: null,
    linked_transaction_id: null,
    reimbursement_target: null,
    estimated_amount: null,
    received_at: null,
    cancelled_at: null,
    category: null,
    subcategory: null,
    destination_account: null,
    source_account: null,
    period_payments: null,
    ...overrides,
  }) as TransactionWithDetails

const mv = (kind: FinancialMovement['kind'], extra: Record<string, unknown> = {}): FinancialMovement =>
  ({
    id: 'tx-1',
    date: '2026-05-27',
    created_at: '2026-05-27T00:00:00Z',
    amount: 100,
    currency_code: 'ARS',
    description: null,
    account_id: 'a',
    account_name: null,
    category_id: null,
    category_name: null,
    category_icon: null,
    category_color: null,
    detail_href: '/transactions/tx-1',
    review_flags: [],
    kind,
    sign: '-',
    ...extra,
  }) as unknown as FinancialMovement

describe('resolveContextVariant', () => {
  it('card_payment → card-payment', () => {
    expect(
      resolveContextVariant(mv('card_payment', { title: 'Pago' }), tx()),
    ).toBe('card-payment')
  })

  it('reimbursement pending → reimbursement-pending', () => {
    expect(
      resolveContextVariant(
        mv('reimbursement', { sign: '+', title: 'R', state: 'pending' }),
        tx({ type: 'reimbursement', received_at: null, cancelled_at: null }),
      ),
    ).toBe('reimbursement-pending')
  })

  it('reimbursement cancelled → reimbursement-cancelled', () => {
    expect(
      resolveContextVariant(
        mv('reimbursement', { sign: '+', title: 'R', state: 'cancelled' }),
        tx({ type: 'reimbursement', cancelled_at: '2026-05-28' }),
      ),
    ).toBe('reimbursement-cancelled')
  })

  it('reimbursement received → null (no necesita copy, ya impactó)', () => {
    expect(
      resolveContextVariant(
        mv('reimbursement', { sign: '+', title: 'R', state: 'received' }),
        tx({ type: 'reimbursement', received_at: '2026-05-28' }),
      ),
    ).toBeNull()
  })

  it('cuota hija paid con installment_n > 1 → card-paid-installment', () => {
    expect(
      resolveContextVariant(
        mv('expense'),
        tx({
          parent_id: 'p',
          status: 'paid',
          installment_n: 2,
          source_account: { id: 'card', name: 'Visa', type: 'credit' },
        }),
      ),
    ).toBe('card-paid-installment')
  })

  it('cuota hija paid con installment_n=1 → null (no ruidea la primera)', () => {
    expect(
      resolveContextVariant(
        mv('expense'),
        tx({
          parent_id: 'p',
          status: 'paid',
          installment_n: 1,
          source_account: { id: 'card', name: 'Visa', type: 'credit' },
        }),
      ),
    ).toBeNull()
  })

  it('consumo directo en cuenta credit con status pending → card-pending', () => {
    expect(
      resolveContextVariant(
        mv('expense'),
        tx({
          status: 'pending',
          source_account: { id: 'card', name: 'Visa', type: 'credit' },
        }),
      ),
    ).toBe('card-pending')
  })

  it('cuota hija pending en cuenta credit → card-pending (prioriza la regla más útil)', () => {
    expect(
      resolveContextVariant(
        mv('expense'),
        tx({
          parent_id: 'p',
          status: 'pending',
          installment_n: 2,
          source_account: { id: 'card', name: 'Visa', type: 'credit' },
        }),
      ),
    ).toBe('card-pending')
  })

  it('expense cash → null (no necesita copy)', () => {
    expect(
      resolveContextVariant(
        mv('expense'),
        tx({
          source_account: { id: 'cash', name: 'Billetera', type: 'cash' },
        }),
      ),
    ).toBeNull()
  })

  it('income cash → null', () => {
    expect(
      resolveContextVariant(
        mv('income', { sign: '+', title: 'Sueldo' }),
        tx({
          type: 'income',
          source_account: { id: 'bank', name: 'Galicia', type: 'bank' },
        }),
      ),
    ).toBeNull()
  })

  it('transfer → null', () => {
    expect(
      resolveContextVariant(
        mv('transfer', { sign: '-', title: 'T' }),
        tx({ type: 'transfer' }),
      ),
    ).toBeNull()
  })

  it('exchange → null', () => {
    expect(
      resolveContextVariant(
        mv('exchange', { sign: '-', title: 'E' }),
        tx({ type: 'exchange' }),
      ),
    ).toBeNull()
  })

  it('adjustment → null', () => {
    expect(
      resolveContextVariant(
        mv('adjustment', { sign: '+', title: 'A' }),
        tx({ type: 'adjustment' }),
      ),
    ).toBeNull()
  })
})
