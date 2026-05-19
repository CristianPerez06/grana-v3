import { describe, expect, it } from 'vitest'
import {
  mapInstanceToConfirmPlan,
  RecurrenceMapError,
  type ConfirmInstanceContext,
} from '../mapper'
import type { RecurrenceInstance } from '../types'

function buildInstance(
  overrides: Partial<RecurrenceInstance> = {},
): RecurrenceInstance {
  return {
    id: '11111111-1111-1111-1111-111111111111',
    recurrence_id: '22222222-2222-2222-2222-222222222222',
    user_id: '33333333-3333-3333-3333-333333333333',
    scheduled_date: '2026-06-01',
    status: 'pending',
    amount: 1234.56,
    account_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    transfer_destination_account_id: null,
    currency_code: 'ARS',
    category_id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
    subcategory_id: null,
    description: 'Sueldo',
    confirmed_transaction_id: null,
    created_at: '2026-05-20T00:00:00.000Z',
    resolved_at: null,
    ...overrides,
  } as RecurrenceInstance
}

const cashContext: ConfirmInstanceContext = {
  movementType: 'income',
  accountType: 'cash',
}

describe('mapInstanceToConfirmPlan', () => {
  // Tests 6.3 / 6.4 / 6.5 from openspec/changes/add-recurring-movements/tasks.md:
  // confirm delegates to the correct creation flow per movement_type +
  // accountType, producing the right transactions.* row shape downstream.

  it('maps an income instance on a cash account to a createIncome input', () => {
    const plan = mapInstanceToConfirmPlan(buildInstance(), cashContext)
    expect(plan.kind).toBe('income')
    if (plan.kind !== 'income') throw new Error('expected income')
    expect(plan.input).toEqual({
      account_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      currency_code: 'ARS',
      amount: 1234.56,
      date: '2026-06-01',
      category_id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
      description: 'Sueldo',
    })
  })

  it('maps an expense instance on a bank account to a createExpense input', () => {
    const plan = mapInstanceToConfirmPlan(
      buildInstance({ description: 'Netflix' }),
      { movementType: 'expense', accountType: 'bank' },
    )
    expect(plan.kind).toBe('expense')
    if (plan.kind !== 'expense') throw new Error('expected expense')
    expect(plan.input.account_id).toBe('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')
    expect(plan.input.amount).toBe(1234.56)
    expect(plan.input.description).toBe('Netflix')
  })

  it('maps an expense instance on a credit account (ARS) to a card purchase input', () => {
    const plan = mapInstanceToConfirmPlan(buildInstance(), {
      movementType: 'expense',
      accountType: 'credit',
    })
    expect(plan.kind).toBe('card_purchase')
    if (plan.kind !== 'card_purchase') throw new Error('expected card_purchase')
    expect(plan.input.currency_code).toBe('ARS')
    expect(plan.input).not.toHaveProperty('fx_rate_to_ars')
  })

  it('maps a USD expense on a credit account when fx rate is provided at confirm time', () => {
    const plan = mapInstanceToConfirmPlan(
      buildInstance({ currency_code: 'USD' }),
      { movementType: 'expense', accountType: 'credit', fxRateToArs: 1234.5 },
    )
    expect(plan.kind).toBe('card_purchase')
    if (plan.kind !== 'card_purchase') throw new Error('expected card_purchase')
    expect(plan.input.currency_code).toBe('USD')
    expect(plan.input.fx_rate_to_ars).toBe(1234.5)
  })

  it('rejects a USD expense on a credit account when fx rate is missing', () => {
    expect(() =>
      mapInstanceToConfirmPlan(
        buildInstance({ currency_code: 'USD' }),
        { movementType: 'expense', accountType: 'credit' },
      ),
    ).toThrow(RecurrenceMapError)
  })

  it('rejects a USD expense on a credit account when fx rate is non-positive', () => {
    expect(() =>
      mapInstanceToConfirmPlan(
        buildInstance({ currency_code: 'USD' }),
        { movementType: 'expense', accountType: 'credit', fxRateToArs: 0 },
      ),
    ).toThrow(RecurrenceMapError)
  })

  it('rejects fx rate on an ARS card purchase', () => {
    expect(() =>
      mapInstanceToConfirmPlan(buildInstance(), {
        movementType: 'expense',
        accountType: 'credit',
        fxRateToArs: 1000,
      }),
    ).toThrow(RecurrenceMapError)
  })

  it('rejects fx rate on a non-credit expense', () => {
    expect(() =>
      mapInstanceToConfirmPlan(
        buildInstance({ currency_code: 'USD' }),
        { movementType: 'expense', accountType: 'cash', fxRateToArs: 1000 },
      ),
    ).toThrow(RecurrenceMapError)
  })

  it('maps a transfer instance to a createTransfer input', () => {
    const plan = mapInstanceToConfirmPlan(
      buildInstance({
        transfer_destination_account_id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        category_id: null,
      }),
      { movementType: 'transfer', accountType: 'cash' },
    )
    expect(plan.kind).toBe('transfer')
    if (plan.kind !== 'transfer') throw new Error('expected transfer')
    expect(plan.input.transfer_destination_account_id).toBe(
      'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    )
  })

  it('rejects a transfer with missing destination', () => {
    expect(() =>
      mapInstanceToConfirmPlan(buildInstance(), {
        movementType: 'transfer',
        accountType: 'cash',
      }),
    ).toThrow(RecurrenceMapError)
  })

  it('rejects a transfer originating from a credit card', () => {
    expect(() =>
      mapInstanceToConfirmPlan(
        buildInstance({
          transfer_destination_account_id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        }),
        { movementType: 'transfer', accountType: 'credit' },
      ),
    ).toThrow(RecurrenceMapError)
  })

  it('rejects an income on a credit account', () => {
    expect(() =>
      mapInstanceToConfirmPlan(buildInstance(), {
        movementType: 'income',
        accountType: 'credit',
      }),
    ).toThrow(RecurrenceMapError)
  })

  it('rejects an income with missing category', () => {
    expect(() =>
      mapInstanceToConfirmPlan(
        buildInstance({ category_id: null }),
        { movementType: 'income', accountType: 'cash' },
      ),
    ).toThrow(RecurrenceMapError)
  })

  it('rejects an expense with missing category', () => {
    expect(() =>
      mapInstanceToConfirmPlan(
        buildInstance({ category_id: null }),
        { movementType: 'expense', accountType: 'cash' },
      ),
    ).toThrow(RecurrenceMapError)
  })

  it('coerces string amounts (NUMERIC returning string) to numbers', () => {
    const plan = mapInstanceToConfirmPlan(
      buildInstance({ amount: '999.99' as unknown as number }),
      cashContext,
    )
    if (plan.kind !== 'income') throw new Error('expected income')
    expect(plan.input.amount).toBe(999.99)
  })

  it('omits subcategory_id and description when null', () => {
    const plan = mapInstanceToConfirmPlan(
      buildInstance({ subcategory_id: null, description: null }),
      cashContext,
    )
    if (plan.kind !== 'income') throw new Error('expected income')
    expect(plan.input).not.toHaveProperty('subcategory_id')
    expect(plan.input).not.toHaveProperty('description')
  })
})
