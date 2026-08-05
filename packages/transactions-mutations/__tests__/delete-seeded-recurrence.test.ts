import { describe, expect, it } from 'vitest'
import type { GranaSupabaseClient } from '@grana/supabase'
import { deleteTransaction, DELETE_GUARD_CODES } from '../src/thin-mutations'

/**
 * The seeded-recurrence guard: a movement that created a recurrence rule cannot
 * be deleted silently, because that leaves the rule orphaned (the defect this
 * change fixes — 10 such rules existed in production). Since 0053 the FK is
 * ON DELETE RESTRICT, so the DB rejects it anyway; the guard exists so the user
 * gets a named rule and two real choices instead of a raw FK error.
 */

const USER = '00000000-0000-4000-8000-000000000000'
const TX = '11111111-1111-4111-8111-111111111111'
const RULE = '22222222-2222-4222-8222-222222222222'

type RuleRow = {
  id: string
  status: string
  description: string | null
  start_date: string
  end_date: string | null
  interval_count: number
  interval_unit: string
  max_occurrences: number | null
  last_generated_date: string | null
}

const monthlyRule = (over: Partial<RuleRow> = {}): RuleRow => ({
  id: RULE,
  status: 'active',
  description: 'ALQUILER',
  start_date: '2026-08-07',
  end_date: null,
  interval_count: 1,
  interval_unit: 'month',
  max_occurrences: null,
  last_generated_date: null,
  ...over,
})

// Records what the mutation wrote, so the tests can assert the repair.
type Recorder = { updates: Record<string, unknown>[]; deletedTx: boolean }

function stubClient(rule: RuleRow | null, rec: Recorder): GranaSupabaseClient {
  return {
    from(table: string) {
      if (table === 'transactions') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                single: async () => ({ data: { parent_id: null, status: null, type: 'expense' } }),
              }),
            }),
          }),
          delete: () => ({
            eq: () => ({
              eq: async () => {
                rec.deletedTx = true
                return { error: null }
              },
            }),
          }),
        }
      }
      if (table === 'period_payments') {
        return {
          select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }),
        }
      }
      if (table === 'recurrences') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({ maybeSingle: async () => ({ data: rule }) }),
            }),
          }),
          update: (patch: Record<string, unknown>) => {
            rec.updates.push(patch)
            return { eq: () => ({ eq: async () => ({ error: null }) }) }
          },
        }
      }
      throw new Error(`unexpected table ${table}`)
    },
  } as unknown as GranaSupabaseClient
}

const recorder = (): Recorder => ({ updates: [], deletedTx: false })

describe('deleteTransaction — seeded recurrence guard', () => {
  it('deletes normally when the movement seeded no rule', async () => {
    const rec = recorder()
    const result = await deleteTransaction(stubClient(null, rec), USER, TX, {
      today: '2026-08-04',
    })
    expect(result.ok).toBe(true)
    expect(rec.deletedTx).toBe(true)
    expect(rec.updates).toEqual([])
  })

  it('blocks and names the rule when no resolution was chosen', async () => {
    const rec = recorder()
    const result = await deleteTransaction(
      stubClient(monthlyRule({ last_generated_date: '2026-08-07' }), rec),
      USER,
      TX,
      { today: '2026-08-04' },
    )

    expect(result.ok).toBe(false)
    expect(result.ok === false && result.errorCode).toBe(DELETE_GUARD_CODES.seededRecurrence)
    expect(result.seededRecurrence).toEqual({
      id: RULE,
      description: 'ALQUILER',
      // Cursor on Aug 7 ⇒ the next occurrence it can still produce is Sep 7.
      next_occurrence: '2026-09-07',
    })
    // Nothing touched: neither the rule nor the movement.
    expect(rec.deletedTx).toBe(false)
    expect(rec.updates).toEqual([])
  })

  it('unlink repairs the cursor when it covered the future seed being deleted', async () => {
    // The exact production shape: rule created 31-jul from a movement dated
    // 7-ago. Deleting that movement without clearing the cursor would make the
    // rule skip August entirely.
    const rec = recorder()
    const result = await deleteTransaction(
      stubClient(monthlyRule({ start_date: '2026-08-07', last_generated_date: '2026-08-07' }), rec),
      USER,
      TX,
      { today: '2026-08-04', seedResolution: 'unlink' },
    )

    expect(result.ok).toBe(true)
    expect(rec.updates).toEqual([
      { created_from_transaction_id: null, last_generated_date: null },
    ])
    expect(rec.deletedTx).toBe(true)
  })

  it('unlink leaves an already-advanced cursor alone', async () => {
    // The rule has been generating since June: its cursor is a real history, not
    // a claim about the movement being deleted. Nulling it would re-propose a
    // months-old occurrence.
    const rec = recorder()
    const result = await deleteTransaction(
      stubClient(monthlyRule({ start_date: '2026-06-05', last_generated_date: '2026-07-05' }), rec),
      USER,
      TX,
      { today: '2026-08-04', seedResolution: 'unlink' },
    )

    expect(result.ok).toBe(true)
    expect(rec.updates).toEqual([{ created_from_transaction_id: null }])
    expect(rec.deletedTx).toBe(true)
  })

  it('unlink leaves a past cursor equal to start_date alone', async () => {
    // Cursor = start_date but already in the past: the occurrence happened, the
    // user deleted its movement on purpose. Repairing would re-propose it.
    const rec = recorder()
    const result = await deleteTransaction(
      stubClient(monthlyRule({ start_date: '2026-07-14', last_generated_date: '2026-07-14' }), rec),
      USER,
      TX,
      { today: '2026-08-04', seedResolution: 'unlink' },
    )

    expect(result.ok).toBe(true)
    expect(rec.updates).toEqual([{ created_from_transaction_id: null }])
  })

  it('auto-unlinks a soft-deleted rule without asking', async () => {
    // `deleteRecurrence` keeps the row (audit trail of its confirmed movements),
    // so its FK still points here and RESTRICT would block the delete. There is
    // nothing for the user to decide about a rule they just deleted.
    const rec = recorder()
    const result = await deleteTransaction(
      stubClient(
        monthlyRule({ status: 'deleted', last_generated_date: '2026-08-07' }),
        rec,
      ),
      USER,
      TX,
      { today: '2026-08-04' },
    )

    expect(result.ok).toBe(true)
    expect(rec.updates).toEqual([{ created_from_transaction_id: null }])
    expect(rec.deletedTx).toBe(true)
  })
})
