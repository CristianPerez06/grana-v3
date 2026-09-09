import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import type { PGlite } from '@electric-sql/pglite'
import type { GranaSupabaseClient } from '@grana/supabase'
import {
  actAs,
  actAsAdmin,
  applyMigration,
  createRecurrenceIdentityDb,
  U_A,
} from './support/recurrence-identity-db'

/**
 * "An unresolved occurrence always has an exact vencimiento", enforced.
 *
 * `validate_schema.sql` already asserted it, but an assertion detects bad data
 * when someone runs it — it does not stop the data from appearing. RLS lets a
 * user write their own instances, and there is exactly one transition that
 * starts from a legitimate NULL: a historical `confirmed` row, whose vencimiento
 * 0064 could not recover, updated back to `pending`. Neither the compatibility
 * trigger (it derives `due_date` on INSERT only) nor the immutability guard (it
 * refuses to CHANGE a due date that exists) covers that one.
 *
 * The consequence was not a crash but a wrong number: the confirmation fell back
 * to `scheduled_date`, a date the spec itself declares of uncertain meaning, and
 * filed the movement in whatever month it happened to hold.
 */

let db: PGlite

/**
 * The rejection's constraint NAME, not just its SQLSTATE. Three other checks on
 * this table also raise 23514 — reopening a `confirmed` row trips the
 * `resolution_kind` one first if the update forgets to clear it — so asserting
 * on the code alone lets a test pass while proving nothing about this guard.
 */
async function rejectedBy(sql: string): Promise<string | null> {
  try {
    await db.exec(sql)
    return null
  } catch (error) {
    const { code, constraint, message } = error as {
      code?: string
      constraint?: string
      message?: string
    }
    return constraint ?? `${code ?? 'UNKNOWN'}: ${message ?? ''}`
  }
}

const GUARD = 'chk_recurrence_instances_unresolved_has_due_date'

const RULE = '00000000-0000-0000-0000-000000005001'
const HISTORICAL = '00000000-0000-0000-0000-000000005002'
const KNOWN = '00000000-0000-0000-0000-000000005003'

describe(GUARD, () => {
  beforeAll(async () => {
    // The historical row can only be built the way it really exists: inserted
    // BEFORE 0064 and left with a null `due_date` by its backfill. Seeding it
    // afterwards is impossible — the compatibility trigger derives `due_date`
    // from `scheduled_date` on INSERT — so a fixture that creates it after the
    // migration is testing a row production does not have.
    db = await createRecurrenceIdentityDb({ applyMigration: false })
    await db.exec(`
      insert into public.recurrences
        (id, user_id, amount, interval_count, interval_unit, start_date, last_generated_date, status)
      values ('${RULE}', '${U_A}', 2500, 1, 'month', '2026-09-15', '2026-09-15', 'active');
      insert into public.recurrence_instances
        (id, recurrence_id, user_id, scheduled_date, status, resolved_at, confirmed_transaction_id)
      values ('${HISTORICAL}', '${RULE}', '${U_A}', '2026-09-15', 'confirmed', now(), gen_random_uuid());
    `)
    await applyMigration(db)

    // …and one whose vencimiento IS known, for the control case. After 0064 the
    // trigger derives it, which is exactly the point.
    await db.exec(`
      insert into public.recurrence_instances
        (id, recurrence_id, user_id, scheduled_date, status, resolved_at, confirmed_transaction_id)
      values ('${KNOWN}', '${RULE}', '${U_A}', '2026-10-15', 'confirmed', now(), gen_random_uuid());
    `)

    const { rows } = await db.query<{ id: string; due_date: string | null }>(
      `select id::text, due_date::text from public.recurrence_instances order by scheduled_date`,
    )
    expect(rows).toEqual([
      { id: HISTORICAL, due_date: null },
      { id: KNOWN, due_date: '2026-10-15' },
    ])

    await actAs(db, U_A)
  }, 120_000)

  afterAll(async () => {
    await db?.close()
  })

  it('refuses to reopen a historical occurrence that has no vencimiento', async () => {
    // The user's own row, written as the user: RLS permits it, the CHECK does
    // not. `resolution_kind` is cleared so the only thing left to reject the
    // write is the guard under test.
    const rejection = await rejectedBy(
      `update public.recurrence_instances
          set status = 'pending', resolved_at = null, confirmed_transaction_id = null,
              resolution_kind = null
        where id = '${HISTORICAL}';`,
    )

    expect(rejection).toBe(GUARD)
  })

  it('refuses `skipped` without a vencimiento too', async () => {
    // A skipped occurrence is resolved but still OCCUPIES its due date, and the
    // identity index only dedupes on exact ones.
    const rejection = await rejectedBy(
      `update public.recurrence_instances
          set status = 'skipped', confirmed_transaction_id = null, resolution_kind = null
        where id = '${HISTORICAL}';`,
    )

    expect(rejection).toBe(GUARD)
  })

  it('still allows reopening one whose vencimiento IS known', async () => {
    // The constraint is about the missing date, not about the transition.
    const rejection = await rejectedBy(
      `update public.recurrence_instances
          set status = 'pending', resolved_at = null, confirmed_transaction_id = null,
              resolution_kind = null
        where id = '${KNOWN}';`,
    )

    expect(rejection).toBeNull()
  })

  it('leaves the historical row exactly as it was', async () => {
    await actAsAdmin(db)
    const { rows } = await db.query<{ status: string; due_date: string | null }>(
      `select status, due_date::text from public.recurrence_instances where id = '${HISTORICAL}'`,
    )
    await actAs(db, U_A)

    expect(rows[0]).toEqual({ status: 'confirmed', due_date: null })
  })
})

// ── The second defence ───────────────────────────────────────────────────────
// The CHECK stops the row from being created. This is what happens if one
// exists anyway — an older deployment, a direct write, a restored dump.

const created = vi.hoisted(() => [] as Record<string, unknown>[])

vi.mock('@grana/transactions-mutations', () => {
  const record = (input: Record<string, unknown>) => {
    created.push(input)
    return { ok: true, id: '55555555-5555-4555-8555-555555555555' }
  }
  return {
    createExpense: async (_c: unknown, _u: unknown, input: Record<string, unknown>) =>
      record(input),
    createIncome: async (_c: unknown, _u: unknown, input: Record<string, unknown>) =>
      record(input),
    createTransfer: async (_c: unknown, _u: unknown, input: Record<string, unknown>) =>
      record(input),
    registerCardPurchase: async ({ input }: { input: Record<string, unknown> }) =>
      record(input),
    deleteTransaction: async () => ({ ok: true }),
  }
})

const { confirmRecurrenceInstance } = await import('../src/mutations')

const USER = '00000000-0000-4000-8000-000000000000'
const INSTANCE = '11111111-1111-4111-8111-111111111111'

function clientWithDueDate(dueDate: string | null): GranaSupabaseClient {
  const instance = {
    id: INSTANCE,
    recurrence_id: '22222222-2222-4222-8222-222222222222',
    status: 'pending',
    scheduled_date: '2026-09-15',
    due_date: dueDate,
    amount: 450000,
    account_id: '33333333-3333-4333-8333-333333333333',
    transfer_destination_account_id: null,
    currency_code: 'ARS',
    category_id: '44444444-4444-4444-8444-444444444444',
    subcategory_id: null,
    description: 'Rent',
    household_id: null,
    split: null,
  }

  return {
    from(table: string) {
      if (table === 'recurrence_instances') {
        return {
          select: () => ({
            eq: () => ({ eq: () => ({ single: async () => ({ data: instance, error: null }) }) }),
          }),
          update: () => ({
            eq: () => ({
              eq: () => ({
                eq: () => ({ select: async () => ({ data: [{ id: INSTANCE }], error: null }) }),
              }),
            }),
          }),
        }
      }
      if (table === 'recurrences') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                single: async () => ({
                  data: {
                    id: '22222222-2222-4222-8222-222222222222',
                    movement_type: 'expense',
                    amount: 450000,
                    status: 'active',
                  },
                  error: null,
                }),
              }),
            }),
          }),
        }
      }
      if (table === 'accounts') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                single: async () => ({ data: { type: 'bank', is_active: true }, error: null }),
              }),
            }),
          }),
        }
      }
      throw new Error(`unexpected table: ${table}`)
    },
  } as unknown as GranaSupabaseClient
}

describe('confirming an occurrence with no vencimiento', () => {
  it('fails with a visible message and writes NO movement', async () => {
    created.length = 0

    const result = await confirmRecurrenceInstance(clientWithDueDate(null), USER, INSTANCE, {})

    expect(result.ok).toBe(false)
    expect(result.ok === false && result.formError).toMatch(/vencimiento/i)
    // The point of the refusal: `scheduled_date` here is 15-Sep, so the silent
    // fallback would have filed the movement in September.
    expect(created).toHaveLength(0)
  })

  it('still confirms normally when the vencimiento is there', async () => {
    created.length = 0

    const result = await confirmRecurrenceInstance(
      clientWithDueDate('2026-06-23'),
      USER,
      INSTANCE,
      {},
    )

    expect(result.ok).toBe(true)
    expect(created).toEqual([expect.objectContaining({ date: '2026-06-23' })])
  })
})
