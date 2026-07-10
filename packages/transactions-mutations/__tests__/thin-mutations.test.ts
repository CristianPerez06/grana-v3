import { describe, expect, it } from 'vitest'
import type { GranaSupabaseClient } from '@grana/supabase'
import { createIncome, createExpense, createTransfer } from '../src/thin-mutations'

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
