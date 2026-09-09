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
const SEED_TX = '00000000-0000-0000-0000-0000000060f1'

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
       start_date, last_generated_date, status, account_id, currency_code,
       created_from_transaction_id)
    values ('${RULE}', '${U_A}', 450000, 'Alquiler', 1, 'month',
            '${SEED_DATE}', '${SEED_DATE}', 'active', '${ACCOUNT}', 'ARS',
            '${SEED_TX}');
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
  it('keeps its first occurrence reachable, on its own date, in one sequence', async () => {
    // The floor 0064 derived from the seed.
    const floorNow = async () => {
      const result = await db.query<{ floor: string }>(
        `select to_char(reconstruct_from, 'YYYY-MM-DD') as floor
           from public.recurrences where id = $1`,
        [RULE],
      )
      return result.rows[0].floor
    }
    expect(await floorNow()).toBe(SEED_DATE)

    // 1 · Before the date arrives nothing is owed — the seed movement covers it.
    await generateDueRecurrenceInstances(pglitePostgrest(db), U_A, { today: '2026-09-08' })
    expect(await dueDates()).toEqual([])

    // 2 · The floor does not move for an ordinary edit. It never did, and the
    //     exception below must not have opened a door for one.
    await expect(
      db.exec(`update public.recurrences
                  set reconstruct_from = '2026-01-01' where id = '${RULE}';`),
    ).rejects.toThrow(/immutable/)

    // 3 · Nor while the rule is still seeded: the movement is still covering it.
    await expect(
      db.exec(`update public.recurrences
                  set reconstruct_from = '2026-10-06' where id = '${RULE}';`),
    ).rejects.toThrow(/immutable/)

    // 4 · The repair `deleteTransaction` performs: unlink and release the floor
    //     by exactly one day, in ONE statement. The guard accepts it.
    await db.exec(`
      update public.recurrences
         set created_from_transaction_id = null,
             last_generated_date = null,
             reconstruct_from = '2026-10-06'
       where id = '${RULE}';
    `)
    expect(await floorNow()).toBe('2026-10-06')

    // 5 · Nothing appears yet. THE TIMING IS THE POINT: the occurrence is not
    //     conjured into "por revisar" the moment the movement is deleted; it
    //     waits for its own date, exactly as it did before this change.
    await generateDueRecurrenceInstances(pglitePostgrest(db), U_A, { today: '2026-09-08' })
    expect(await dueDates()).toEqual([])

    // 6 · When the date arrives, the generator produces it. The period the
    //     deleted movement was covering is not lost.
    const arrived = await generateDueRecurrenceInstances(pglitePostgrest(db), U_A, {
      today: '2026-10-08',
    })
    expect(arrived.error).toBeNull()
    expect(await dueDates()).toEqual([SEED_DATE])

    // 7 · And it is produced ONCE, with the calendar going on from there.
    await generateDueRecurrenceInstances(pglitePostgrest(db), U_A, { today: '2026-11-08' })
    expect(await dueDates()).toEqual([SEED_DATE, '2026-11-07'])

    // 8 · The released floor is itself immutable again: one day, once.
    await expect(
      db.exec(`update public.recurrences
                  set reconstruct_from = '2026-10-05' where id = '${RULE}';`),
    ).rejects.toThrow(/immutable/)
  }, 120_000)

  it('would have lost that occurrence with the floor left frozen', async () => {
    // The regression itself: same rule, same floor, unlinked but never released.
    // The generator reconstructs strictly after the floor, so `start_date` is
    // never produced and the period simply vanishes.
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

  it('does not let the exception release a floor whose start_date is in the past', async () => {
    // `acceptRecurrenceSuggestion` produces the same floor shape — floor equal to
    // start_date, no seed link — but from the last date DETECTION SAW, always in
    // the past, and there the movement really does exist. Releasing it would
    // materialize an occurrence for a gasto the user already has.
    const past = '00000000-0000-0000-0000-000000006003'
    await db.exec(`
      insert into public.recurrences
        (id, user_id, amount, description, interval_count, interval_unit,
         start_date, last_generated_date, status, account_id, currency_code)
      values ('${past}', '${U_A}', 450000, 'Alquiler', 1, 'month',
              '2026-07-07', '2026-07-07', 'active', '${ACCOUNT}', 'ARS');
    `)

    await expect(
      db.exec(`update public.recurrences
                  set created_from_transaction_id = null, reconstruct_from = '2026-07-06'
                where id = '${past}';`),
    ).rejects.toThrow(/immutable/)
  }, 120_000)
})
