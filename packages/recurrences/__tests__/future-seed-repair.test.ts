import type { PGlite } from '@electric-sql/pglite'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { generateDueRecurrenceInstances } from '../src/queries'
import { actAs, actAsAdmin, createRecurrenceIdentityDb, U_A } from './support/recurrence-identity-db'
import { pglitePostgrest } from './support/pglite-postgrest'

/**
 * Deleting the movement that seeded a rule, when that movement was dated in the
 * FUTURE, must not lose the occurrence it was covering — and must not surface it
 * before its date either.
 *
 * `createRecurrenceFromMovement` sets `start_date = last_generated_date =` the
 * movement's date, and 0064 derives `reconstruct_from` from that on insert. The
 * seed movement IS the occurrence for `start_date`, so the generator correctly
 * never materializes it. Delete the movement and that premise is gone.
 *
 * The repair is `delete_movement_unlinking_seed` (0065): unlink, release the
 * floor by exactly one day, and delete the movement, in ONE transaction.
 *
 * DATES ARE RELATIVE TO THE DATABASE'S OWN TODAY. The guard asks whether
 * `start_date` is still in the future, so a hard-coded seed date would quietly
 * stop testing the future case the day it passed — and then start failing.
 */

const RULE = '00000000-0000-0000-0000-000000006001'
const ACCOUNT = '00000000-0000-0000-0000-0000000060a1'
const SEED_TX = '00000000-0000-0000-0000-0000000060f1'

let db: PGlite
/** 30 days ahead of the database's today, read back as an ISO string. */
let seedDate: string
/** The day before it: the floor the rule would have had with no seed. */
let released: string
let beforeSeed: string
let afterSeed: string
let nextOccurrence: string

beforeAll(async () => {
  db = await createRecurrenceIdentityDb()
  // Post-activation state: the last step needs the repaired occurrence and the
  // next one at once, which the single-pending index forbids.
  await db.exec('drop index recurrence_instances_one_pending_per_rule;')

  const dates = await db.query<{
    seed: string
    released: string
    before: string
    after: string
    next: string
  }>(`
    with t as (select (now() at time zone 'America/Argentina/Buenos_Aires')::date as d)
    select to_char(d + 30, 'YYYY-MM-DD')            as seed,
           to_char(d + 29, 'YYYY-MM-DD')            as released,
           to_char(d + 1,  'YYYY-MM-DD')            as before,
           to_char(d + 31, 'YYYY-MM-DD')            as after,
           to_char((d + 30) + interval '1 month', 'YYYY-MM-DD') as next
      from t
  `)
  ;({
    seed: seedDate,
    released,
    before: beforeSeed,
    after: afterSeed,
    next: nextOccurrence,
  } = dates.rows[0])

  await db.exec(`
    insert into public.accounts (id, user_id, name, type)
    values ('${ACCOUNT}', '${U_A}', 'Banco', 'bank');
    insert into public.transactions (id, user_id, date, amount)
    values ('${SEED_TX}', '${U_A}', '${seedDate}', 450000);
    -- A rule seeded from a movement dated in the future, exactly as
    -- createRecurrenceFromMovement writes it.
    insert into public.recurrences
      (id, user_id, amount, description, interval_count, interval_unit,
       start_date, last_generated_date, status, account_id, currency_code,
       created_from_transaction_id)
    values ('${RULE}', '${U_A}', 450000, 'Alquiler', 1, 'month',
            '${seedDate}', '${seedDate}', 'active', '${ACCOUNT}', 'ARS',
            '${SEED_TX}');
  `)
}, 120_000)

afterAll(async () => {
  await db?.close()
})

async function dueDates(ruleId = RULE): Promise<string[]> {
  const result = await db.query<{ due_date: string }>(
    `select to_char(due_date, 'YYYY-MM-DD') as due_date
       from public.recurrence_instances where recurrence_id = $1 order by due_date`,
    [ruleId],
  )
  return result.rows.map((row) => row.due_date)
}

async function floorOf(ruleId = RULE): Promise<string> {
  const result = await db.query<{ floor: string }>(
    `select to_char(reconstruct_from, 'YYYY-MM-DD') as floor
       from public.recurrences where id = $1`,
    [ruleId],
  )
  return result.rows[0].floor
}

describe('a future seed whose movement is deleted', () => {
  it('keeps its first occurrence, on its own date, through the real repair', async () => {
    expect(await floorOf()).toBe(seedDate)

    // 1 · Before the date arrives nothing is owed — the seed movement covers it.
    await generateDueRecurrenceInstances(pglitePostgrest(db), U_A, { today: beforeSeed })
    expect(await dueDates()).toEqual([])

    // 2 · The floor does not move for an ordinary edit, and does not move while
    //     the rule is still seeded either. The exception must not have opened a
    //     door for either of those.
    await expect(
      db.exec(`update public.recurrences set reconstruct_from = '2020-01-01' where id = '${RULE}';`),
    ).rejects.toThrow(/immutable/)
    await expect(
      db.exec(`update public.recurrences set reconstruct_from = '${released}' where id = '${RULE}';`),
    ).rejects.toThrow(/immutable/)

    // 3 · The movement cannot be deleted while the rule points at it: RESTRICT is
    //     what makes the unlink and the delete one operation rather than two.
    await expect(
      db.exec(`delete from public.transactions where id = '${SEED_TX}';`),
    ).rejects.toThrow(/foreign key/)

    // 4 · The repair, through the real RPC, AS THE USER. It is `security invoker`
    //     on purpose — RLS decides which rows it may touch, and it adds no reach
    //     the user did not already have — so running it as the superuser would
    //     prove nothing about whether a real client can perform it.
    await actAs(db, U_A)
    const repaired = await pglitePostgrest(db).rpc('delete_movement_unlinking_seed', {
      p_transaction_id: SEED_TX,
    })
    await actAsAdmin(db)
    expect(repaired.error).toBeNull()

    // Everything moved together: the movement is gone, the rule is unlinked, the
    // floor is released by exactly one day.
    const movement = await db.query(`select id from public.transactions where id = '${SEED_TX}'`)
    expect(movement.rows).toEqual([])
    expect(await floorOf()).toBe(released)

    // 5 · Nothing appears yet. THE TIMING IS THE POINT: the occurrence is not
    //     conjured into "por revisar" the moment the movement is deleted; it
    //     waits for its own date, exactly as it did before this change.
    await generateDueRecurrenceInstances(pglitePostgrest(db), U_A, { today: beforeSeed })
    expect(await dueDates()).toEqual([])

    // 6 · When the date arrives, the generator produces it — once — and the
    //     calendar carries on from there.
    const arrived = await generateDueRecurrenceInstances(pglitePostgrest(db), U_A, {
      today: afterSeed,
    })
    expect(arrived.error).toBeNull()
    expect(await dueDates()).toEqual([seedDate])

    await generateDueRecurrenceInstances(pglitePostgrest(db), U_A, { today: nextOccurrence })
    expect(await dueDates()).toEqual([seedDate, nextOccurrence])

    // 7 · The released floor is immutable again: one day, once.
    await expect(
      db.exec(`update public.recurrences
                  set reconstruct_from = '${beforeSeed}' where id = '${RULE}';`),
    ).rejects.toThrow(/immutable/)
  }, 120_000)

  it('rolls the whole repair back when the delete is refused', async () => {
    // The reason this had to become one transaction. If the unlink and the floor
    // release survived a refused DELETE, the movement would still exist AND the
    // rule would materialize its occurrence when the date arrived — the same
    // gasto twice — and it could not even be retried into shape, because the
    // retry looks the rule up by the column the unlink just cleared.
    //
    // A trigger standing in for the real refusal (GRN01, the temporal guard on
    // `transactions`): what matters is that the DELETE raises AFTER the two
    // writes have already happened inside the function.
    const rule = '00000000-0000-0000-0000-000000006005'
    const tx = '00000000-0000-0000-0000-0000000060f5'
    await db.exec(`
      insert into public.transactions (id, user_id, date, amount)
      values ('${tx}', '${U_A}', '${seedDate}', 450000);
      insert into public.recurrences
        (id, user_id, amount, description, interval_count, interval_unit,
         start_date, last_generated_date, status, account_id, currency_code,
         created_from_transaction_id)
      values ('${rule}', '${U_A}', 450000, 'Alquiler', 1, 'month',
              '${seedDate}', '${seedDate}', 'active', '${ACCOUNT}', 'ARS', '${tx}');

      create function public.refuse_delete() returns trigger language plpgsql as $refuse$
      begin
        raise exception 'refused' using errcode = 'GRN01';
      end $refuse$;
      create trigger trg_refuse_delete before delete on public.transactions
        for each row execute function public.refuse_delete();
    `)

    await actAs(db, U_A)
    const refused = await pglitePostgrest(db).rpc('delete_movement_unlinking_seed', {
      p_transaction_id: tx,
    })
    await actAsAdmin(db)

    expect(refused.error).not.toBeNull()
    expect(refused.error?.code).toBe('GRN01')

    // NOTHING survived: the movement, the link and the floor are all as they were.
    const after = await db.query<{ tx: string | null; floor: string }>(
      `select r.created_from_transaction_id as tx,
              to_char(r.reconstruct_from, 'YYYY-MM-DD') as floor
         from public.recurrences r where r.id = $1`,
      [rule],
    )
    expect(after.rows[0].tx).toBe(tx)
    expect(after.rows[0].floor).toBe(seedDate)

    const movement = await db.query(`select id from public.transactions where id = '${tx}'`)
    expect(movement.rows).toHaveLength(1)

    // With the refusal gone the same call goes through, which is what makes the
    // rollback a retry rather than a dead end.
    await db.exec('drop trigger trg_refuse_delete on public.transactions;')
    await actAs(db, U_A)
    const retried = await pglitePostgrest(db).rpc('delete_movement_unlinking_seed', {
      p_transaction_id: tx,
    })
    await actAsAdmin(db)

    expect(retried.error).toBeNull()
    const repaired = await db.query<{ tx: string | null; floor: string }>(
      `select r.created_from_transaction_id as tx,
              to_char(r.reconstruct_from, 'YYYY-MM-DD') as floor
         from public.recurrences r where r.id = $1`,
      [rule],
    )
    expect(repaired.rows[0].tx).toBeNull()
    expect(repaired.rows[0].floor).toBe(released)
  }, 120_000)

  it('would have lost that occurrence with the floor left frozen', async () => {
    // The regression itself: same shape, unlinked but never released. The
    // generator reconstructs strictly after the floor, so `start_date` is never
    // produced and the period simply vanishes.
    const bare = '00000000-0000-0000-0000-000000006002'
    await db.exec(`
      insert into public.recurrences
        (id, user_id, amount, description, interval_count, interval_unit,
         start_date, last_generated_date, status, account_id, currency_code)
      values ('${bare}', '${U_A}', 450000, 'Alquiler', 1, 'month',
              '${seedDate}', '${seedDate}', 'active', '${ACCOUNT}', 'ARS');
    `)

    await generateDueRecurrenceInstances(pglitePostgrest(db), U_A, { today: nextOccurrence })

    expect(await dueDates(bare)).toEqual([nextOccurrence])
    expect(await dueDates(bare)).not.toContain(seedDate)
  }, 120_000)

  it('does not let the exception release a floor whose start_date is in the past', async () => {
    // `acceptRecurrenceSuggestion` produces the same floor shape — floor equal to
    // start_date, no seed link — but from the last date DETECTION SAW, always in
    // the past, and there the movement really does exist. Releasing it would
    // materialize an occurrence for a gasto the user already has.
    const past = '00000000-0000-0000-0000-000000006003'
    const pastTx = '00000000-0000-0000-0000-0000000060f3'
    const pastDates = await db.query<{ start: string; released: string }>(`
      with t as (select (now() at time zone 'America/Argentina/Buenos_Aires')::date as d)
      select to_char(d - 30, 'YYYY-MM-DD') as start, to_char(d - 31, 'YYYY-MM-DD') as released
        from t
    `)
    const { start, released: pastReleased } = pastDates.rows[0]

    await db.exec(`
      insert into public.transactions (id, user_id, date, amount)
      values ('${pastTx}', '${U_A}', '${start}', 450000);
      insert into public.recurrences
        (id, user_id, amount, description, interval_count, interval_unit,
         start_date, last_generated_date, status, account_id, currency_code,
         created_from_transaction_id)
      values ('${past}', '${U_A}', 450000, 'Alquiler', 1, 'month',
              '${start}', '${start}', 'active', '${ACCOUNT}', 'ARS', '${pastTx}');
    `)

    await expect(
      db.exec(`update public.recurrences
                  set created_from_transaction_id = null, reconstruct_from = '${pastReleased}'
                where id = '${past}';`),
    ).rejects.toThrow(/immutable/)

    // And the repair itself leaves that floor where it is.
    await actAs(db, U_A)
    const repaired = await pglitePostgrest(db).rpc('delete_movement_unlinking_seed', {
      p_transaction_id: pastTx,
    })
    await actAsAdmin(db)
    expect(repaired.error).toBeNull()
    expect(await floorOf(past)).toBe(start)
  }, 120_000)

  it('does not release the floor of a rule that never had a seed', async () => {
    // Requiring the seed to have existed is what makes this a repair and not a
    // transition any rule can reach.
    const unseeded = '00000000-0000-0000-0000-000000006004'
    await db.exec(`
      insert into public.recurrences
        (id, user_id, amount, description, interval_count, interval_unit,
         start_date, last_generated_date, status, account_id, currency_code)
      values ('${unseeded}', '${U_A}', 450000, 'Alquiler', 1, 'month',
              '${seedDate}', '${seedDate}', 'active', '${ACCOUNT}', 'ARS');
    `)

    await expect(
      db.exec(`update public.recurrences
                  set reconstruct_from = '${released}' where id = '${unseeded}';`),
    ).rejects.toThrow(/immutable/)
  }, 120_000)
})
