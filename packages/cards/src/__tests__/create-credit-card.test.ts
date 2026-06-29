import { describe, it, expect } from 'vitest'
import type { GranaSupabaseClient } from '@grana/supabase'
import { createCreditCard } from '../mutations'

// ── Minimal chainable Supabase fake ─────────────────────────────────────────────
// Mirrors the exact call sequence createCreditCard uses: each builder is a thenable
// (like PostgrestBuilder), so `await` resolves it. Results are configured per table.

type Opts = {
  networkName?: string
  institutionName?: string
  accountId?: string
  accountError?: { code?: string } | null
  currencyError?: { code?: string } | null
  periodsError?: { code?: string } | null
}

function makeSupabase(opts: Opts = {}) {
  const calls = {
    inserts: {} as Record<string, unknown>,
    deletes: [] as unknown[],
  }

  function builder(table: string) {
    const state: { op: 'select' | 'insert' | 'delete'; eqVal?: unknown } = { op: 'select' }
    const resolve = () => {
      if (table === 'card_networks') return { data: { name: opts.networkName ?? 'Visa' }, error: null }
      if (table === 'institutions')
        return { data: { name: opts.institutionName ?? 'Banco Galicia' }, error: null }
      if (table === 'accounts' && state.op === 'insert') {
        if (opts.accountError) return { data: null, error: opts.accountError }
        return { data: { id: opts.accountId ?? 'acc-1' }, error: null }
      }
      if (table === 'accounts' && state.op === 'delete') {
        calls.deletes.push(state.eqVal)
        return { data: null, error: null }
      }
      if (table === 'account_currencies') return { data: null, error: opts.currencyError ?? null }
      if (table === 'card_periods') return { data: null, error: opts.periodsError ?? null }
      return { data: null, error: null }
    }
    const b = {
      select: () => b,
      eq: (_col: string, val: unknown) => {
        state.eqVal = val
        return b
      },
      single: () => b,
      insert: (rows: unknown) => {
        state.op = 'insert'
        calls.inserts[table] = rows
        return b
      },
      delete: () => {
        state.op = 'delete'
        return b
      },
      then: (onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) =>
        Promise.resolve(resolve()).then(onFulfilled, onRejected),
    }
    return b
  }

  const supabase = { from: (t: string) => builder(t) } as unknown as GranaSupabaseClient
  return { supabase, calls }
}

const USER = 'user-1'
const INST = '11111111-1111-4111-8111-111111111111'
const NET = '22222222-2222-4222-8222-222222222222'
const TODAY = new Date('2026-06-16T12:00:00-03:00')

const validInput = (over: Record<string, unknown> = {}) => ({
  institution_id: INST,
  network_id: NET,
  currencies: [{ currency_code: 'ARS' }, { currency_code: 'USD' }],
  current_end_date: '2026-06-16',
  current_due_date: '2026-06-22',
  ...over,
})

describe('createCreditCard', () => {
  it('creates P1 real and P2 estimated with the expected dates', async () => {
    const { supabase, calls } = makeSupabase()
    const result = await createCreditCard({ supabase, userId: USER, input: validInput(), today: TODAY })

    expect(result).toEqual({ ok: true, id: 'acc-1' })

    const account = calls.inserts['accounts'] as Record<string, unknown>
    expect(account.type).toBe('credit')
    expect(account.user_id).toBe(USER)

    const periods = calls.inserts['card_periods'] as Array<Record<string, unknown>>
    expect(periods).toHaveLength(2)
    expect(periods[0]).toMatchObject({
      start_date: '2026-05-17',
      end_date: '2026-06-16',
      due_date: '2026-06-22',
      is_estimated: false,
    })
    expect(periods[1]).toMatchObject({ start_date: '2026-06-17', is_estimated: true })
  })

  it('derives the auto name "Network Banco" when no name is provided', async () => {
    const { supabase, calls } = makeSupabase({ networkName: 'Visa', institutionName: 'Banco Galicia' })
    await createCreditCard({ supabase, userId: USER, input: validInput(), today: TODAY })

    const account = calls.inserts['accounts'] as Record<string, unknown>
    expect(account.name).toBe('Visa Banco Galicia')
  })

  it('rejects a close date older than 40 days with a messageKey', async () => {
    const { supabase } = makeSupabase()
    const result = await createCreditCard({
      supabase,
      userId: USER,
      input: validInput({ current_end_date: '2026-01-01', current_due_date: '2026-01-08' }),
      today: TODAY,
    })
    expect(result).toEqual({ ok: false, messageKey: 'cards.errors.current_end_too_old' })
  })

  it('rejects a close date further than 40 days with a messageKey', async () => {
    const { supabase } = makeSupabase()
    const result = await createCreditCard({
      supabase,
      userId: USER,
      input: validInput({ current_end_date: '2026-12-01', current_due_date: '2026-12-08' }),
      today: TODAY,
    })
    expect(result).toEqual({ ok: false, messageKey: 'cards.errors.current_end_too_far' })
  })

  it('rolls back the account when the currencies insert fails', async () => {
    const { supabase, calls } = makeSupabase({ currencyError: { code: '23505' } })
    const result = await createCreditCard({ supabase, userId: USER, input: validInput(), today: TODAY })

    expect(result).toMatchObject({ ok: false, messageKey: 'cards.errors.create_failed', errorCode: '23505' })
    expect(calls.deletes).toContain('acc-1')
  })

  it('rolls back the account when the periods insert fails', async () => {
    const { supabase, calls } = makeSupabase({ periodsError: { code: 'XX000' } })
    const result = await createCreditCard({ supabase, userId: USER, input: validInput(), today: TODAY })

    expect(result).toMatchObject({ ok: false, messageKey: 'cards.errors.create_failed' })
    expect(calls.deletes).toContain('acc-1')
  })

  it('returns fieldErrors for invalid input without touching the db', async () => {
    const { supabase, calls } = makeSupabase()
    const result = await createCreditCard({
      supabase,
      userId: USER,
      input: { institution_id: 'not-a-uuid', currencies: [] },
      today: TODAY,
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.fieldErrors).toBeTruthy()
    expect(calls.inserts['accounts']).toBeUndefined()
  })
})
