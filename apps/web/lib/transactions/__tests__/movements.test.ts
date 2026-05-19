import { describe, expect, it } from 'vitest'
import { toFinancialMovement } from '../movements'
import type { TransactionWithDetails } from '../types'

const baseTx = (overrides: Partial<TransactionWithDetails>): TransactionWithDetails => ({
  id: '11111111-1111-1111-1111-111111111111',
  user_id: '22222222-2222-2222-2222-222222222222',
  account_id: '33333333-3333-3333-3333-333333333333',
  category_id: null,
  subcategory_id: null,
  transfer_destination_account_id: null,
  type: 'expense',
  amount: 100,
  currency_code: 'ARS',
  date: '2026-05-18',
  description: null,
  is_verified: false,
  created_at: '2026-05-18T15:00:00.000Z',
  status: null,
  due_date: null,
  is_parent: false,
  parent_id: null,
  installment_n: null,
  installments_total: null,
  card_period_id: null,
  fx_rate_to_ars: null,
  category: null,
  subcategory: null,
  source_account: {
    id: '33333333-3333-3333-3333-333333333333',
    name: 'Galicia',
    type: 'bank',
  },
  destination_account: null,
  period_payments: null,
  ...overrides,
})

describe('toFinancialMovement', () => {
  it('maps transfer rows as one functional movement with source and destination', () => {
    const movement = toFinancialMovement(baseTx({
      type: 'transfer',
      transfer_destination_account_id: '44444444-4444-4444-4444-444444444444',
      destination_account: {
        id: '44444444-4444-4444-4444-444444444444',
        name: 'Efectivo',
        type: 'cash',
      },
    }))

    expect(movement).toMatchObject({
      kind: 'transfer',
      title: 'Transferencia',
      account_name: 'Galicia',
      destination_account_name: 'Efectivo',
      detail_href: '/transactions/11111111-1111-1111-1111-111111111111',
      sign: null,
    })
  })

  it('preserves adjustment sign as functional meaning', () => {
    const movement = toFinancialMovement(baseTx({
      type: 'adjustment',
      amount: -25,
    }))

    expect(movement).toMatchObject({
      kind: 'adjustment',
      sign: '-',
      amount: 25,
    })
  })

  it('marks income or expense without category for review', () => {
    const movement = toFinancialMovement(baseTx({
      type: 'income',
      category: null,
    }))

    expect(movement.review_flags).toContain('missing_category')
  })

  it('maps card period payment without category review', () => {
    const movement = toFinancialMovement(baseTx({
      type: 'expense',
      category: null,
      description: 'Pago de tarjeta Visa',
      period_payments: [{
        id: '55555555-5555-5555-5555-555555555555',
        period_id: '66666666-6666-6666-6666-666666666666',
      }],
    }))

    expect(movement).toMatchObject({
      kind: 'card_payment',
      title: 'Pago de resumen',
      sign: '-',
      period_id: '66666666-6666-6666-6666-666666666666',
      review_flags: [],
    })
  })

  it('maps installment parents as one purchase on the purchase date', () => {
    const movement = toFinancialMovement(baseTx({
      account_id: null,
      is_parent: true,
      amount: 300,
      installments_total: 3,
      source_account: null,
    }))

    expect(movement).toMatchObject({
      kind: 'installment_purchase',
      installments_total: 3,
      date: '2026-05-18',
      amount: 300,
      detail_href: '/transactions/11111111-1111-1111-1111-111111111111',
    })
  })
})
