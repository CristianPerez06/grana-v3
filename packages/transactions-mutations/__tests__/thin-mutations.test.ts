import { describe, expect, it } from 'vitest'
import type { GranaSupabaseClient } from '@grana/supabase'
import {
  createIncome,
  createExpense,
  createTransfer,
  updateTransaction,
} from '../src/thin-mutations'

/**
 * Smoke tests for the thin movement mutations' fail-fast + happy paths. The
 * shared-splits / declared-reimbursement rollback dances have their own smoke
 * coverage; here we pin the validation gate, the active-currency guard, and a
 * successful insert returning the new id.
 */

const USER = '00000000-0000-4000-8000-000000000000'
const ACCOUNT = '11111111-1111-4111-8111-111111111111'
const DEST = '33333333-3333-4333-8333-333333333333'
const CATEGORY = '22222222-2222-4222-8222-222222222222'

const incomeInput = {
  account_id: ACCOUNT,
  currency_code: 'ARS',
  amount: 5000,
  date: '2026-06-01',
  category_id: CATEGORY,
  description: 'Sueldo',
}

// A Supabase stub whose `account_currencies` lookup returns `currencyActive`
// and whose `transactions` insert returns `insertedId` (or an error).
function stubClient(opts: {
  currencyActive: boolean
  insertedId?: string
  insertError?: { message: string }
}): GranaSupabaseClient {
  return {
    from(table: string) {
      if (table === 'account_currencies') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                eq: () => ({
                  single: async () => ({
                    data: opts.currencyActive ? { id: 'cur-1' } : null,
                  }),
                }),
              }),
            }),
          }),
        }
      }
      if (table === 'transactions') {
        return {
          insert: () => ({
            select: () => ({
              single: async () =>
                opts.insertError
                  ? { data: null, error: opts.insertError }
                  : { data: { id: opts.insertedId ?? 'tx-1' }, error: null },
            }),
          }),
        }
      }
      throw new Error(`unexpected table ${table}`)
    },
  } as unknown as GranaSupabaseClient
}

const noopClient = {} as unknown as GranaSupabaseClient

describe('thin-mutations — createIncome', () => {
  it('returns fieldErrors when required fields are missing', async () => {
    const result = await createIncome(noopClient, USER, { amount: 0 })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.fieldErrors).toBeDefined()
  })

  it('blocks when the currency is not active on the account', async () => {
    const result = await createIncome(stubClient({ currencyActive: false }), USER, incomeInput)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.formError).toBe('La moneda seleccionada no está activa en esta cuenta.')
    }
  })

  it('inserts the income and returns its id on the happy path', async () => {
    const result = await createIncome(
      stubClient({ currencyActive: true, insertedId: 'income-42' }),
      USER,
      incomeInput,
    )
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.id).toBe('income-42')
  })

  it('surfaces the DB error message when the insert fails', async () => {
    const result = await createIncome(
      stubClient({ currencyActive: true, insertError: { message: 'boom' } }),
      USER,
      incomeInput,
    )
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.formError).toBe('boom')
  })
})

describe('thin-mutations — createExpense', () => {
  it('inserts a simple expense (no reimbursement / no split) and returns its id', async () => {
    const result = await createExpense(
      stubClient({ currencyActive: true, insertedId: 'exp-7' }),
      USER,
      {
        account_id: ACCOUNT,
        currency_code: 'ARS',
        amount: 1200,
        date: '2026-06-02',
        category_id: CATEGORY,
        description: 'Café',
      },
      new Date('2026-06-02T00:00:00Z'),
    )
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.id).toBe('exp-7')
  })
})

describe('thin-mutations — createTransfer', () => {
  it('blocks when the currency is inactive on either leg', async () => {
    const result = await createTransfer(stubClient({ currencyActive: false }), USER, {
      account_id: ACCOUNT,
      transfer_destination_account_id: DEST,
      currency_code: 'ARS',
      amount: 800,
      date: '2026-06-03',
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.formError).toContain('no está activa')
  })
})

// Mock for updateTransaction's debit-account-change path: transactions select
// (existing) + update, accounts select (new account type), account_currencies
// (currency active). No date change, so period logic is skipped.
function updateClient(opts: {
  existing: Record<string, unknown> | null
  newAccountType?: string | null
  currencyActive?: boolean
  capture?: { updated?: Record<string, unknown> }
}): GranaSupabaseClient {
  return {
    from(table: string) {
      if (table === 'transactions') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                single: async () => ({
                  data: opts.existing,
                  error: opts.existing ? null : { message: 'not found' },
                }),
              }),
            }),
          }),
          update: (payload: Record<string, unknown>) => {
            if (opts.capture) opts.capture.updated = payload
            return { eq: () => ({ eq: async () => ({ error: null }) }) }
          },
        }
      }
      if (table === 'accounts') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                single: async () => ({
                  data: opts.newAccountType === null ? null : { type: opts.newAccountType ?? 'bank' },
                  error: null,
                }),
              }),
            }),
          }),
        }
      }
      if (table === 'account_currencies') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                eq: () => ({
                  single: async () => ({ data: (opts.currencyActive ?? true) ? { id: 'c' } : null }),
                }),
              }),
            }),
          }),
        }
      }
      throw new Error(`unexpected table ${table}`)
    },
  } as unknown as GranaSupabaseClient
}

const NEW_ACCOUNT = '44444444-4444-4444-8444-444444444444'
const TX = '55555555-5555-4555-8555-555555555555'
const today = new Date('2026-07-13T00:00:00Z')

// A statement payment is off-period: card_period_id null, its period link lives
// in period_payments.
const paymentRow = {
  id: TX,
  status: null,
  account_id: ACCOUNT,
  card_period_id: null,
  parent_id: null,
  currency_code: 'ARS',
}

describe('thin-mutations — updateTransaction debit account change', () => {
  it('moves the debit account of a statement payment (off-period)', async () => {
    const capture: { updated?: Record<string, unknown> } = {}
    const result = await updateTransaction(
      updateClient({ existing: paymentRow, newAccountType: 'bank', capture }),
      USER,
      TX,
      { account_id: NEW_ACCOUNT },
      today,
    )
    expect(result.ok).toBe(true)
    expect(capture.updated?.account_id).toBe(NEW_ACCOUNT)
  })

  it('rejects moving the account of a card consumption (card_period_id set)', async () => {
    const result = await updateTransaction(
      updateClient({ existing: { ...paymentRow, card_period_id: 'period-1' } }),
      USER,
      TX,
      { account_id: NEW_ACCOUNT },
      today,
    )
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.formError).toContain('consumo de tarjeta')
  })

  it('rejects a credit account as the new debit source', async () => {
    const result = await updateTransaction(
      updateClient({ existing: paymentRow, newAccountType: 'credit' }),
      USER,
      TX,
      { account_id: NEW_ACCOUNT },
      today,
    )
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.formError).toContain('tarjeta de crédito')
  })

  it('rejects a new account without the payment currency active', async () => {
    const result = await updateTransaction(
      updateClient({ existing: paymentRow, newAccountType: 'bank', currencyActive: false }),
      USER,
      TX,
      { account_id: NEW_ACCOUNT },
      today,
    )
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.formError).toContain('moneda activa')
  })
})

// Mock for updateTransaction's date-cascade path: a simple expense (no card
// period, no parent) whose date changes. Captures the expense's own UPDATE and
// the follow-up UPDATE on the linked reimbursement. The chainable `.eq()` is
// awaitable so both the 2-eq (expense) and 4-eq (reimbursement) filters resolve.
function cascadeClient(opts: {
  existing: Record<string, unknown>
  capture: {
    expenseDate?: unknown
    reimbDate?: unknown
    reimbFilter?: Record<string, unknown>
  }
}): GranaSupabaseClient {
  return {
    from(table: string) {
      if (table !== 'transactions') throw new Error(`unexpected table ${table}`)
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({ single: async () => ({ data: opts.existing, error: null }) }),
          }),
        }),
        update(payload: Record<string, unknown>) {
          const filter: Record<string, unknown> = {}
          const chain = {
            eq(col: string, val: unknown) {
              filter[col] = val
              return chain
            },
            then(resolve: (v: unknown) => void) {
              if ('linked_transaction_id' in filter) {
                opts.capture.reimbDate = payload.date
                opts.capture.reimbFilter = filter
              } else {
                opts.capture.expenseDate = payload.date
              }
              resolve({ error: null })
            },
          }
          return chain
        },
      }
    },
  } as unknown as GranaSupabaseClient
}

describe('thin-mutations — updateTransaction reimbursement date cascade', () => {
  const expenseRow = {
    id: TX,
    status: null,
    account_id: ACCOUNT,
    card_period_id: null,
    parent_id: null,
    currency_code: 'ARS',
    date: '2026-08-03',
  }

  it('cascades the new date to a reimbursement that still followed the old date', async () => {
    const capture: {
      expenseDate?: unknown
      reimbDate?: unknown
      reimbFilter?: Record<string, unknown>
    } = {}
    const result = await updateTransaction(
      cascadeClient({ existing: expenseRow, capture }),
      USER,
      TX,
      { date: '2026-07-15' },
      today,
    )
    expect(result.ok).toBe(true)
    expect(capture.expenseDate).toBe('2026-07-15')
    expect(capture.reimbDate).toBe('2026-07-15')
    // Only reimbursements still sitting on the expense's OLD date are moved.
    expect(capture.reimbFilter).toMatchObject({
      linked_transaction_id: TX,
      type: 'reimbursement',
      user_id: USER,
      date: '2026-08-03',
    })
  })

  it('does not cascade when the date is unchanged', async () => {
    const capture: { reimbDate?: unknown } = {}
    const result = await updateTransaction(
      cascadeClient({ existing: expenseRow, capture }),
      USER,
      TX,
      { date: '2026-08-03' },
      today,
    )
    expect(result.ok).toBe(true)
    expect(capture.reimbDate).toBeUndefined()
  })
})

// Mock for updateTransaction's card-consumo re-dating path. Every query builder
// method records its filters and returns the chain; awaiting it (or `.single()`)
// resolves by table + operation. Captures each UPDATE with its payload and
// filters, in order, so the test can pin both cascades and their sequence.
type RecordedUpdate = { payload: Record<string, unknown>; filter: Record<string, unknown> }

function cardRedateClient(opts: {
  existing: Record<string, unknown>
  periods: Array<Record<string, unknown>>
  updates: RecordedUpdate[]
}): GranaSupabaseClient {
  return {
    from(table: string) {
      const filter: Record<string, unknown> = {}
      let op: 'select' | 'update' = 'select'
      let payload: Record<string, unknown> = {}
      const resolveValue = () => {
        if (op === 'update') {
          opts.updates.push({ payload, filter: { ...filter } })
          return { error: null }
        }
        if (table === 'card_periods') {
          if ('id' in filter) {
            return { data: opts.periods.find((p) => p.id === filter.id) ?? null, error: null }
          }
          return { data: opts.periods, error: null }
        }
        if (table === 'period_payments') return { data: [], error: null }
        if (table === 'transactions' && 'user_id' in filter) {
          return { data: opts.existing, error: null }
        }
        return { data: [], error: null }
      }
      const chain = {
        select: () => chain,
        update(p: Record<string, unknown>) {
          op = 'update'
          payload = p
          return chain
        },
        eq(col: string, val: unknown) {
          filter[col] = val
          return chain
        },
        in: () => chain,
        order: () => chain,
        single: async () => resolveValue(),
        then(resolve: (v: unknown) => void) {
          resolve(resolveValue())
        },
      }
      return chain
    },
  } as unknown as GranaSupabaseClient
}

describe('thin-mutations — updateTransaction statement reimbursement follows the period', () => {
  const OLD_PERIOD = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  const NEW_PERIOD = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
  const periods = [
    {
      id: NEW_PERIOD,
      account_id: ACCOUNT,
      start_date: '2026-09-24',
      end_date: '2026-10-22',
      due_date: '2026-11-04',
    },
    {
      id: OLD_PERIOD,
      account_id: ACCOUNT,
      start_date: '2026-10-23',
      end_date: '2026-11-20',
      due_date: '2026-12-03',
    },
  ]
  // A card consumo loaded "today" (12/11) by mistake, then re-dated to 30/09.
  const consumo = {
    id: TX,
    status: 'pending',
    account_id: ACCOUNT,
    card_period_id: OLD_PERIOD,
    parent_id: null,
    currency_code: 'ARS',
    date: '2026-11-12',
  }

  it('moves a following statement reimbursement to the expense new period, before re-dating it', async () => {
    const updates: RecordedUpdate[] = []
    const result = await updateTransaction(
      cardRedateClient({ existing: consumo, periods, updates }),
      USER,
      TX,
      { date: '2026-09-30' },
      today,
    )
    expect(result.ok).toBe(true)

    const [expense, reimbPeriod, reimbDate] = updates
    expect(expense.payload).toMatchObject({ date: '2026-09-30', card_period_id: NEW_PERIOD })
    // Only a statement reimbursement still sitting on the expense's OLD period
    // and OLD date follows it.
    expect(reimbPeriod.payload).toEqual({ card_period_id: NEW_PERIOD })
    expect(reimbPeriod.filter).toMatchObject({
      linked_transaction_id: TX,
      type: 'reimbursement',
      user_id: USER,
      reimbursement_target: 'statement',
      card_period_id: OLD_PERIOD,
      date: '2026-11-12',
    })
    // The date cascade runs after, still matching on the OLD date.
    expect(reimbDate.payload).toEqual({ date: '2026-09-30' })
    expect(reimbDate.filter).toMatchObject({ date: '2026-11-12' })
  })

  it('does not touch the reimbursement period when the consumo stays in its statement', async () => {
    const updates: RecordedUpdate[] = []
    const result = await updateTransaction(
      cardRedateClient({ existing: consumo, periods, updates }),
      USER,
      TX,
      { date: '2026-11-05' },
      today,
    )
    expect(result.ok).toBe(true)
    expect(updates.some((u) => 'card_period_id' in u.payload)).toBe(false)
  })
})
