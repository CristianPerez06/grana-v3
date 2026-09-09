import type { PGlite } from '@electric-sql/pglite'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { generateDueRecurrenceInstances } from '../src/queries'
import { createRecurrenceIdentityDb, U_A } from './support/recurrence-identity-db'
import { pglitePostgrest } from './support/pglite-postgrest'

/**
 * Deleting the movement that seeded a rule, when that movement was dated in the
 * FUTURE, must not lose the occurrence it was covering.
 *
 * `createRecurrenceFromMovement` sets `start_date = last_generated_date =` the
 * movement's date, and 0064 derives `reconstruct_from` from that on insert. The
 * seed movement IS the occurrence for `start_date`, so the generator correctly
 * never materializes it. Delete the movement and that premise is gone — but the
 * floor cannot follow, because 0064 makes it immutable on purpose.
 *
 * The old repair (clearing `last_generated_date`) worked when the generator read
 * the cursor. It no longer does, so this pins what has to be true instead: after
 * unlinking, the occurrence for `start_date` exists.
 */

const RULE = '00000000-0000-0000-0000-000000006001'
const SEED_DATE = '2026-10-07'
const ACCOUNT = '00000000-0000-0000-0000-0000000060a1'

let db: PGlite

beforeAll(async () => {
  db = await createRecurrenceIdentityDb()
  // Post-activation state: step 6 needs the rule to hold the repaired occurrence
  // AND the next one at the same time, which the single-pending index forbids.
  await db.exec('drop index recurrence_instances_one_pending_per_rule;')
  await db.exec(`
    insert into public.accounts (id, user_id, name, type)
    values ('${ACCOUNT}', '${U_A}', 'Banco', 'bank');
    -- A rule seeded from a movement dated in the future, exactly as
    -- createRecurrenceFromMovement writes it.
    insert into public.recurrences
      (id, user_id, amount, description, interval_count, interval_unit,
       start_date, last_generated_date, status, account_id, currency_code)
    values ('${RULE}', '${U_A}', 450000, 'Alquiler', 1, 'month',
            '${SEED_DATE}', '${SEED_DATE}', 'active', '${ACCOUNT}', 'ARS');
  `)
}, 120_000)

afterAll(async () => {
  await db?.close()
})

async function dueDates(): Promise<string[]> {
  const result = await db.query<{ due_date: string }>(
    `select to_char(due_date, 'YYYY-MM-DD') as due_date
       from public.recurrence_instances where recurrence_id = $1 order by due_date`,
    [RULE],
  )
  return result.rows.map((row) => row.due_date)
}

describe('a future seed whose movement is deleted', () => {
  it('keeps its first occurrence reachable, in one sequence', async () => {
    // The floor 0064 derived from the seed, and its immutability.
    const floor = await db.query<{ floor: string }>(
      `select to_char(reconstruct_from, 'YYYY-MM-DD') as floor
         from public.recurrences where id = $1`,
      [RULE],
    )
    expect(floor.rows[0].floor).toBe(SEED_DATE)

    // 1 · Before the date arrives, nothing is owed — the seed movement covers it.
    await generateDueRecurrenceInstances(pglitePostgrest(db), U_A, { today: '2026-09-08' })
    expect(await dueDates()).toEqual([])

    // 2 · The floor cannot be lowered to let the generator produce it later.
    await expect(
      db.exec(`update public.recurrences
                  set reconstruct_from = '2026-10-06' where id = '${RULE}';`),
    ).rejects.toThrow(/immutable/)

    // 3 · The seed movement is deleted and the rule kept: `deleteTransaction`
    //     unlinks it and materializes the occurrence that lost its cover. That
    //     mutation lives in @grana/transactions-mutations and needs the whole
    //     movement stack, so its own suite drives it; what it writes is this row.
    await db.exec(`
      update public.recurrences
         set created_from_transaction_id = null, last_generated_date = null
       where id = '${RULE}';
      insert into public.recurrence_instances
        (recurrence_id, user_id, scheduled_date, due_date, status, amount, account_id, currency_code)
      values ('${RULE}', '${U_A}', '${SEED_DATE}', '${SEED_DATE}', 'pending', 450000, '${ACCOUNT}', 'ARS');
    `)

    // 4 · The occurrence exists and is resolvable — it did not disappear.
    expect(await dueDates()).toEqual([SEED_DATE])

    // 5 · Reaching and passing the date changes nothing about it: the generator
    //     does not duplicate it, and it does not skip the period either.
    const result = await generateDueRecurrenceInstances(pglitePostgrest(db), U_A, {
      today: '2026-10-08',
    })

    expect(result.error).toBeNull()
    expect(await dueDates()).toEqual([SEED_DATE])

    // 6 · And the calendar keeps going from there.
    await generateDueRecurrenceInstances(pglitePostgrest(db), U_A, { today: '2026-11-08' })
    expect(await dueDates()).toEqual([SEED_DATE, '2026-11-07'])
  }, 120_000)

  it('would have lost that occurrence without the repair', async () => {
    // The regression itself: same rule, same floor, no repair. The generator
    // reconstructs strictly after the floor, so `start_date` is never produced —
    // the period the deleted movement was covering simply vanishes.
    const bare = '00000000-0000-0000-0000-000000006002'
    await db.exec(`
      insert into public.recurrences
        (id, user_id, amount, description, interval_count, interval_unit,
         start_date, last_generated_date, status, account_id, currency_code)
      values ('${bare}', '${U_A}', 450000, 'Alquiler', 1, 'month',
              '${SEED_DATE}', '${SEED_DATE}', 'active', '${ACCOUNT}', 'ARS');
      update public.recurrences set created_from_transaction_id = null where id = '${bare}';
    `)

    await generateDueRecurrenceInstances(pglitePostgrest(db), U_A, { today: '2026-11-08' })

    const produced = await db.query<{ due_date: string }>(
      `select to_char(due_date, 'YYYY-MM-DD') as due_date
         from public.recurrence_instances where recurrence_id = $1 order by due_date`,
      [bare],
    )
    expect(produced.rows.map((r) => r.due_date)).toEqual(['2026-11-07'])
    expect(produced.rows.map((r) => r.due_date)).not.toContain(SEED_DATE)
  }, 120_000)
})
