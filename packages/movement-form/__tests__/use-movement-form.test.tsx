import { describe, expect, it, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useMovementForm, FREQUENT_CHIPS_MAX } from '../src/use-movement-form'
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

describe('useMovementForm — tab partition and account selector (surface)', () => {
  const bankArs2: MovementFormAccount = {
    id: 'acc-bank2',
    name: 'Banco',
    type: 'bank',
    activeCurrencies: ['ARS'],
    balances: { ARS: 5_000, USD: 0 },
    institutionId: 'bank-2',
  }
  const usdAccount: MovementFormAccount = {
    id: 'acc-usd',
    name: 'Dólares',
    type: 'bank',
    activeCurrencies: ['USD'],
    balances: { ARS: 0, USD: 500 },
    institutionId: 'bank-3',
  }

  it('one cash account + a card ⇒ only adjustment is an eligible secondary', () => {
    const { result } = renderHook(() => useMovementForm(baseArgs()))
    expect(result.current.secondaryTabs).toEqual(['adjustment'])
  })

  it('two own accounts ⇒ transfer becomes eligible', () => {
    const { result } = renderHook(() =>
      useMovementForm(baseArgs({ accounts: [cashAccount, bankArs2] })),
    )
    expect(result.current.secondaryTabs).toContain('transfer')
    expect(result.current.secondaryTabs).toContain('adjustment')
    expect(result.current.secondaryTabs).not.toContain('exchange')
  })

  it('accounts covering ARS and USD ⇒ exchange becomes eligible', () => {
    const { result } = renderHook(() =>
      useMovementForm(baseArgs({ accounts: [cashAccount, usdAccount] })),
    )
    expect(result.current.secondaryTabs).toContain('exchange')
  })

  it('isSecondaryTab reflects the active tab', () => {
    const { result } = renderHook(() => useMovementForm(baseArgs()))
    expect(result.current.isSecondaryTab).toBe(false)
    act(() => result.current.setTab('adjustment'))
    expect(result.current.isSecondaryTab).toBe(true)
  })

  it('showAccountSelector is false with a single eligible account, true with two', () => {
    const single = renderHook(() =>
      useMovementForm(baseArgs({ accounts: [cashAccount] })),
    )
    expect(single.result.current.showAccountSelector).toBe(false)

    const many = renderHook(() =>
      useMovementForm(baseArgs({ accounts: [cashAccount, cardAccount] })),
    )
    expect(many.result.current.showAccountSelector).toBe(true)
  })
})

describe('useMovementForm — frequent-classification chips (surface, #31 item 1)', () => {
  const comida: CategoryWithSubcategories = {
    id: 'cat-comida',
    name: 'Comida',
    type: 'expense',
    icon: '🍽️',
    subcategories: [
      { id: 'sub-pedidosya', name: 'Pedidos Ya', canonical_name: 'pedidos_ya', user_id: 'u1' },
    ],
  }
  const sueldo: CategoryWithSubcategories = {
    id: 'cat-sueldo',
    name: 'Sueldo',
    type: 'income',
    icon: '💰',
    subcategories: [],
  }
  const cats = [comida, sueldo]

  it('resolves a leaf chip with the subcategory label, icon and inactive state', () => {
    const { result } = renderHook(() =>
      useMovementForm(
        baseArgs({
          categories: cats,
          frequentClassifications: [{ categoryId: 'cat-comida', subcategoryId: 'sub-pedidosya' }],
        }),
      ),
    )
    expect(result.current.frequentChips).toHaveLength(1)
    const chip = result.current.frequentChips[0]
    expect(chip).toMatchObject({
      categoryId: 'cat-comida',
      subcategoryId: 'sub-pedidosya',
      label: 'Pedidos Ya',
      icon: '🍽️',
      active: false,
    })
  })

  it('a category-only leaf labels with the category name', () => {
    const { result } = renderHook(() =>
      useMovementForm(
        baseArgs({
          categories: cats,
          frequentClassifications: [{ categoryId: 'cat-comida', subcategoryId: null }],
        }),
      ),
    )
    expect(result.current.frequentChips[0]).toMatchObject({ label: 'Comida', subcategoryId: null })
  })

  it('filters by the active tab type', () => {
    const { result } = renderHook(() =>
      useMovementForm(
        baseArgs({
          categories: cats,
          frequentClassifications: [
            { categoryId: 'cat-comida', subcategoryId: 'sub-pedidosya' },
            { categoryId: 'cat-sueldo', subcategoryId: null },
          ],
        }),
      ),
    )
    // Expense tab: only the expense leaf.
    expect(result.current.frequentChips.map((c) => c.categoryId)).toEqual(['cat-comida'])
    act(() => result.current.setTab('income'))
    expect(result.current.frequentChips.map((c) => c.categoryId)).toEqual(['cat-sueldo'])
  })

  it('drops a leaf whose category is not in the catalog (archived/missing)', () => {
    const { result } = renderHook(() =>
      useMovementForm(
        baseArgs({
          categories: cats,
          frequentClassifications: [{ categoryId: 'cat-gone', subcategoryId: null }],
        }),
      ),
    )
    expect(result.current.frequentChips).toEqual([])
  })

  it('drops a leaf whose subcategory is not in the category (archived sub)', () => {
    const { result } = renderHook(() =>
      useMovementForm(
        baseArgs({
          categories: cats,
          frequentClassifications: [{ categoryId: 'cat-comida', subcategoryId: 'sub-gone' }],
        }),
      ),
    )
    expect(result.current.frequentChips).toEqual([])
  })

  it('applying a chip assigns category + subcategory and flips it active', () => {
    const { result } = renderHook(() =>
      useMovementForm(
        baseArgs({
          categories: cats,
          frequentClassifications: [{ categoryId: 'cat-comida', subcategoryId: 'sub-pedidosya' }],
        }),
      ),
    )
    const chip = result.current.frequentChips[0]
    act(() => result.current.pickCategory(chip.categoryId, chip.subcategoryId ?? ''))
    expect(result.current.categoryId).toBe('cat-comida')
    expect(result.current.subcategoryId).toBe('sub-pedidosya')
    expect(result.current.frequentChips[0].active).toBe(true)
  })

  it('offers no chips in edit mode', () => {
    const { result } = renderHook(() =>
      useMovementForm(
        baseArgs({
          categories: cats,
          frequentClassifications: [{ categoryId: 'cat-comida', subcategoryId: 'sub-pedidosya' }],
          edit: {
            id: 'tx-old',
            type: 'expense',
            status: null,
            accountId: 'acc-cash',
            destinationAccountId: null,
            isParent: false,
            parentId: null,
            amount: 5_000,
            signedAmount: -5_000,
            date: '2026-05-10',
            currencyCode: 'ARS',
            destinationCurrency: null,
            destinationAmount: null,
            categoryId: 'cat-comida',
            subcategoryId: 'sub-pedidosya',
            archivedTaxonomy: null,
            description: 'Pedido',
            installmentsTotal: null,
            sourceAccountName: 'Efectivo',
            destinationAccountName: null,
            editableFields: {
              amount: true,
              date: true,
              category: true,
              subcategory: true,
              description: true,
              adjustmentDirection: false,
              destinationAmount: false,
            },
            availableBalance: 10_000,
          },
        }),
      ),
    )
    expect(result.current.frequentChips).toEqual([])
  })

  it('shows no chips without history when the catalog has no default leaves', () => {
    // `cats` lacks the default canonical_names, so nothing resolves.
    const { result } = renderHook(() => useMovementForm(baseArgs({ categories: cats })))
    expect(result.current.frequentChips).toEqual([])
  })

  // New-user defaults, resolved by canonical_name (labels can be renamed/i18n'd).
  const seedComida: CategoryWithSubcategories = {
    id: 'c-comida',
    name: 'Comida',
    type: 'expense',
    icon: '🍔',
    canonical_name: 'comida',
    subcategories: [
      { id: 's-super', name: 'Supermercado', canonical_name: 'supermercado', user_id: null },
    ],
  }
  const seedEnt: CategoryWithSubcategories = {
    id: 'c-ent',
    name: 'Entretenimiento',
    type: 'expense',
    icon: '🎬',
    canonical_name: 'entretenimiento',
    subcategories: [{ id: 's-salidas', name: 'Salidas', canonical_name: 'salidas', user_id: null }],
  }
  const seedTransporte: CategoryWithSubcategories = {
    id: 'c-trans',
    name: 'Transporte',
    type: 'expense',
    icon: '🚌',
    canonical_name: 'transporte',
    subcategories: [],
  }
  const seedCats = [seedComida, seedEnt, seedTransporte]

  it('falls back to default chips for a new user (no history)', () => {
    const { result } = renderHook(() => useMovementForm(baseArgs({ categories: seedCats })))
    expect(result.current.frequentChips.map((c) => c.label)).toEqual([
      'Supermercado',
      'Salidas',
      'Transporte',
    ])
    // The Supermercado default carries its subcategory, ready to assign in one tap.
    expect(result.current.frequentChips[0]).toMatchObject({
      categoryId: 'c-comida',
      subcategoryId: 's-super',
    })
  })

  it('history wins over defaults when the user has history', () => {
    const { result } = renderHook(() =>
      useMovementForm(
        baseArgs({
          categories: seedCats,
          frequentClassifications: [{ categoryId: 'c-trans', subcategoryId: null }],
        }),
      ),
    )
    expect(result.current.frequentChips.map((c) => c.label)).toEqual(['Transporte'])
  })

  it('caps the chip count', () => {
    const many: CategoryWithSubcategories[] = Array.from({ length: 8 }, (_, i) => ({
      id: `cat-${i}`,
      name: `Cat ${i}`,
      type: 'expense' as const,
      subcategories: [],
    }))
    const { result } = renderHook(() =>
      useMovementForm(
        baseArgs({
          categories: many,
          frequentClassifications: many.map((c) => ({ categoryId: c.id, subcategoryId: null })),
        }),
      ),
    )
    expect(result.current.frequentChips.length).toBeLessThanOrEqual(FREQUENT_CHIPS_MAX)
    expect(result.current.frequentChips).toHaveLength(4)
  })
})
