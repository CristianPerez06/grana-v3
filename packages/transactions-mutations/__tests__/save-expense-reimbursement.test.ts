import { describe, expect, it } from 'vitest'
import type { GranaSupabaseClient } from '@grana/supabase'
import { saveExpenseReimbursement } from '../src/save-expense-reimbursement'

const EXPENSE = '11111111-1111-4111-8111-111111111111'
const ACCOUNT = '22222222-2222-4222-8222-222222222222'
const today = new Date('2026-07-13T00:00:00Z')

type LinkedRow = { id: string; received_at: string | null; cancelled_at: string | null }

type Capture = { deletedIds: string[]; insertedReimbursements: number }

/**
 * Minimal chainable Supabase mock for the reconciler's branch logic. Every
 * builder method returns the same object; it is thenable (for list/mutation
 * awaits) and exposes single()/maybeSingle(). Responses are routed by the
 * selected columns / operation, which is enough to exercise the add/edit/remove
 * and guard paths without a real DB (the full insert dance is covered by the
 * declared-reimbursement path and the manual verify pass).
 */
function makeClient(opts: {
  expense: Record<string, unknown> | null
  linked: LinkedRow[]
  capture: Capture
}): GranaSupabaseClient {
  const { expense, linked, capture } = opts

  function builder(table: string) {
    const state: { op: string; columns: string } = { op: 'select', columns: '' }

    const resolveList = (): { data: unknown; error: null } => {
      // The only awaited-list query is the linked-reimbursements lookup.
      if (table === 'transactions' && state.op === 'select') {
        return { data: linked, error: null }
      }
      return { data: null, error: null }
    }

    const api: Record<string, unknown> = {
      select(columns = '') {
        state.op = 'select'
        state.columns = columns
        return api
      },
      insert() {
        state.op = 'insert'
        if (table === 'transactions') capture.insertedReimbursements += 1
        return api
      },
      delete() {
        state.op = 'delete'
        return api
      },
      update() {
        state.op = 'update'
        return api
      },
      upsert() {
        return Promise.resolve({ error: null })
      },
      eq(_col: string, val: unknown) {
        if (state.op === 'delete' && _col === 'id') capture.deletedIds.push(String(val))
        return api
      },
      in() {
        return Promise.resolve({ error: null })
      },
      order() {
        return api
      },
      limit() {
        return api
      },
      single() {
        if (state.columns.includes('type')) {
          return Promise.resolve({ data: expense, error: expense ? null : { message: 'not found' } })
        }
        // insert(...).select('id').single()
        return Promise.resolve({ data: { id: 'reimb-new' }, error: null })
      },
      maybeSingle() {
        return Promise.resolve({ data: { card_period_id: null }, error: null })
      },
      then(resolve: (v: { data: unknown; error: null }) => unknown) {
        if (state.op === 'delete') return resolve({ data: null, error: null })
        return resolve(resolveList())
      },
    }
    return api
  }

  return { from: (table: string) => builder(table) } as unknown as GranaSupabaseClient
}

const decl = {
  target: 'account' as const,
  estimated_amount: 1000,
  account_id: ACCOUNT,
  received_now: false,
}

describe('saveExpenseReimbursement — reconciler', () => {
  it('returns fieldErrors on invalid input', async () => {
    const result = await saveExpenseReimbursement({
      supabase: makeClient({ expense: null, linked: [], capture: { deletedIds: [], insertedReimbursements: 0 } }),
      userId: 'u1',
      input: { expense_id: 'not-a-uuid' },
      today,
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.fieldErrors).toBeDefined()
  })

  it('returns formError when the expense is not found', async () => {
    const result = await saveExpenseReimbursement({
      supabase: makeClient({ expense: null, linked: [], capture: { deletedIds: [], insertedReimbursements: 0 } }),
      userId: 'u1',
      input: { expense_id: EXPENSE },
      today,
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.formError).toBe('Gasto no encontrado.')
  })

  it('rejects when a received/cancelled reimbursement is linked (read-only guard)', async () => {
    const capture = { deletedIds: [], insertedReimbursements: 0 }
    const result = await saveExpenseReimbursement({
      supabase: makeClient({
        expense: { id: EXPENSE, type: 'expense', account_id: ACCOUNT, card_period_id: null, currency_code: 'ARS', is_parent: false },
        linked: [{ id: 'r-recv', received_at: '2026-07-01', cancelled_at: null }],
        capture,
      }),
      userId: 'u1',
      input: { expense_id: EXPENSE, reimbursement: decl },
      today,
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.formError).toContain('ya fue recibido o cancelado')
    expect(capture.deletedIds).toHaveLength(0)
    expect(capture.insertedReimbursements).toBe(0)
  })

  it('removes the pending reimbursement when no declaration is sent', async () => {
    const capture = { deletedIds: [], insertedReimbursements: 0 }
    const result = await saveExpenseReimbursement({
      supabase: makeClient({
        expense: { id: EXPENSE, type: 'expense', account_id: ACCOUNT, card_period_id: null, currency_code: 'ARS', is_parent: false },
        linked: [{ id: 'r-pend', received_at: null, cancelled_at: null }],
        capture,
      }),
      userId: 'u1',
      input: { expense_id: EXPENSE },
      today,
    })
    expect(result.ok).toBe(true)
    expect(capture.deletedIds).toEqual(['r-pend'])
    expect(capture.insertedReimbursements).toBe(0)
  })

  it('adds a reimbursement when the expense has none', async () => {
    const capture = { deletedIds: [], insertedReimbursements: 0 }
    const result = await saveExpenseReimbursement({
      supabase: makeClient({
        expense: { id: EXPENSE, type: 'expense', account_id: ACCOUNT, card_period_id: null, currency_code: 'ARS', is_parent: false },
        linked: [],
        capture,
      }),
      userId: 'u1',
      input: { expense_id: EXPENSE, reimbursement: decl },
      today,
    })
    expect(result.ok).toBe(true)
    expect(capture.deletedIds).toHaveLength(0)
    expect(capture.insertedReimbursements).toBe(1)
  })

  it('edits a pending reimbursement via delete + insert', async () => {
    const capture = { deletedIds: [], insertedReimbursements: 0 }
    const result = await saveExpenseReimbursement({
      supabase: makeClient({
        expense: { id: EXPENSE, type: 'expense', account_id: ACCOUNT, card_period_id: null, currency_code: 'ARS', is_parent: false },
        linked: [{ id: 'r-pend', received_at: null, cancelled_at: null }],
        capture,
      }),
      userId: 'u1',
      input: { expense_id: EXPENSE, reimbursement: { ...decl, estimated_amount: 2500 } },
      today,
    })
    expect(result.ok).toBe(true)
    expect(capture.deletedIds).toEqual(['r-pend'])
    expect(capture.insertedReimbursements).toBe(1)
  })
})
