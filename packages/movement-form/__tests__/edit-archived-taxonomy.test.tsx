import { describe, expect, it, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useMovementForm } from '../src/use-movement-form'
import type {
  ArchivedTaxonomy,
  CategoryWithSubcategories,
  MovementEditContext,
  MovementFormAccount,
  Mutators,
} from '../src/types'

const cashAccount: MovementFormAccount = {
  id: 'acc-cash',
  name: 'Efectivo',
  type: 'cash',
  activeCurrencies: ['ARS'],
  balances: { ARS: 10_000, USD: 0 },
  institutionId: null,
}

// The catalog as the read layer now serves it: active rows only. "delivery" was
// archived, so it is NOT here — that's the fix.
const comida: CategoryWithSubcategories = {
  id: 'comida',
  name: 'Comida',
  type: 'expense',
  subcategories: [{ id: 'almuerzo', name: 'Almuerzo', canonical_name: 'almuerzo', user_id: null }],
}

const archivedDelivery: ArchivedTaxonomy = {
  category: null,
  subcategory: {
    id: 'delivery',
    name: 'Delivery',
    canonical_name: 'delivery',
    user_id: 'u-1',
    is_active: false,
  },
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

const editContext = (overrides: Partial<MovementEditContext> = {}): MovementEditContext => ({
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
  categoryId: 'comida',
  subcategoryId: 'delivery',
  archivedTaxonomy: archivedDelivery,
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
  ...overrides,
})

const setup = (edit?: MovementEditContext, mutators = stubMutators()) =>
  renderHook(() =>
    useMovementForm({
      mutators,
      accounts: [cashAccount],
      categories: [comida],
      edit,
      today: new Date('2026-06-01T00:00:00Z'),
      translate: (key) => key,
    }),
  )

const findSub = (cats: CategoryWithSubcategories[], id: string) =>
  cats.find((c) => c.id === 'comida')?.subcategories.find((s) => s.id === id)

describe('editing a movement classified with an archived subcategory', () => {
  it('shows the archived subcategory that the catalog no longer serves', () => {
    const { result } = setup(editContext())
    expect(result.current.categoryId).toBe('comida')
    expect(result.current.subcategoryId).toBe('delivery')
    const grafted = findSub(result.current.transactionCategories, 'delivery')
    expect(grafted).toBeDefined()
    // Flagged so the UI can label it instead of passing it off as live.
    expect(grafted?.is_active).toBe(false)
  })

  it('saving without touching the picker keeps the classification', async () => {
    const mutators = stubMutators()
    const { result } = setup(editContext(), mutators)
    await act(async () => {
      await result.current.onSubmit()
    })
    expect(mutators.updateTransaction).toHaveBeenCalledTimes(1)
    // updateTransaction(id, accountId, patch)
    const payload = vi.mocked(mutators.updateTransaction).mock.calls[0]?.[2] as Record<
      string,
      unknown
    >
    expect(payload.category_id).toBe('comida')
    expect(payload.subcategory_id).toBe('delivery')
  })

  it('choosing another subcategory removes the archived one from the picker', () => {
    const { result } = setup(editContext())
    act(() => result.current.pickCategory('comida', 'almuerzo'))
    expect(result.current.subcategoryId).toBe('almuerzo')
    expect(findSub(result.current.transactionCategories, 'delivery')).toBeUndefined()
  })

  it('creating a movement never offers the archived row', () => {
    const { result } = setup(undefined)
    expect(findSub(result.current.transactionCategories, 'delivery')).toBeUndefined()
    expect(findSub(result.current.transactionCategories, 'almuerzo')).toBeDefined()
  })

  it('a live classification grafts nothing', () => {
    const { result } = setup(
      editContext({ subcategoryId: 'almuerzo', archivedTaxonomy: null }),
    )
    expect(result.current.transactionCategories[0].subcategories.map((s) => s.id)).toEqual([
      'almuerzo',
    ])
  })
})
