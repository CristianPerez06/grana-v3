import type { PGlite } from '@electric-sql/pglite'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { createRecurrenceIdentityDb, U_A } from './support/recurrence-identity-db'
import { pglitePostgrest } from './support/pglite-postgrest'

// Confirming creates a real movement through @grana/transactions-mutations, a
// stack this harness does not model. Mocking only the creators — the same seam
// `confirm-writes.test.ts` uses — keeps EVERYTHING ELSE real: the validation,
// the account check, the instance write, and above all what the mutation does
// (and does not do) to the rule.
const CREATED_TX = '99999999-9999-4999-8999-999999999999'
vi.mock('@grana/transactions-mutations', () => ({
  createExpense: async () => ({ ok: true, id: CREATED_TX }),
  createIncome: async () => ({ ok: true, id: CREATED_TX }),
  createTransfer: async () => ({ ok: true, id: CREATED_TX }),
  registerCardPurchase: async () => ({ ok: true, id: CREATED_TX }),
  deleteTransaction: async () => ({ ok: true }),
}))

const { confirmRecurrenceInstance, skipRecurrenceInstance } = await import('../src/mutations')
const { generateDueRecurrenceInstances } = await import('../src/queries')

/**
 * #96, END TO END, through the real mutations and the real generator.
 *
 * `out-of-order-resolution.test.ts` pins the property on the pure core, but it
 * builds the set of existing occurrences by hand. That proved nothing about what
 * happens to the user, because the flow used to advance a cursor: resolving
 * August moved `last_generated_date` past July, and July — still owed — stopped
 * existing for every reader.
 *
 * Here the occurrences are materialized by the generator, resolved by the
 * mutations, and recomputed by the generator again.
 *
 * The single-pending index is dropped: this is the state after the activation,
 * and with it in place a rule could not hold June, July and August at once.
 */

const TODAY = '2026-09-08'
const RULE = '00000000-0000-0000-0000-000000005001'
const ACCOUNT = '00000000-0000-0000-0000-0000000050a1'
const CATEGORY = '00000000-0000-0000-0000-0000000050c1'

let db: PGlite

beforeAll(async () => {
  db = await createRecurrenceIdentityDb()
  await db.exec('drop index recurrence_instances_one_pending_per_rule;')
  // Monthly on the 23rd, last known point 2026-05-23: June, July and August are
  // owed. The exact shape of the ticket.
  await db.exec(`
    insert into public.accounts (id, user_id, name, type)
    values ('${ACCOUNT}', '${U_A}', 'Banco', 'bank');
    insert into public.categories (id, user_id, name, canonical_name)
    values ('${CATEGORY}', '${U_A}', 'Vivienda', 'housing');
    insert into public.recurrences
      (id, user_id, amount, description, interval_count, interval_unit,
       start_date, last_generated_date, status, account_id, currency_code, category_id)
    values ('${RULE}', '${U_A}', 450000, 'Alquiler', 1, 'month',
            '2026-05-23', '2026-05-23', 'active', '${ACCOUNT}', 'ARS', '${CATEGORY}');
  `)
}, 120_000)

afterAll(async () => {
  await db?.close()
})

const client = () => pglitePostgrest(db)

async function occurrences(): Promise<Array<{ due_date: string; status: string }>> {
  const result = await db.query<{ due_date: string; status: string }>(
    `select to_char(due_date, 'YYYY-MM-DD') as due_date, status
       from public.recurrence_instances
      where recurrence_id = $1 order by due_date`,
    [RULE],
  )
  return result.rows
}

async function cursor(): Promise<string | null> {
  const result = await db.query<{ cursor: string | null }>(
    `select to_char(last_generated_date, 'YYYY-MM-DD') as cursor
       from public.recurrences where id = $1`,
    [RULE],
  )
  return result.rows[0].cursor
}

async function instanceIdFor(dueDate: string): Promise<string> {
  const result = await db.query<{ id: string }>(
    `select id from public.recurrence_instances
      where recurrence_id = $1 and due_date = $2`,
    [RULE, dueDate],
  )
  return result.rows[0].id
}

// ONE sequence, one test. Each step depends on what the previous one left in the
// database, so splitting it into separate `it`s made them pass only in order and
// fail in isolation — a suite that cannot be run one case at a time is not
// telling the truth about which step broke.
describe('resolving out of order, through the real flow', () => {
  it('resolves August then July, and June survives all of it', async () => {
    // 1 · The generator materializes the three occurrences the rule owes.
    //     Three runs: the batch is filled current-first, so a backlog completes
    //     over successive openings.
    for (let i = 0; i < 3; i += 1) {
      await generateDueRecurrenceInstances(client(), U_A, { today: TODAY })
    }

    expect(await occurrences()).toEqual([
      { due_date: '2026-06-23', status: 'pending' },
      { due_date: '2026-07-23', status: 'pending' },
      { due_date: '2026-08-23', status: 'pending' },
    ])

    // 2 · AUGUST is resolved first, through the real confirmation.
    const august = await confirmRecurrenceInstance(
      client(),
      U_A,
      await instanceIdFor('2026-08-23'),
      {},
    )
    expect(august.ok).toBe(true)

    expect(await occurrences()).toEqual([
      { due_date: '2026-06-23', status: 'pending' },
      { due_date: '2026-07-23', status: 'pending' },
      { due_date: '2026-08-23', status: 'confirmed' },
    ])

    // 3 · JULY is resolved next — out of order — through the real skip.
    expect(await skipRecurrenceInstance(client(), U_A, await instanceIdFor('2026-07-23'))).toEqual({
      ok: true,
    })

    // 4 · Neither resolution wrote the cursor. This is the write that made #96
    //     permanent: confirming August would have pushed it to 2026-08-23, and
    //     from then on July did not exist for anyone.
    expect(await cursor()).toBe('2026-05-23')

    // 5 · Re-running the generator brings nothing back and skips nothing.
    await generateDueRecurrenceInstances(client(), U_A, { today: TODAY })
    expect(await occurrences()).toEqual([
      { due_date: '2026-06-23', status: 'pending' },
      { due_date: '2026-07-23', status: 'skipped' },
      { due_date: '2026-08-23', status: 'confirmed' },
    ])

    // 6 · The calendar did not move: September is the next thing owed.
    const september = await generateDueRecurrenceInstances(client(), U_A, {
      today: '2026-09-30',
    })
    expect(september.error).toBeNull()
    expect((await occurrences()).map((o) => o.due_date)).toEqual([
      '2026-06-23',
      '2026-07-23',
      '2026-08-23',
      '2026-09-23',
    ])

    // 7 · JUNE is still there, and still resolvable, after all of it.
    expect(await skipRecurrenceInstance(client(), U_A, await instanceIdFor('2026-06-23'))).toEqual({
      ok: true,
    })
    expect(await cursor()).toBe('2026-05-23')
  }, 180_000)
})
