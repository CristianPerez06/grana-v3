import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { PGlite } from '@electric-sql/pglite'
import {
  actAs,
  actAsAdmin,
  applyEffectiveUntil,
  createRecurrenceIdentityDb,
  U_A,
} from './support/recurrence-identity-db'

/**
 * Correcting a rule's REFERENCE DATE — its calendar anchor (#121).
 *
 * A rule created from a movement inherits that movement's date, and that date can
 * be off: a salary that landed on the 8th because the 10th was a holiday anchors
 * the rule to the 8th forever. The UI change is one field, but it rests entirely
 * on what `recurrence_sync_schedule_and_pauses` (0064) does when `start_date`
 * changes. That is what these pin — against the shipped SQL, not a description of
 * it — because if the trigger did not behave this way the field would be a way to
 * fabricate history rather than to fix a date.
 */

let db: PGlite

beforeAll(async () => {
  db = await createRecurrenceIdentityDb()
  await applyEffectiveUntil(db)
  await actAs(db, U_A)
})

afterAll(async () => {
  await db.close()
})

let seq = 0
/** A monthly rule anchored on the 8th, started in the past. */
const anchoredOnThe8th = async (status: 'active' | 'paused' = 'active'): Promise<string> => {
  const id = `00000000-0000-4000-8000-00000000a1${(seq++).toString(16).padStart(2, '0')}`
  await actAsAdmin(db)
  await db.exec(`
    insert into public.recurrences (id, user_id, start_date, interval_count, interval_unit, status)
    values ('${id}', '${U_A}', '2026-06-08', 1, 'month', '${status}');
  `)
  await actAs(db, U_A)
  return id
}

/**
 * Moving the anchor, the only way there is: the RPC carries the patch and the
 * date the user chose in one transaction, and the database refuses a bare update.
 * The chosen date comes from the same function the RPC validates against, so the
 * test does not depend on what day of the month it runs.
 */
const moveAnchor = async (ruleId: string, anchor: string, which: 0 | 1 = 0) => {
  const { rows } = await db.query<{ effective_from: string }>(
    `select effective_from::text from public.recurrence_candidate_effective_dates(
       '${anchor}'::date, 1, 'month',
       ((now() at time zone 'America/Argentina/Buenos_Aires')::date))`,
  )
  await db.exec(`
    select public.update_recurrence_schedule('${ruleId}'::uuid,
      jsonb_build_object('start_date', '${anchor}'), '${rows[which].effective_from}'::date);
  `)
  return rows[which].effective_from
}

const versionsOf = async (ruleId: string) => {
  await actAsAdmin(db)
  const { rows } = await db.query<{ effective_from: string; anchor_date: string }>(
    `select effective_from::text, anchor_date::text
       from public.recurrence_schedule_versions
      where recurrence_id = '${ruleId}'
      order by effective_from`,
  )
  await actAs(db, U_A)
  return rows
}

/**
 * Today IN ARGENTINA, which is the only "today" this module has. Asking Postgres
 * for `current_date` returns the container's UTC day, and between 21:00 and
 * midnight in Buenos Aires those are two different dates — a suite that passed
 * all afternoon starts failing at nine at night, for three hours, with an
 * assertion that looks correct.
 */
const today = async (): Promise<string> => {
  const { rows } = await db.query<{ d: string }>(
    `select ((now() at time zone 'America/Argentina/Buenos_Aires')::date)::text as d`,
  )
  return rows[0].d
}

describe('moving the anchor rules from the change forward', () => {
  it('opens a version effective today, anchored on the new date', async () => {
    const rule = await anchoredOnThe8th()
    await moveAnchor(rule, '2026-06-10')

    const versions = await versionsOf(rule)
    const newest = versions[versions.length - 1]
    // `greatest(today, start_date)`: the new schedule starts ruling NOW, not on
    // the date the user typed — which is in the past, and the past is not rewritten.
    expect(newest.effective_from).toBe(await today())
    expect(newest.anchor_date).toBe('2026-06-10')
  })

  it('leaves the old version standing for the stretch it governed', async () => {
    // The whole point of versioning: what the rule owed BEFORE the correction was
    // owed on the 8th, and stays owed on the 8th. Dropping the old version would
    // reinterpret months that already happened.
    const rule = await anchoredOnThe8th()
    await moveAnchor(rule, '2026-06-10')

    const versions = await versionsOf(rule)
    expect(versions.length).toBeGreaterThan(1)
    expect(versions[0].anchor_date).toBe('2026-06-08')
    expect(versions[0].effective_from).toBe('2026-06-08')
  })

  it('does not lower the reconstruction floor', async () => {
    // `reconstruct_from` is what keeps the generator from materializing history
    // nobody asked for. Moving the anchor must not touch it: otherwise correcting
    // a date by two days could fabricate a year of occurrences.
    const rule = await anchoredOnThe8th()
    await actAsAdmin(db)
    const before = await db.query<{ floor: string }>(
      `select reconstruct_from::text as floor from public.recurrences where id = '${rule}'`,
    )
    await actAs(db, U_A)

    await moveAnchor(rule, '2026-06-10')

    await actAsAdmin(db)
    const after = await db.query<{ floor: string }>(
      `select reconstruct_from::text as floor from public.recurrences where id = '${rule}'`,
    )
    await actAs(db, U_A)
    expect(after.rows[0].floor).toBe(before.rows[0].floor)
  })
})

describe('what the correction must not touch', () => {
  it('an unresolved occurrence keeps the due date it already had', async () => {
    // The identity of an occurrence is `(rule, due_date)` and it is immutable.
    // This is the behaviour the form has to WARN about: after moving the anchor
    // to the 10th, the one already sitting on the 8th is still there, and
    // confirming or skipping it stays the user's decision.
    const rule = await anchoredOnThe8th()
    await actAsAdmin(db)
    await db.exec(`
      insert into public.recurrence_instances
        (id, recurrence_id, user_id, scheduled_date, due_date, status)
      values ('00000000-0000-4000-8000-00000000b101', '${rule}', '${U_A}',
              '2026-08-08', '2026-08-08', 'pending');
    `)
    await actAs(db, U_A)

    await moveAnchor(rule, '2026-06-10')

    await actAsAdmin(db)
    const { rows } = await db.query<{ due_date: string; status: string }>(
      `select due_date::text, status from public.recurrence_instances
        where id = '00000000-0000-4000-8000-00000000b101'`,
    )
    await actAs(db, U_A)
    expect(rows[0]).toEqual({ due_date: '2026-08-08', status: 'pending' })
  })

  it('a paused rule can be corrected and stays paused', async () => {
    // A pause stops occurrences from being generated inside its interval; it does
    // not freeze the calendar that will rule when the rule resumes.
    const rule = await anchoredOnThe8th('paused')
    // A paused rule takes no chosen date: its schedule rules from today and waits.
    await db.exec(`
      select public.update_recurrence_schedule('${rule}'::uuid,
        jsonb_build_object('start_date', '2026-06-10'), null);
    `)

    await actAsAdmin(db)
    const { rows } = await db.query<{ status: string; start_date: string }>(
      `select status, start_date::text from public.recurrences where id = '${rule}'`,
    )
    await actAs(db, U_A)
    expect(rows[0]).toEqual({ status: 'paused', start_date: '2026-06-10' })

    const versions = await versionsOf(rule)
    expect(versions[versions.length - 1].anchor_date).toBe('2026-06-10')
  })
})
