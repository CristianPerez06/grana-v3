import { describe, expect, it } from 'vitest'
import {
  createInitialFilters,
  hasActiveContentFilters,
  hasActiveSearch,
  transactionsFiltersReducer,
  type TransactionsFilters,
} from '../filters-state'
import { DEFAULT_MOVEMENTS_LIMIT, MAX_MOVEMENTS_LIMIT, MOVEMENTS_LIMIT_STEP } from '../filters'

const FIXED_TODAY = new Date(2026, 5, 15) // 2026-06-15 (month index 5 = June)

const baseState = (overrides: Partial<TransactionsFilters> = {}): TransactionsFilters => ({
  ...createInitialFilters({ today: FIXED_TODAY }),
  ...overrides,
})

describe('createInitialFilters', () => {
  it('seeds month from the provided today and defaults the rest', () => {
    const state = createInitialFilters({ today: FIXED_TODAY })
    expect(state.month).toBe('2026-06')
    expect(state.customRange).toBeNull()
    expect(state.currency).toBeNull()
    expect(state.overviewMode).toBe('egresos')
    expect(state.type).toBeNull()
    expect(state.accountId).toBeNull()
    expect(state.categoryId).toBeNull()
    expect(state.subcategoryId).toBeNull()
    expect(state.query).toBe('')
    expect(state.amountMin).toBeNull()
    expect(state.amountMax).toBeNull()
    expect(state.limit).toBe(DEFAULT_MOVEMENTS_LIMIT)
  })
})

describe('transactionsFiltersReducer — period navigation', () => {
  it('setMonth updates the month and clears any custom range', () => {
    const state = baseState({ customRange: { from: '2026-01-01', to: '2026-01-31' } })
    const next = transactionsFiltersReducer(state, { type: 'setMonth', month: '2026-03' })
    expect(next.month).toBe('2026-03')
    expect(next.customRange).toBeNull()
  })

  it('prevMonth/nextMonth shift the month and reset the limit', () => {
    const state = baseState({ limit: 200 })
    const prev = transactionsFiltersReducer(state, { type: 'prevMonth' })
    expect(prev.month).toBe('2026-05')
    expect(prev.limit).toBe(DEFAULT_MOVEMENTS_LIMIT)

    const next = transactionsFiltersReducer(state, { type: 'nextMonth' })
    expect(next.month).toBe('2026-07')
    expect(next.limit).toBe(DEFAULT_MOVEMENTS_LIMIT)
  })

  it('prevMonth/nextMonth are no-ops when a custom range is active', () => {
    const range = { from: '2026-01-01', to: '2026-01-31' }
    const state = baseState({ customRange: range })
    expect(transactionsFiltersReducer(state, { type: 'prevMonth' })).toBe(state)
    expect(transactionsFiltersReducer(state, { type: 'nextMonth' })).toBe(state)
  })

  it('setCustomRange stores the range and resets the limit', () => {
    const state = baseState({ limit: 200 })
    const range = { from: '2026-02-01', to: '2026-02-28' }
    const next = transactionsFiltersReducer(state, { type: 'setCustomRange', range })
    expect(next.customRange).toEqual(range)
    expect(next.limit).toBe(DEFAULT_MOVEMENTS_LIMIT)
  })

  it('setCustomRange with null clears the range', () => {
    const state = baseState({ customRange: { from: '2026-01-01' } })
    const next = transactionsFiltersReducer(state, { type: 'setCustomRange', range: null })
    expect(next.customRange).toBeNull()
  })
})

describe('transactionsFiltersReducer — filters', () => {
  it('setCategory clears subcategory (since a subcategory belongs to one category)', () => {
    const state = baseState({ categoryId: 'cat-a', subcategoryId: 'sub-1' })
    const next = transactionsFiltersReducer(state, { type: 'setCategory', categoryId: 'cat-b' })
    expect(next.categoryId).toBe('cat-b')
    expect(next.subcategoryId).toBeNull()
  })

  it('setCategory with null clears both category and subcategory', () => {
    const state = baseState({ categoryId: 'cat-a', subcategoryId: 'sub-1' })
    const next = transactionsFiltersReducer(state, { type: 'setCategory', categoryId: null })
    expect(next.categoryId).toBeNull()
    expect(next.subcategoryId).toBeNull()
  })

  it('setSubcategory without a parent category is a no-op', () => {
    const state = baseState({ categoryId: null })
    expect(
      transactionsFiltersReducer(state, { type: 'setSubcategory', subcategoryId: 'sub-1' }),
    ).toBe(state)
  })

  it('setSubcategory with a parent category sets the subcategory', () => {
    const state = baseState({ categoryId: 'cat-a' })
    const next = transactionsFiltersReducer(state, {
      type: 'setSubcategory',
      subcategoryId: 'sub-1',
    })
    expect(next.subcategoryId).toBe('sub-1')
  })

  it('setType / setAccount / setCurrency / setAmountRange all reset the limit', () => {
    const state = baseState({ limit: 200 })
    expect(
      transactionsFiltersReducer(state, { type: 'setType', movementType: 'expense' }).limit,
    ).toBe(DEFAULT_MOVEMENTS_LIMIT)
    expect(
      transactionsFiltersReducer(state, { type: 'setAccount', accountId: 'acc-1' }).limit,
    ).toBe(DEFAULT_MOVEMENTS_LIMIT)
    expect(transactionsFiltersReducer(state, { type: 'setCurrency', currency: 'USD' }).limit).toBe(
      DEFAULT_MOVEMENTS_LIMIT,
    )
    expect(
      transactionsFiltersReducer(state, { type: 'setAmountRange', min: 100, max: 500 }).limit,
    ).toBe(DEFAULT_MOVEMENTS_LIMIT)
  })

  it('setOverviewMode does NOT reset the limit (mode only affects the overview card)', () => {
    const state = baseState({ limit: 150 })
    const next = transactionsFiltersReducer(state, { type: 'setOverviewMode', mode: 'ingresos' })
    expect(next.overviewMode).toBe('ingresos')
    expect(next.limit).toBe(150)
  })

  it('setQuery updates the search term and resets the limit', () => {
    const state = baseState({ limit: 200 })
    const next = transactionsFiltersReducer(state, { type: 'setQuery', query: 'café' })
    expect(next.query).toBe('café')
    expect(next.limit).toBe(DEFAULT_MOVEMENTS_LIMIT)
  })
})

describe('transactionsFiltersReducer — limit', () => {
  it('incrementLimit grows by MOVEMENTS_LIMIT_STEP, capped at MAX', () => {
    const state = baseState()
    const grown = transactionsFiltersReducer(state, { type: 'incrementLimit' })
    expect(grown.limit).toBe(DEFAULT_MOVEMENTS_LIMIT + MOVEMENTS_LIMIT_STEP)

    const near = baseState({ limit: MAX_MOVEMENTS_LIMIT - 10 })
    const capped = transactionsFiltersReducer(near, { type: 'incrementLimit' })
    expect(capped.limit).toBe(MAX_MOVEMENTS_LIMIT)
  })

  it('setLimit clamps below DEFAULT and above MAX', () => {
    expect(
      transactionsFiltersReducer(baseState(), { type: 'setLimit', limit: 0 }).limit,
    ).toBe(DEFAULT_MOVEMENTS_LIMIT)
    expect(
      transactionsFiltersReducer(baseState(), { type: 'setLimit', limit: 10_000 }).limit,
    ).toBe(MAX_MOVEMENTS_LIMIT)
  })
})

describe('transactionsFiltersReducer — clear actions', () => {
  it('clearSearch only clears the query and resets the limit', () => {
    const state = baseState({
      query: 'café',
      categoryId: 'cat-a',
      currency: 'USD',
      limit: 200,
    })
    const next = transactionsFiltersReducer(state, { type: 'clearSearch' })
    expect(next.query).toBe('')
    expect(next.limit).toBe(DEFAULT_MOVEMENTS_LIMIT)
    expect(next.categoryId).toBe('cat-a')
    expect(next.currency).toBe('USD')
  })

  it('clearFilters wipes chip-removable filters but keeps period, search, overview', () => {
    const state = baseState({
      month: '2026-03',
      query: 'café',
      overviewMode: 'ingresos',
      type: 'expense',
      accountId: 'acc-1',
      categoryId: 'cat-a',
      subcategoryId: 'sub-1',
      currency: 'USD',
      amountMin: 10,
      amountMax: 100,
      limit: 200,
    })
    const next = transactionsFiltersReducer(state, { type: 'clearFilters' })
    expect(next.month).toBe('2026-03')
    expect(next.query).toBe('café')
    expect(next.overviewMode).toBe('ingresos')
    expect(next.type).toBeNull()
    expect(next.accountId).toBeNull()
    expect(next.categoryId).toBeNull()
    expect(next.subcategoryId).toBeNull()
    expect(next.currency).toBeNull()
    expect(next.amountMin).toBeNull()
    expect(next.amountMax).toBeNull()
    expect(next.limit).toBe(DEFAULT_MOVEMENTS_LIMIT)
  })

  it('clearAll wipes chips AND search, keeps period and overview mode', () => {
    const state = baseState({
      month: '2026-03',
      query: 'café',
      overviewMode: 'ingresos',
      categoryId: 'cat-a',
    })
    const next = transactionsFiltersReducer(state, { type: 'clearAll' })
    expect(next.month).toBe('2026-03')
    expect(next.overviewMode).toBe('ingresos')
    expect(next.query).toBe('')
    expect(next.categoryId).toBeNull()
  })

  it('reset returns to initial defaults (NB: month derives from getTodayAR at call time)', () => {
    const state = baseState({
      month: '2026-03',
      query: 'café',
      overviewMode: 'ingresos',
    })
    const next = transactionsFiltersReducer(state, { type: 'reset' })
    expect(next.query).toBe('')
    expect(next.overviewMode).toBe('egresos')
    expect(next.currency).toBeNull()
    // We cannot pin month here because `reset` re-reads getTodayAR(); we just
    // assert it's a well-formed YYYY-MM.
    expect(next.month).toMatch(/^\d{4}-\d{2}$/)
  })
})

describe('hasActiveContentFilters / hasActiveSearch', () => {
  it('default initial state has neither active filters nor search', () => {
    const state = baseState()
    expect(hasActiveContentFilters(state)).toBe(false)
    expect(hasActiveSearch(state)).toBe(false)
  })

  it('a single content filter flips the flag', () => {
    expect(hasActiveContentFilters(baseState({ type: 'expense' }))).toBe(true)
    expect(hasActiveContentFilters(baseState({ accountId: 'acc-1' }))).toBe(true)
    expect(hasActiveContentFilters(baseState({ categoryId: 'cat-a' }))).toBe(true)
    expect(hasActiveContentFilters(baseState({ currency: 'USD' }))).toBe(true)
    expect(hasActiveContentFilters(baseState({ amountMin: 100 }))).toBe(true)
  })

  it('search whitespace does not count as active', () => {
    expect(hasActiveSearch(baseState({ query: '   ' }))).toBe(false)
    expect(hasActiveSearch(baseState({ query: 'café' }))).toBe(true)
  })
})
