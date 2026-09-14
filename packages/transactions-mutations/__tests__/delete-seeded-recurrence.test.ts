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
  /** Since when the current schedule rules (#121). */
  schedule_effective_from: string | null
  /** Positions spent before that schedule started ruling (#121). */
  schedule_positions_before: number
  /** The occurrence the seed movement covers — NOT the anchor (#121). */
  seed_occurrence_date: string | null
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
  schedule_effective_from: '2026-08-07',
  schedule_positions_before: 0,
  seed_occurrence_date: '2026-08-07',
  ...over,
})

/**
 * PostgREST answers with the columns the query ASKED FOR. A fake that hands back
 * the whole fixture proves the code that reads the row and never the `.select()`
 * that fetches it — drop a column from the real query and everything stays green
 * while production reads `undefined`. Which is how the floor went missing twice.
 */
const project = (row: RuleRow | null, columns: string): Record<string, unknown> | null => {
  if (row == null) return null
  const out: Record<string, unknown> = {}
  for (const name of columns.split(',').map((c) => c.trim()).filter(Boolean)) {
    if (!(name in row)) {
      throw new Error(`recurrences.${name} was selected but the fixture has no such column`)
    }
    out[name] = (row as unknown as Record<string, unknown>)[name]
  }
  return out
}

// Records what the mutation wrote, so the tests can assert the repair.
type Recorder = {
  updates: Record<string, unknown>[]
  deletedTx: boolean
  /** Arguments of every `delete_movement_unlinking_seed` call. */
  rpcCalls: Array<{ name: string; args: Record<string, unknown> }>
}

type Failures = {
  failRpc?: { code: string }
  failTxDelete?: { code: string }
}

function stubClient(
  rule: RuleRow | null,
  rec: Recorder,
  fail: Failures = {},
): GranaSupabaseClient {
  return {
    rpc: async (name: string, args: Record<string, unknown>) => {
      rec.rpcCalls.push({ name, args })
      if (fail.failRpc) return { data: null, error: fail.failRpc }
      // The function unlinks, releases the floor and deletes the movement in one
      // transaction; from the client all that is observable is that it succeeded.
      rec.deletedTx = true
      return { data: null, error: null }
    },
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
                if (fail.failTxDelete) return { error: fail.failTxDelete }
                rec.deletedTx = true
                return { error: null }
              },
            }),
          }),
        }
      }
      if (table === 'period_payments') {
        return {
          // `.limit(1)` antes del terminal: un mismo débito puede tener varias patas
          // (los pesos y los dólares de un mismo resumen), así que la consulta pregunta
          // "¿existe alguna?". El fake tiene que ofrecer el mismo eslabón que la cadena
          // real o el guard explota antes de llegar a lo que estos tests miran.
          select: () => ({
            eq: () => ({ limit: () => ({ maybeSingle: async () => ({ data: null }) }) }),
          }),
        }
      }
      if (table === 'recurrences') {
        return {
          select: (columns: string) => ({
            eq: () => ({
              eq: () => ({ maybeSingle: async () => ({ data: project(rule, columns) }) }),
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

const recorder = (): Recorder => ({ updates: [], deletedTx: false, rpcCalls: [] })

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

  // ── The anchor is mutable now, and this screen still names an occurrence ──

  it('names the occurrence the SEED covers, not the corrected anchor', async () => {
    // Seed dated 07/08, reference corrected to 09/08 taking effect at once. The
    // movement covers the 7th and always will; reading the covered occurrence off
    // `start_date` instead marks the 9th as already existing and announces the
    // NEXT cycle — the rule's first real occurrence, hidden from the user at the
    // exact moment they are deciding whether to keep it.
    const rec = recorder()
    const result = await deleteTransaction(
      stubClient(
        monthlyRule({
          start_date: '2026-08-09',
          seed_occurrence_date: '2026-08-07',
          schedule_effective_from: '2026-08-09',
        }),
        rec,
      ),
      USER,
      TX,
      { today: '2026-08-04' },
    )

    expect(result.seededRecurrence?.next_occurrence).toBe('2026-08-09')
  })

  it('does not name a date from the stretch that belongs to nobody', async () => {
    // Same correction, taking effect NEXT cycle: between today and 09/09 the old
    // schedule has stopped and the new one has not begun. Without the floor this
    // offers 09/08 — a vencimiento the generator is never going to create.
    const rec = recorder()
    const result = await deleteTransaction(
      stubClient(
        monthlyRule({
          start_date: '2026-08-09',
          seed_occurrence_date: '2026-08-07',
          schedule_effective_from: '2026-09-09',
        }),
        rec,
      ),
      USER,
      TX,
      { today: '2026-08-04' },
    )

    expect(result.seededRecurrence?.next_occurrence).toBe('2026-09-09')
  })

  it('unlink hands the whole repair to one transaction', async () => {
    // The exact production shape: rule created 31-jul from a movement dated
    // 7-ago. Deleting that movement without putting anything in its place makes
    // the rule skip August entirely.
    //
    // WHAT the repair does — unlink, release the reconstruction floor by one day,
    // delete the movement — lives in `delete_movement_unlinking_seed` (0065) and
    // is pinned against the real database in
    // `packages/recurrences/__tests__/future-seed-repair.test.ts`. What this
    // asserts is that the client hands it over as ONE call instead of issuing the
    // writes itself, because a partial outcome here duplicates a gasto or loses
    // an occurrence and cannot be compensated: 0064's guard lets the floor move
    // one way only.
    const rec = recorder()
    const result = await deleteTransaction(
      stubClient(monthlyRule({ start_date: '2026-08-07', last_generated_date: '2026-08-07' }), rec),
      USER,
      TX,
      { today: '2026-08-04', seedResolution: 'unlink' },
    )

    expect(result.ok).toBe(true)
    expect(rec.rpcCalls).toEqual([
      { name: 'delete_movement_unlinking_seed', args: { p_transaction_id: TX } },
    ])
    // No write of its own: nothing to come apart from the delete.
    expect(rec.updates).toEqual([])
    expect(rec.deletedTx).toBe(true)
  })

  it('surfaces a failure of the repair instead of reporting success', async () => {
    // Whatever fails inside — the guard, RLS, the temporal guard on the delete —
    // the transaction rolls the whole thing back, so there is nothing to undo and
    // nothing partial left behind. The caller only has to be told.
    const rec = recorder()
    const client = stubClient(
      monthlyRule({ start_date: '2026-08-07', last_generated_date: '2026-08-07' }),
      rec,
      { failRpc: { code: 'GRN01' } },
    )

    const result = await deleteTransaction(client, USER, TX, {
      today: '2026-08-04',
      seedResolution: 'unlink',
    })

    expect(result.ok).toBe(false)
    expect(result.ok === false && result.errorCode).toBe('GRN01')
    expect(rec.deletedTx).toBe(false)
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
    expect(rec.rpcCalls).toHaveLength(1)
    expect(rec.updates).toEqual([])
    expect(rec.deletedTx).toBe(true)
  })

  it('unlink of a past start_date goes through the same single call', async () => {
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
    expect(rec.rpcCalls).toHaveLength(1)
    expect(rec.updates).toEqual([])
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
    expect(rec.rpcCalls).toHaveLength(1)
    expect(rec.updates).toEqual([])
    expect(rec.deletedTx).toBe(true)
  })
})
