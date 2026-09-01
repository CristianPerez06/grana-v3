import { describe, expect, it } from 'vitest'
import type { GranaSupabaseClient } from '@grana/supabase'
import { getPendingReimbursements } from '../src/queries'

// ═══════════════════════════════════════════════════════════════════════════
// Regression coverage for bug #95 — the "Reintegros por confirmar" block listed
// a reimbursement of the OTHER household member and confirming it failed with
// "Reintegro no encontrado.".
//
// The read leaned on RLS, and migration 0023 widened the `transactions` SELECT
// policy to the household's shared rows; the confirm/cancel mutations scope
// their write to `user_id = userId`. Read and write disagreed on ownership.
//
// The fake below models what RLS ACTUALLY exposes to the logged-in user: her own
// rows PLUS the shared rows of her household. So a read without an owner filter
// sees the alien reintegro here, exactly as in production, and these tests fail
// unless the query filters by `user_id` itself.
// ═══════════════════════════════════════════════════════════════════════════

const ME = 'user-me'
const OTHER = 'user-other'
const HOUSEHOLD = 'hh-1'

type Row = Record<string, unknown>

function makeSupabase(rows: Row[], user: { id: string } | null = { id: ME }) {
  // What the SELECT policy of 0023 lets through for `user`.
  const visible = rows.filter(
    (r) => r.user_id === user?.id || (r.is_shared === true && r.household_id === HOUSEHOLD),
  )

  function builder(table: string) {
    const eq: Row = {}
    const isNull: string[] = []
    let inFilter: { column: string; values: unknown[] } | null = null

    const run = () => {
      let out = visible.filter((r) => r.__table === table)
      out = out.filter(
        (r) =>
          Object.entries(eq).every(([k, v]) => r[k] === v) &&
          isNull.every((k) => r[k] == null) &&
          (inFilter === null || inFilter.values.includes(r[inFilter.column])),
      )
      return { data: out, error: null }
    }

    const api: Record<string, unknown> = {
      select: () => api,
      eq: (column: string, value: unknown) => {
        eq[column] = value
        return api
      },
      is: (column: string, value: unknown) => {
        if (value === null) isNull.push(column)
        return api
      },
      in: (column: string, values: unknown[]) => {
        inFilter = { column, values }
        return api
      },
      order: () => api,
      then: (resolve: (r: unknown) => unknown) => Promise.resolve(run()).then(resolve),
    }
    return api
  }

  return {
    from: (table: string) => builder(table),
    auth: { getUser: async () => ({ data: { user } }) },
  } as unknown as GranaSupabaseClient
}

/** A pending reimbursement row as the block's read selects it. */
function pending(overrides: Row): Row {
  return {
    __table: 'transactions',
    type: 'reimbursement',
    received_at: null,
    cancelled_at: null,
    reimbursement_target: 'account',
    estimated_amount: 1000,
    currency_code: 'ARS',
    account_id: 'acc-1',
    card_period_id: null,
    linked_transaction_id: null,
    is_shared: false,
    household_id: null,
    date: '2026-08-01',
    ...overrides,
  }
}

describe('getPendingReimbursements · ownership', () => {
  it('leaves out a shared reimbursement owned by the other household member', async () => {
    const supabase = makeSupabase([
      pending({ id: 'mine', user_id: ME }),
      pending({ id: 'julietas', user_id: OTHER, is_shared: true, household_id: HOUSEHOLD }),
    ])

    const result = await getPendingReimbursements(supabase)

    expect(result.map((r) => r.id)).toEqual(['mine'])
  })

  it('keeps the user\'s own reimbursements, shared ones included', async () => {
    const supabase = makeSupabase([
      pending({ id: 'mine-plain', user_id: ME }),
      pending({ id: 'mine-shared', user_id: ME, is_shared: true, household_id: HOUSEHOLD }),
      pending({ id: 'julietas', user_id: OTHER, is_shared: true, household_id: HOUSEHOLD }),
    ])

    const result = await getPendingReimbursements(supabase)

    expect(result.map((r) => r.id).sort()).toEqual(['mine-plain', 'mine-shared'])
  })

  it('applies the owner filter on the account-scoped read too', async () => {
    const supabase = makeSupabase([
      pending({ id: 'mine', user_id: ME, account_id: 'acc-1' }),
      pending({ id: 'other-account', user_id: ME, account_id: 'acc-2' }),
      pending({
        id: 'julietas',
        user_id: OTHER,
        account_id: 'acc-1',
        is_shared: true,
        household_id: HOUSEHOLD,
      }),
    ])

    const result = await getPendingReimbursements(supabase, 'acc-1')

    expect(result.map((r) => r.id)).toEqual(['mine'])
  })

  it('returns nothing when there is no authenticated user', async () => {
    const supabase = makeSupabase([pending({ id: 'mine', user_id: ME })], null)

    expect(await getPendingReimbursements(supabase)).toEqual([])
  })
})
