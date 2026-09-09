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
  let db: PGlite

  beforeAll(async () => {
    db = await createRecurrenceIdentityDb()
    await actAs(db, U_A)
  })

  /**
   * A fresh rule per case. These tests pause, resume and edit, so sharing one
   * rule would make each assertion depend on what the previous test happened to
   * leave behind — and a count that only holds in file order proves nothing.
   */
  let seq = 0
  const newRule = async (): Promise<string> => {
    const id = `00000000-0000-4000-8000-0000000000${(20 + seq++).toString(16).padStart(2, '0')}`
    await db.exec(`
      insert into public.recurrences (id, user_id, start_date, interval_count, interval_unit, status)
      values ('${id}', '${U_A}', '2026-05-01', 1, 'month', 'active');
    `)
    return id
  }

  /** Read the history as the superuser, then hand the session back to the user. */
  const historyOf = async (ruleId: string) => {
    await actAsAdmin(db)
    const versions = await db.query<{ interval_count: number; effective_from: string }>(
      `select interval_count, effective_from::text from public.recurrence_schedule_versions
        where recurrence_id = '${ruleId}' order by effective_from`,
    )
    const pauses = await db.query<{ paused_from: string; resumed_at: string | null }>(
      `select paused_from::text, resumed_at::text from public.recurrence_pauses
        where recurrence_id = '${ruleId}' order by created_at`,
    )
    await actAs(db, U_A)
    return { versions: versions.rows, pauses: pauses.rows }
  }

  it('SELECT works: the user reads their own history', async () => {
    const rule = await newRule()
    const { rows } = await db.query<{ n: number }>(
      `select count(*)::int as n from public.recurrence_schedule_versions
        where recurrence_id = '${rule}'`,
    )
    expect(rows[0].n).toBe(1)
  })

  it('INSERT into either history table is refused', async () => {
    const rule = await newRule()
    // No write policy at all, so RLS rejects the row outright.
    expect(
      await sqlstateOf(
        db,
        `insert into public.recurrence_schedule_versions
           (recurrence_id, user_id, effective_from, interval_count, interval_unit, anchor_date)
         values ('${rule}', '${U_A}', '2020-01-01', 1, 'month', '2020-01-01')`,
      ),
    ).toBe(RLS_VIOLATION)
    expect(
      await sqlstateOf(
        db,
        `insert into public.recurrence_pauses (recurrence_id, user_id, paused_from)
         values ('${rule}', '${U_A}', '2020-01-01')`,
      ),
    ).toBe(RLS_VIOLATION)
  })

  it('UPDATE and DELETE alter nothing, on BOTH history tables', async () => {
    const rule = await newRule()
    // A pause interval has to exist for the attempt on it to mean anything, and
    // only the database can create one — so it is opened and closed through the
    // rule, which is the only door the user has.
    await db.exec(`update public.recurrences set status = 'paused' where id = '${rule}'`)
    await db.exec(`update public.recurrences set status = 'active' where id = '${rule}'`)
    const before = await historyOf(rule)
    expect(before.versions).toHaveLength(1)
    expect(before.pauses).toHaveLength(1)

    // None of these raise: with no policy, RLS filters every target row away, so
    // the assertion has to be on the DATA and not on an error.
    await db.exec(`
      update public.recurrence_schedule_versions set interval_count = 99 where recurrence_id = '${rule}';
      delete from public.recurrence_schedule_versions where recurrence_id = '${rule}';
      update public.recurrence_pauses set paused_from = '2000-01-01', resumed_at = null
        where recurrence_id = '${rule}';
      delete from public.recurrence_pauses where recurrence_id = '${rule}';
    `)

    const after = await historyOf(rule)
    expect(after.versions).toEqual(before.versions)
    expect(after.pauses).toEqual(before.pauses)
    // Spelled out, because `toEqual` on an empty pair would also pass:
    expect(after.versions[0].interval_count).toBe(1)
    expect(after.pauses[0].paused_from).not.toBe('2000-01-01')
    expect(after.pauses[0].resumed_at).not.toBeNull()
  })

  it('editing the rule still writes a version, above RLS', async () => {
    const rule = await newRule()
    await db.exec(`update public.recurrences set interval_count = 6 where id = '${rule}'`)
    const { versions } = await historyOf(rule)
    expect(versions).toHaveLength(2)
    expect(versions[versions.length - 1].interval_count).toBe(6)
  })

  it('pausing opens an interval and resuming closes it, both as the user', async () => {
    const rule = await newRule()
    await db.exec(`update public.recurrences set status = 'paused' where id = '${rule}'`)
    expect((await historyOf(rule)).pauses).toEqual([
      { paused_from: expect.any(String), resumed_at: null },
    ])

    await db.exec(`update public.recurrences set status = 'active' where id = '${rule}'`)
    const { pauses } = await historyOf(rule)
    expect(pauses).toHaveLength(1)
    expect(pauses[0].resumed_at).not.toBeNull()
  })

  it('a second pause opens a second interval, not a duplicate of the open one', async () => {
    // Self-contained: the whole pause/resume/pause cycle happens here, so the
    // count of 2 does not depend on what any earlier test did.
    const rule = await newRule()
    await db.exec(`
      update public.recurrences set status = 'paused' where id = '${rule}';
      update public.recurrences set status = 'active' where id = '${rule}';
      update public.recurrences set status = 'paused' where id = '${rule}';
    `)
    const { pauses } = await historyOf(rule)
    expect(pauses).toHaveLength(2)
    expect(pauses.filter((p) => p.resumed_at === null)).toHaveLength(1)
  })
})
