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
      fields({ amount: true, date: true, category: true, subcategory: true, description: true, shared: true, reimbursement: true, account: false }),
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
      fields({ amount: true, date: true, category: true, subcategory: true, description: true, shared: true, reimbursement: true, account: false }),
    )
  })

  it('paid consumption: only category + description (amount/date locked)', () => {
    expect(getEditableFields(input({ type: 'expense', status: 'paid' }))).toEqual(
      fields({ category: true, subcategory: true, description: true, shared: true, reimbursement: true, account: false }),
    )
  })
})

describe('getEditableFields — statement-payment expense (no category)', () => {
  it('card payment: amount + date + description, category hidden, account editable', () => {
    expect(getEditableFields(input({ type: 'expense', isCardPayment: true }))).toEqual(
      fields({ amount: true, date: true, description: true, shared: false, reimbursement: false, account: true }),
    )
  })
})

describe('getEditableFields — installment parent (madre)', () => {
  it('no paid installment: amount re-splits, category/description, date never', () => {
    expect(
      getEditableFields(input({ type: 'expense', isParent: true, hasPaidInstallment: false })),
    ).toEqual(
      fields({ amount: true, category: true, subcategory: true, description: true, shared: true, reimbursement: true }),
    )
  })

  it('some paid installment: amount + date locked, only category/description', () => {
    expect(
      getEditableFields(input({ type: 'expense', isParent: true, hasPaidInstallment: true })),
    ).toEqual(
      fields({ category: true, subcategory: true, description: true, shared: true, reimbursement: true }),
    )
  })

  it('parent date is never editable, regardless of paid state', () => {
    expect(getEditableFields(input({ isParent: true, hasPaidInstallment: false })).date).toBe(false)
    expect(getEditableFields(input({ isParent: true, hasPaidInstallment: true })).date).toBe(false)
  })
})

describe('getEditableFields — installment child (single cuota)', () => {
  it('fully locked: no field editable, edits route to the parent', () => {
    expect(
      getEditableFields(input({ type: 'expense', status: 'pending', isInstallmentChild: true })),
    ).toEqual(fields({ shared: false, reimbursement: false }))
  })

  it('stays locked even if not yet paid', () => {
    const f = getEditableFields(input({ type: 'expense', status: 'pending', isInstallmentChild: true }))
    expect(f.amount).toBe(false)
    expect(f.date).toBe(false)
    expect(f.category).toBe(false)
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

  it('account is editable only for a statement-payment expense', () => {
    expect(getEditableFields(input({ type: 'expense', isCardPayment: true })).account).toBe(true)
    // Non-payment expenses and every other type keep the account immutable.
    expect(getEditableFields(input({ type: 'expense', status: null })).account).toBe(false)
    expect(getEditableFields(input({ type: 'expense', status: 'paid' })).account).toBe(false)
    expect(getEditableFields(input({ isParent: true })).account).toBeFalsy()
    for (const type of ['income', 'transfer', 'adjustment', 'exchange'] as const) {
      expect(getEditableFields(input({ type })).account).toBeFalsy()
    }
  })

  it('reimbursement is editable only on a categorizable expense (and the madre)', () => {
    // Simple / card expense and the installment parent can carry a reintegro.
    expect(getEditableFields(input({ type: 'expense', status: null })).reimbursement).toBe(true)
    expect(getEditableFields(input({ type: 'expense', status: 'paid' })).reimbursement).toBe(true)
    expect(getEditableFields(input({ isParent: true })).reimbursement).toBe(true)
    // Statement-payment expense, installment child, and non-expense types cannot.
    expect(getEditableFields(input({ type: 'expense', isCardPayment: true })).reimbursement).toBe(false)
    expect(
      getEditableFields(input({ type: 'expense', isInstallmentChild: true })).reimbursement,
    ).toBe(false)
    for (const type of ['income', 'transfer', 'adjustment', 'exchange'] as const) {
      expect(getEditableFields(input({ type })).reimbursement).toBeFalsy()
    }
  })
})
