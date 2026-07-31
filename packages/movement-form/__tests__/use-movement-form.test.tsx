import { describe, expect, it, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useMovementForm } from '../src/use-movement-form'
import type {
  CategoryWithSubcategories,
  MovementFormAccount,
  Mutators,
  UseMovementFormArgs,
} from '../src/types'

const cashAccount: MovementFormAccount = {
  id: 'acc-cash',
  name: 'Efectivo',
  type: 'cash',
  activeCurrencies: ['ARS'],
  balances: { ARS: 10_000, USD: 0 },
  institutionId: null,
}

const cardAccount: MovementFormAccount = {
  id: 'acc-credit',
  name: 'Visa',
  type: 'credit',
  activeCurrencies: ['ARS'],
  balances: { ARS: 0, USD: 0 },
  institutionId: 'bank-1',
}

const groceriesCategory: CategoryWithSubcategories = {
  id: 'cat-groceries',
  name: 'Supermercado',
  type: 'expense',
  subcategories: [],
}

const stubMutators = (): Mutators => ({
  createIncome: vi.fn(async () => ({ ok: true as const, id: 'tx-1' })),
  createExpense: vi.fn(async () => ({ ok: true as const, id: 'tx-2' })),
  createTransfer: vi.fn(async () => ({ ok: true as const, id: 'tx-3' })),
  createAdjustment: vi.fn(async () => ({ ok: true as const, id: 'tx-4' })),
  createExchange: vi.fn(async () => ({ ok: true as const, id: 'tx-5' })),
  updateTransaction: vi.fn(async () => ({ ok: true as const })),
  updateTransfer: vi.fn(async () => ({ ok: true as const })),
  updateAdjustment: vi.fn(async () => ({ ok: true as const })),
  updateExchange: vi.fn(async () => ({ ok: true as const })),
  updateInstallmentParent: vi.fn(async () => ({ ok: true as const })),
  saveExpenseReimbursement: vi.fn(async () => ({ ok: true as const })),
  registerCardPurchase: vi.fn(async () => ({ ok: true as const, id: 'tx-6' })),
  registerInstallments: vi.fn(async () => ({ ok: true as const, parentId: 'tx-7' })),
  createRecurrenceFromMovement: vi.fn(async () => ({ ok: true as const, id: 'rec-1' })),
  createRecurrenceDirect: vi.fn(async () => ({ ok: true as const, id: 'rec-2' })),
  suggestCategoryFromHistory: vi.fn(async () => null),
})

const baseArgs = (overrides: Partial<UseMovementFormArgs> = {}): UseMovementFormArgs => ({
  mutators: overrides.mutators ?? stubMutators(),
  accounts: overrides.accounts ?? [cashAccount, cardAccount],
  categories: overrides.categories ?? [groceriesCategory],
  today: new Date('2026-06-01T00:00:00Z'),
  translate: (key) => key,
  ...overrides,
})

describe('useMovementForm — defaults and cascades', () => {
  it('starts on the expense tab and pre-selects the first eligible account', () => {
    const { result } = renderHook(() => useMovementForm(baseArgs()))
    expect(result.current.tab).toBe('expense')
    expect(result.current.accountId).toBe('acc-cash')
    expect(result.current.currencyCode).toBe('ARS')
    expect(result.current.isEdit).toBe(false)
  })

  it('changing tab to transfer drops the credit-card account from eligibility', () => {
    const { result } = renderHook(() => useMovementForm(baseArgs()))
    act(() => result.current.setTab('transfer'))
    expect(result.current.tab).toBe('transfer')
    expect(result.current.eligibleAccounts.find((a) => a.id === 'acc-credit')).toBeUndefined()
  })

  it('changing tab clears category, subcategory, and suggestion', () => {
    const { result } = renderHook(() => useMovementForm(baseArgs()))
    act(() => result.current.setCategoryId('cat-groceries'))
    expect(result.current.categoryId).toBe('cat-groceries')
    act(() => result.current.setTab('income'))
    expect(result.current.categoryId).toBe('')
    expect(result.current.subcategoryId).toBe('')
    expect(result.current.suggestion).toBeNull()
  })

  it('swapAccounts exchanges source and destination', () => {
    const accounts = [cashAccount, { ...cashAccount, id: 'acc-bank', name: 'Banco' }]
    const { result } = renderHook(() => useMovementForm(baseArgs({ accounts })))
    act(() => result.current.setTab('transfer'))
    act(() => result.current.setDestinationAccountId('acc-bank'))
    expect(result.current.accountId).toBe('acc-cash')
    expect(result.current.destinationAccountId).toBe('acc-bank')
    act(() => result.current.swapAccounts())
    expect(result.current.accountId).toBe('acc-bank')
    expect(result.current.destinationAccountId).toBe('acc-cash')
  })

  it('credit-card account with installments ≥ 2 surfaces isInstallments', () => {
    const { result } = renderHook(() => useMovementForm(baseArgs()))
    act(() => result.current.setAccountId('acc-credit'))
    expect(result.current.isCredit).toBe(true)
    expect(result.current.isInstallments).toBe(false)
    act(() => result.current.setInstallments('3'))
    expect(result.current.isInstallments).toBe(true)
  })
})

describe('useMovementForm — submit dispatcher', () => {
  it('rejects submit when the amount is empty', async () => {
    const { result } = renderHook(() => useMovementForm(baseArgs()))
    act(() => result.current.setCategoryId('cat-groceries'))
    await act(async () => {
      result.current.onSubmit()
    })
    expect(result.current.formError).toBe('errors.amount_positive')
  })

  it('rejects expense submit without a category', async () => {
    const { result } = renderHook(() => useMovementForm(baseArgs()))
    act(() => result.current.setAmount('100'))
    await act(async () => {
      result.current.onSubmit()
    })
    expect(result.current.formError).toBe('errors.category_required_short')
  })

  it('dispatches to createIncome on the income tab', async () => {
    const mutators = stubMutators()
    const { result } = renderHook(() => useMovementForm(baseArgs({ mutators })))
    act(() => result.current.setTab('income'))
    act(() => result.current.setAmount('1500'))
    act(() => result.current.setCategoryId('cat-groceries'))
    await act(async () => {
      result.current.onSubmit()
    })
    expect(mutators.createIncome).toHaveBeenCalledOnce()
    const call = (mutators.createIncome as ReturnType<typeof vi.fn>).mock.calls[0][0] as {
      amount: number
      category_id: string
    }
    expect(call.amount).toBe(1500)
    expect(call.category_id).toBe('cat-groceries')
  })

  it('recurrent + FUTURE date creates the rule directly, without a seed movement', async () => {
    const mutators = stubMutators()
    const { result } = renderHook(() => useMovementForm(baseArgs({ mutators })))
    act(() => result.current.setAmount('9000'))
    act(() => result.current.setCategoryId('cat-groceries'))
    act(() => result.current.setIsRecurrent(true))
    act(() => result.current.setDate('2026-06-10')) // today is 2026-06-01
    await act(async () => {
      result.current.onSubmit()
    })
    expect(mutators.createExpense).not.toHaveBeenCalled()
    expect(mutators.createRecurrenceFromMovement).not.toHaveBeenCalled()
    expect(mutators.createRecurrenceDirect).toHaveBeenCalledOnce()
    const call = (mutators.createRecurrenceDirect as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as {
      movement_type: string
      start_date: string
      amount: number
      category_id: string
      frequency: string
    }
    expect(call.movement_type).toBe('expense')
    expect(call.start_date).toBe('2026-06-10')
    expect(call.amount).toBe(9000)
    expect(call.category_id).toBe('cat-groceries')
    expect(call.frequency).toBe('monthly')
  })

  it('recurrent with TODAY date keeps the seed flow (movement + rule from movement)', async () => {
    const mutators = stubMutators()
    const { result } = renderHook(() => useMovementForm(baseArgs({ mutators })))
    act(() => result.current.setAmount('9000'))
    act(() => result.current.setCategoryId('cat-groceries'))
    act(() => result.current.setIsRecurrent(true))
    await act(async () => {
      result.current.onSubmit()
    })
    expect(mutators.createExpense).toHaveBeenCalledOnce()
    expect(mutators.createRecurrenceFromMovement).toHaveBeenCalledOnce()
    expect(mutators.createRecurrenceDirect).not.toHaveBeenCalled()
  })

  it('a future-dated NON-recurrent expense still creates the movement', async () => {
    const mutators = stubMutators()
    const { result } = renderHook(() => useMovementForm(baseArgs({ mutators })))
    act(() => result.current.setAmount('9000'))
    act(() => result.current.setCategoryId('cat-groceries'))
    act(() => result.current.setDate('2026-06-10'))
    await act(async () => {
      result.current.onSubmit()
    })
    expect(mutators.createExpense).toHaveBeenCalledOnce()
    expect(mutators.createRecurrenceDirect).not.toHaveBeenCalled()
  })

  it('dispatches to registerInstallments when credit card + 3 cuotas', async () => {
    const mutators = stubMutators()
    const { result } = renderHook(() => useMovementForm(baseArgs({ mutators })))
    act(() => result.current.setAccountId('acc-credit'))
    act(() => result.current.setAmount('12000'))
    act(() => result.current.setCategoryId('cat-groceries'))
    act(() => result.current.setInstallments('3'))
    await act(async () => {
      result.current.onSubmit()
    })
    expect(mutators.registerInstallments).toHaveBeenCalledOnce()
    expect(mutators.registerCardPurchase).not.toHaveBeenCalled()
  })
})
