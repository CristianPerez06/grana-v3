import { beforeAll, describe, expect, it } from 'vitest'
import type { PGlite } from '@electric-sql/pglite'
import {
  actAs,
  actAsAdmin,
  createRecurrenceIdentityDb,
  sqlstateOf,
  U_A,
} from './support/recurrence-identity-db'

/**
 * The transition, which is where an expand/activate pair actually breaks.
 *
 * Between 0064 and the activation the app keeps writing with the OLD model, so
 * the new history has to be maintained by the database for rules that are
 * created or edited in the meantime — and it has to be maintained CORRECTLY, for
 * writes the migration's own backfill never saw. Both cases here were verified by
 * hand while building the migration and were not pinned by any test.
 */

const RLS_VIOLATION = '42501'

describe('a rule that starts in the future, edited before it starts', () => {
  // Without the delete of not-yet-effective versions, this rule resurrects its
  // old schedule on its own start day:
  //
  //   2026-09-08  created with start 2026-10-01  ⇒ version effective 2026-10-01
  //   2026-09-08  frequency edited               ⇒ version effective 2026-09-08
  //   2026-10-01  arrives                        ⇒ the 10-01 one is newest again
  //                                                and restores the OLD schedule.
  const RULE = '00000000-0000-4000-8000-0000000000f1'
  let db: PGlite

  beforeAll(async () => {
    db = await createRecurrenceIdentityDb()
    await actAs(db, U_A)
    await db.exec(`
      insert into public.recurrences (id, user_id, start_date, interval_count, interval_unit, status)
      values ('${RULE}', '${U_A}', '2099-10-01', 1, 'month', 'active');
    `)
  })

  it('starts with one version, effective from its own start date', async () => {
    await actAsAdmin(db)
    const { rows } = await db.query<{ effective_from: string; interval_count: number }>(
      `select effective_from::text, interval_count
         from public.recurrence_schedule_versions where recurrence_id = '${RULE}'`,
    )
    await actAs(db, U_A)
    expect(rows).toHaveLength(1)
    expect(rows[0].effective_from).toBe('2099-10-01')
    expect(rows[0].interval_count).toBe(1)
  })

  it('editing only the frequency updates that version in place', async () => {
    // The start date does not move, so `GREATEST(today, start_date)` lands on the
    // SAME effective_from and the upsert resolves it. This path never reaches the
    // delete — the next case is the one that does.
    await db.exec(
      `update public.recurrences set interval_count = 3 where id = '${RULE}'`,
    )
    await actAsAdmin(db)
    const { rows } = await db.query<{ effective_from: string; interval_count: number }>(
      `select effective_from::text, interval_count
         from public.recurrence_schedule_versions
        where recurrence_id = '${RULE}' order by effective_from`,
    )
    await actAs(db, U_A)

    expect(rows).toHaveLength(1)
    expect(rows[0].interval_count).toBe(3)
    // A version cannot apply before the rule exists: GREATEST(today, start_date).
    expect(rows[0].effective_from).toBe('2099-10-01')
  })

  it('pulling the start date back does NOT leave the future version behind', async () => {
    // THE case the delete exists for, and the one the comment in 0064 describes:
    // the edit now lands on a DIFFERENT effective_from (today), so without
    // deleting the not-yet-effective version the rule would carry two — and on
    // 2099-10-01 the older one becomes the most recent again and restores the
    // schedule the user edited away.
    await db.exec(
      `update public.recurrences
          set start_date = '2026-01-01', interval_count = 6
        where id = '${RULE}'`,
    )
    await actAsAdmin(db)
    const { rows } = await db.query<{ effective_from: string; interval_count: number }>(
      `select effective_from::text, interval_count
         from public.recurrence_schedule_versions
        where recurrence_id = '${RULE}' order by effective_from`,
    )
    await actAs(db, U_A)

    expect(rows).toHaveLength(1)
    expect(rows[0].interval_count).toBe(6)
    // Asserted as an absence rather than against today's date, so the test does
    // not rot: what must not exist is the version dated in the future.
    expect(rows.some((r) => r.effective_from === '2099-10-01')).toBe(false)
  })
})

describe('the history is read-only for the user and maintained by the database', () => {
  const RULE = '00000000-0000-4000-8000-0000000000f2'
  let db: PGlite

  beforeAll(async () => {
    db = await createRecurrenceIdentityDb()
    await actAs(db, U_A)
    await db.exec(`
      insert into public.recurrences (id, user_id, start_date, interval_count, interval_unit, status)
      values ('${RULE}', '${U_A}', '2026-05-01', 1, 'month', 'active');
    `)
  })

  const countVersions = async () => {
    const { rows } = await db.query<{ n: number }>(
      `select count(*)::int as n from public.recurrence_schedule_versions where recurrence_id = '${RULE}'`,
    )
    return rows[0].n
  }

  it('SELECT works: the user reads their own history', async () => {
    expect(await countVersions()).toBe(1)
    const { rows } = await db.query<{ n: number }>(
      `select count(*)::int as n from public.recurrence_pauses`,
    )
    expect(rows[0].n).toBe(0)
  })

  it('INSERT into either history table is refused', async () => {
    // No write policy at all, so RLS rejects the row outright.
    expect(
      await sqlstateOf(
        db,
        `insert into public.recurrence_schedule_versions
           (recurrence_id, user_id, effective_from, interval_count, interval_unit, anchor_date)
         values ('${RULE}', '${U_A}', '2020-01-01', 1, 'month', '2020-01-01')`,
      ),
    ).toBe(RLS_VIOLATION)
    expect(
      await sqlstateOf(
        db,
        `insert into public.recurrence_pauses (recurrence_id, user_id, paused_from)
         values ('${RULE}', '${U_A}', '2020-01-01')`,
      ),
    ).toBe(RLS_VIOLATION)
  })

  it('UPDATE and DELETE alter nothing: with no policy, no row is even visible to them', async () => {
    // These do not raise — RLS filters the target rows away — so the assertion
    // has to be on the DATA, not on an error.
    await db.exec(
      `update public.recurrence_schedule_versions set interval_count = 99 where recurrence_id = '${RULE}';
       delete from public.recurrence_schedule_versions where recurrence_id = '${RULE}';`,
    )
    await actAsAdmin(db)
    const { rows } = await db.query<{ n: number; interval_count: number }>(
      `select count(*)::int as n, min(interval_count) as interval_count
         from public.recurrence_schedule_versions where recurrence_id = '${RULE}'`,
    )
    await actAs(db, U_A)
    expect(rows[0].n).toBe(1)
    expect(rows[0].interval_count).toBe(1)
  })

  it('editing the rule still writes a version, above RLS', async () => {
    await db.exec(`update public.recurrences set interval_count = 6 where id = '${RULE}'`)
    await actAsAdmin(db)
    const { rows } = await db.query<{ interval_count: number }>(
      `select interval_count from public.recurrence_schedule_versions
        where recurrence_id = '${RULE}' order by effective_from desc limit 1`,
    )
    await actAs(db, U_A)
    expect(rows[0].interval_count).toBe(6)
    expect(await countVersions()).toBe(2)
  })

  it('pausing opens an interval and resuming closes it, both as the user', async () => {
    await db.exec(`update public.recurrences set status = 'paused' where id = '${RULE}'`)
    const open = await db.query<{ n: number }>(
      `select count(*)::int as n from public.recurrence_pauses
        where recurrence_id = '${RULE}' and resumed_at is null`,
    )
    expect(open.rows[0].n).toBe(1)

    await db.exec(`update public.recurrences set status = 'active' where id = '${RULE}'`)
    const closed = await db.query<{ n: number }>(
      `select count(*)::int as n from public.recurrence_pauses
        where recurrence_id = '${RULE}' and resumed_at is not null`,
    )
    expect(closed.rows[0].n).toBe(1)
  })

  it('a second pause opens a second interval, not a duplicate of the open one', async () => {
    await db.exec(`update public.recurrences set status = 'paused' where id = '${RULE}'`)
    const { rows } = await db.query<{ n: number; open: number }>(
      `select count(*)::int as n,
              count(*) filter (where resumed_at is null)::int as open
         from public.recurrence_pauses where recurrence_id = '${RULE}'`,
    )
    expect(rows[0].n).toBe(2)
    expect(rows[0].open).toBe(1)
  })
})
