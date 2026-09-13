import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { PGlite } from '@electric-sql/pglite'
import { describe, expect, it } from 'vitest'
import {
  actAs,
  actAsAdmin,
  applyEffectiveUntil,
  applySeedRepair,
  createRecurrenceIdentityDb,
  U_A,
} from './support/recurrence-identity-db'

/**
 * 0069 — the seed occurrence, repaired where 0068 guessed it (#121).
 *
 * 0068 backfilled `seed_occurrence_date` from `start_date`, saying that a seeded
 * rule could not have moved its anchor before it ran. `updateRecurrence` has
 * accepted `start_date` all along, so that was never true, and on the real
 * database one rule had moved: the backfill recorded the CORRECTED anchor as the
 * occurrence its movement covers.
 *
 * The history is built here the way it actually happened — rule created from a
 * movement, anchor corrected while 0068 did not yet exist, THEN 0068 — because
 * that order is the whole defect. A fixture that applied 0068 first would record
 * the right value and prove nothing.
 */

const RULE = '00000000-0000-4000-8000-00000000d001'
const TX = '00000000-0000-4000-8000-00000000d002'
const SEED_DATE = '2026-07-08'
const CORRECTED = '2026-07-10'

/** A seeded rule whose anchor is corrected BEFORE 0068 exists. */
async function driftedDatabase(): Promise<PGlite> {
  const db = await createRecurrenceIdentityDb({ scheduleGap: false })
  await db.exec(`
    insert into public.transactions (id, user_id, date, amount)
    values ('${TX}', '${U_A}', '${SEED_DATE}', 1000);
    insert into public.recurrences
      (id, user_id, start_date, interval_count, interval_unit, status, amount, currency_code,
       movement_type, last_generated_date, created_from_transaction_id)
    values ('${RULE}', '${U_A}', '${SEED_DATE}', 1, 'month', 'active', 1000, 'ARS', 'expense',
            '${SEED_DATE}', '${TX}');
  `)
  // The correction, through the only door that existed then: a plain update.
  // 0064's sync trigger opens a second version for the new anchor, which is what
  // leaves the first one as the record of where the rule began.
  await db.exec(`
    update public.recurrences set start_date = '${CORRECTED}' where id = '${RULE}';
  `)
  return db
}

const rule = async (db: PGlite) => {
  const { rows } = await db.query<{
    start_date: string
    seed_occurrence_date: string | null
    schedule_positions_before: number
  }>(
    `select start_date::text, seed_occurrence_date::text, schedule_positions_before
       from public.recurrences where id = '${RULE}'`,
  )
  return rows[0]
}

const anchors = async (db: PGlite) => {
  const { rows } = await db.query<{ anchor_date: string }>(
    `select anchor_date::text from public.recurrence_schedule_versions
      where recurrence_id = '${RULE}' order by effective_from, id`,
  )
  return rows.map((r) => r.anchor_date)
}

/** The 8.1L branch of `validate_schema.sql`, cut out the way 8.1K's test does. */
function seedIdentityBranchOfValidateSchema(): string {
  const file = readFileSync(
    resolve(__dirname, '../../../supabase/validate_schema.sql'),
    'utf-8',
  )
  const start = file.indexOf('-- ── 8.1L ·')
  const end = file.indexOf('end $$;', start) + 'end $$;'.length
  if (start < 0 || end < start) throw new Error('8.1L not found in validate_schema.sql')
  return file.slice(start, end)
}

describe('validate_schema.sql · 8.1L', () => {
  // It REPORTS; it does not assert. The state 0069 repairs and the state a rule
  // corrected before it started leaves behind are the same columns with the old
  // value on the other side, so a validator that failed on one would fail on the
  // other. Both cases below therefore pass — what 8.1L gives an operator is the
  // list, not a verdict.
  it('does not fail on a database where 0069 is still pending', async () => {
    const db = await driftedDatabase()
    try {
      await applyEffectiveUntil(db)
      await expect(db.exec(seedIdentityBranchOfValidateSchema())).resolves.toBeDefined()
    } finally {
      await db.close()
    }
  }, 120_000)

  it('does not fail once it is applied either', async () => {
    const db = await driftedDatabase()
    try {
      await applyEffectiveUntil(db)
      await applySeedRepair(db)
      await expect(db.exec(seedIdentityBranchOfValidateSchema())).resolves.toBeDefined()
    } finally {
      await db.close()
    }
  }, 120_000)
})

describe('a seeded rule whose anchor moved before 0068 ran', () => {
  it('is recorded wrong by 0068, and put right by 0069', async () => {
    const db = await driftedDatabase()
    try {
      // The rule begins on the 8th and is corrected to the 10th, so its first
      // version still says the 8th. That version is the record 0069 reads.
      expect(await anchors(db)).toEqual([SEED_DATE, CORRECTED])

      await applyEffectiveUntil(db)
      const afterBackfill = await rule(db)
      // THE DEFECT: the corrected anchor, recorded as the occurrence the
      // movement covers. The movement covers the 8th.
      expect(afterBackfill.start_date).toBe(CORRECTED)
      expect(afterBackfill.seed_occurrence_date).toBe(CORRECTED)

      await applySeedRepair(db)
      const repaired = await rule(db)
      expect(repaired.seed_occurrence_date).toBe(SEED_DATE)
      // And the anchor is left alone: 0069 repairs the identity, not the rule.
      expect(repaired.start_date).toBe(CORRECTED)
      // The offset is recomputed from the repaired seed, not left stale.
      const { rows } = await db.query<{ n: number }>(
        `select public.recurrence_positions_before(
           r.id, r.schedule_effective_from, r.start_date, r.interval_count,
           r.interval_unit, r.seed_occurrence_date, r.max_occurrences, r.end_date) as n
           from public.recurrences r where r.id = '${RULE}'`,
      )
      expect(repaired.schedule_positions_before).toBe(Number(rows[0].n))
      expect(repaired.schedule_positions_before).not.toBe(afterBackfill.schedule_positions_before)
    } finally {
      await db.close()
    }
  }, 120_000)

  it('leaves the triggers it had to switch off back on', async () => {
    // `seed_occurrence_date` is immutable and the resolver copies the offset back
    // from OLD; 0069 turns both off for one transaction. Leaving either off would
    // hand the next writer a table with no guards and nothing to say so.
    const db = await driftedDatabase()
    try {
      await applyEffectiveUntil(db)
      await applySeedRepair(db)
      const { rows } = await db.query<{ tgname: string; tgenabled: string }>(
        `select tgname, tgenabled from pg_trigger
          where tgrelid = 'public.recurrences'::regclass and not tgisinternal
          order by tgname`,
      )
      expect(rows.every((r) => ['O', 'A'].includes(r.tgenabled))).toBe(true)

      // And the guard really is guarding again.
      await expect(
        db.exec(`update public.recurrences set seed_occurrence_date = '2020-01-01' where id = '${RULE}';`),
      ).rejects.toThrow(/seed_occurrence_date is immutable/)
    } finally {
      await db.close()
    }
  }, 120_000)

  it('does nothing to a rule whose seed already agrees with its first anchor', async () => {
    // The ten rules that looked broken only because the MOVEMENT had been
    // re-dated. `transactions.date` is editable; the occurrence identity is not
    // read from it, and 0069 must not touch them.
    const db = await createRecurrenceIdentityDb({ scheduleGap: false })
    try {
      await db.exec(`
        insert into public.transactions (id, user_id, date, amount)
        values ('${TX}', '${U_A}', '2026-07-08', 1000);
        insert into public.recurrences
          (id, user_id, start_date, interval_count, interval_unit, status, amount, currency_code,
           movement_type, last_generated_date, created_from_transaction_id)
        values ('${RULE}', '${U_A}', '2026-07-08', 1, 'month', 'active', 1000, 'ARS', 'expense',
                '2026-07-08', '${TX}');
      `)
      await applyEffectiveUntil(db)
      // The movement is re-dated afterwards, as a user may do at any time.
      await db.exec(`update public.transactions set date = '2026-06-05' where id = '${TX}';`)
      const before = await rule(db)

      await applySeedRepair(db)
      expect(await rule(db)).toEqual(before)
    } finally {
      await db.close()
    }
  }, 120_000)
})

/**
 * THE SAME EQUALITY, ON A RULE THAT HAD NOT STARTED YET — where it is FALSE.
 *
 * 0068's sync trigger deletes the schedule versions that have not come into
 * effect yet (`effective_from > today`) before opening the corrected one. A rule
 * seeded by a FUTURE movement has exactly one such version: the one its own
 * insert created. Correct its anchor before it starts and that version — the
 * record of where the rule began — is gone; the earliest one left carries the
 * NEW anchor.
 *
 * `seed_occurrence_date` is right throughout: the movement still covers the date
 * it was dated on, and the guard keeps anyone from moving it. So this is a
 * database in perfect order where the seed and the first surviving anchor
 * DISAGREE — which is why that disagreement cannot be an invariant.
 */
const FUTURE_RULE = '00000000-0000-4000-8000-00000000d003'
const FUTURE_TX = '00000000-0000-4000-8000-00000000d004'
/**
 * Relative to the database's own clock, never a literal: a fixture that hardcodes
 * "the future" stops testing the future on the day it arrives, and this case only
 * exists while `effective_from > today`.
 */
const AR_TODAY = `(now() at time zone 'America/Argentina/Buenos_Aires')::date`

async function correctedBeforeItStarts(): Promise<PGlite> {
  const db = await createRecurrenceIdentityDb()
  await db.exec(`
    insert into public.transactions (id, user_id, date, amount)
    values ('${FUTURE_TX}', '${U_A}', ${AR_TODAY} + 60, 1000);
    insert into public.recurrences
      (id, user_id, start_date, interval_count, interval_unit, status, amount, currency_code,
       movement_type, created_from_transaction_id)
    values ('${FUTURE_RULE}', '${U_A}', ${AR_TODAY} + 60, 1, 'month', 'active', 1000, 'ARS',
            'expense', '${FUTURE_TX}');
  `)
  // Through the real door. The corrected schedule's first occurrence on or after
  // today IS the new anchor, since the rule has not started — so that is the
  // effective date the drawer offers and the RPC accepts.
  await actAs(db, U_A)
  await db.exec(`
    select public.update_recurrence_schedule(
      '${FUTURE_RULE}',
      jsonb_build_object('start_date', (${AR_TODAY} + 62)::text),
      ${AR_TODAY} + 62
    );
  `)
  await actAsAdmin(db)
  return db
}

describe('a seeded rule corrected before it starts', () => {
  it('loses its first version to the sync trigger, keeping the right seed', async () => {
    const db = await correctedBeforeItStarts()
    try {
      const { rows } = await db.query<{
        seed: string
        first_anchor: string
        versions: number
      }>(
        `select r.seed_occurrence_date::text as seed,
                (select v.anchor_date::text from public.recurrence_schedule_versions v
                  where v.recurrence_id = r.id order by v.effective_from, v.id limit 1) as first_anchor,
                (select count(*)::int from public.recurrence_schedule_versions v
                  where v.recurrence_id = r.id) as versions
           from public.recurrences r where r.id = '${FUTURE_RULE}'`,
      )
      // ONE version, not two: the original was deleted, not closed.
      expect(rows[0].versions).toBe(1)
      // And the two dates disagree — legitimately.
      expect(rows[0].seed).not.toBe(rows[0].first_anchor)
    } finally {
      await db.close()
    }
  }, 120_000)

  it('passes 8.1L, which is why 8.1L cannot assert the equality', async () => {
    const db = await correctedBeforeItStarts()
    try {
      await expect(db.exec(seedIdentityBranchOfValidateSchema())).resolves.toBeDefined()
    } finally {
      await db.close()
    }
  }, 120_000)

  it('would be rewritten by 0069 — which is the bound of a one-time repair', async () => {
    // NOT an approval of that write: 0069's criterion reads the earliest
    // surviving version, and on this rule that version is the corrected one, so
    // the repair would overwrite a seed that was never wrong.
    //
    // It is pinned because it is the reason 0069 is a one-time migration and not
    // a rule: what makes it safe is not the criterion, it is the audit of the
    // database it runs against — caso real reportado en #96, where exactly one
    // rule disagreed and no rule of this shape existed. Anyone reaching for the
    // same query on another database has to redo that audit first.
    const db = await correctedBeforeItStarts()
    try {
      const seed = async () =>
        (
          await db.query<{ seed: string }>(
            `select seed_occurrence_date::text as seed from public.recurrences where id = '${FUTURE_RULE}'`,
          )
        ).rows[0].seed
      const before = await seed()
      await applySeedRepair(db)
      expect(await seed()).not.toBe(before)
    } finally {
      await db.close()
    }
  }, 120_000)
})
