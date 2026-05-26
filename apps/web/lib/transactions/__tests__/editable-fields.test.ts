import { describe, it, expect } from 'vitest'
import { getEditableFields, type MovementEditInput, type EditableFields } from '@grana/money-logic'

const input = (over: Partial<MovementEditInput>): MovementEditInput => ({
  type: 'expense',
  status: null,
  isParent: false,
  isCardPayment: false,
  hasPaidInstallment: false,
  ...over,
})

const ALL_FALSE: EditableFields = {
  amount: false,
  date: false,
  category: false,
  subcategory: false,
  description: false,
  adjustmentDirection: false,
  destinationAmount: false,
}

const fields = (over: Partial<EditableFields>): EditableFields => ({ ...ALL_FALSE, ...over })

describe('getEditableFields — cash/bank income & expense', () => {
  it('income: amount, date, category, subcategory, description', () => {
    expect(getEditableFields(input({ type: 'income' }))).toEqual(
      fields({ amount: true, date: true, category: true, subcategory: true, description: true }),
    )
  })

  it('expense (cash/bank): amount, date, category, subcategory, description', () => {
    expect(getEditableFields(input({ type: 'expense', status: null }))).toEqual(
      fields({ amount: true, date: true, category: true, subcategory: true, description: true }),
    )
  })
})

describe('getEditableFields — transfer / adjustment / exchange', () => {
  it('transfer: amount, date, description (no category)', () => {
    expect(getEditableFields(input({ type: 'transfer' }))).toEqual(
      fields({ amount: true, date: true, description: true }),
    )
  })

  it('adjustment: amount, date, description + direction (no category)', () => {
    expect(getEditableFields(input({ type: 'adjustment' }))).toEqual(
      fields({ amount: true, date: true, description: true, adjustmentDirection: true }),
    )
  })

  it('exchange: amount, date, description + destinationAmount (no category)', () => {
    expect(getEditableFields(input({ type: 'exchange' }))).toEqual(
      fields({ amount: true, date: true, description: true, destinationAmount: true }),
    )
  })
})

describe('getEditableFields — credit-card consumption by status', () => {
  it('pending consumption: amount + date editable + category', () => {
    expect(getEditableFields(input({ type: 'expense', status: 'pending' }))).toEqual(
      fields({ amount: true, date: true, category: true, subcategory: true, description: true }),
    )
  })

  it('paid consumption: only category + description (amount/date locked)', () => {
    expect(getEditableFields(input({ type: 'expense', status: 'paid' }))).toEqual(
      fields({ category: true, subcategory: true, description: true }),
    )
  })
})

describe('getEditableFields — statement-payment expense (no category)', () => {
  it('card payment: amount + date + description, category hidden', () => {
    expect(getEditableFields(input({ type: 'expense', isCardPayment: true }))).toEqual(
      fields({ amount: true, date: true, description: true }),
    )
  })
})

describe('getEditableFields — installment parent (madre)', () => {
  it('no paid installment: amount re-splits, category/description, date never', () => {
    expect(
      getEditableFields(input({ type: 'expense', isParent: true, hasPaidInstallment: false })),
    ).toEqual(
      fields({ amount: true, category: true, subcategory: true, description: true }),
    )
  })

  it('some paid installment: amount + date locked, only category/description', () => {
    expect(
      getEditableFields(input({ type: 'expense', isParent: true, hasPaidInstallment: true })),
    ).toEqual(
      fields({ category: true, subcategory: true, description: true }),
    )
  })

  it('parent date is never editable, regardless of paid state', () => {
    expect(getEditableFields(input({ isParent: true, hasPaidInstallment: false })).date).toBe(false)
    expect(getEditableFields(input({ isParent: true, hasPaidInstallment: true })).date).toBe(false)
  })
})

describe('getEditableFields — invariants', () => {
  const types = ['income', 'expense', 'transfer', 'adjustment', 'exchange'] as const

  it('description is always editable', () => {
    for (const type of types) {
      expect(getEditableFields(input({ type })).description).toBe(true)
    }
  })

  it('only adjustment exposes the direction toggle', () => {
    for (const type of types) {
      expect(getEditableFields(input({ type })).adjustmentDirection).toBe(type === 'adjustment')
    }
  })

  it('only exchange exposes the destination amount', () => {
    for (const type of types) {
      expect(getEditableFields(input({ type })).destinationAmount).toBe(type === 'exchange')
    }
  })
})
