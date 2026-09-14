import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { PGlite } from '@electric-sql/pglite'
import { SCHEDULE_NEVER_RULES } from '@grana/money-logic'
import {
  MIGRATION_0068,
  actAs,
  actAsAdmin,
  applyEffectiveUntil,
  createRecurrenceIdentityDb,
  sqlstateOf,
  U_A,
} from './support/recurrence-identity-db'

/**
 * 0068 — moving an anchor has to say from when (#121).
 *
 * The calendar consequences live in `@grana/money-logic`, injected with a fixed
 * `today`. What is pinned HERE is the half only the database can guarantee: that
 * the effective date is required, that it is recorded, and that the outgoing
 * version is closed so two schedules never overlap and the gap between them
 * belongs to nobody.
 */

let db: PGlite

beforeAll(async () => {
  db = await createRecurrenceIdentityDb()
})

afterAll(async () => {
  await db.close()
})

const today = async (): Promise<string> => {
  const { rows } = await db.query<{ d: string }>(
    `select ((now() at time zone 'America/Argentina/Buenos_Aires')::date)::text as d`,
  )
  return rows[0].d
}

const shift = (date: string, days: number): string => {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

let seq = 0
/** A monthly rule that started a while back, as the superuser. */
const seedRule = async (): Promise<string> => {
  const id = `00000000-0000-4000-8000-00000000c1${(seq++).toString(16).padStart(2, '0')}`
  await actAsAdmin(db)
  await db.exec(`
    insert into public.recurrences (id, user_id, start_date, interval_count, interval_unit, status)
    values ('${id}', '${U_A}', '2026-06-08', 1, 'month', 'active');
  `)
  await actAs(db, U_A)
  return id
}

const versionsOf = async (ruleId: string) => {
  await actAsAdmin(db)
  const { rows } = await db.query<{
    effective_from: string
    effective_until: string | null
    anchor_date: string
  }>(
    `select effective_from::text, effective_until::text, anchor_date::text
       from public.recurrence_schedule_versions
      where recurrence_id = '${ruleId}' order by effective_from`,
  )
  await actAs(db, U_A)
  return rows
}

const floorOf = async (ruleId: string): Promise<string | null> => {
  await actAsAdmin(db)
  const { rows } = await db.query<{ f: string | null }>(
    `select schedule_effective_from::text as f from public.recurrences where id = '${ruleId}'`,
  )
  await actAs(db, U_A)
  return rows[0].f
}

/**
 * The two dates the user would be offered, asked to the same function the RPC
 * validates against. The tests take their dates from HERE and not from the
 * calendar of the day they run: an anchor written by hand only lines up with
 * today by luck, and a suite that depends on today's day of the month is a suite
 * that breaks tomorrow.
 */
const candidatesFor = async (anchor: string): Promise<[string, string]> => {
  const { rows } = await db.query<{ effective_from: string }>(
    `select effective_from::text from public.recurrence_candidate_effective_dates(
       '${anchor}'::date, 1, 'month', ((now() at time zone 'America/Argentina/Buenos_Aires')::date))`,
  )
  return [rows[0].effective_from, rows[1].effective_from]
}

const correctAnchor = (ruleId: string, anchor: string, effectiveFrom: string) =>
  db.exec(`
    select public.update_recurrence_schedule(
      '${ruleId}'::uuid,
      jsonb_build_object('start_date', '${anchor}'),
      '${effectiveFrom}'::date
    );
  `)

describe('the effective date is required, not inferred', () => {
  it('rejects a bare update of the anchor', async () => {
    // The bug this migration exists for: an anchor that moves on its own terms.
    const rule = await seedRule()
    const state = await sqlstateOf(
      db,
      `update public.recurrences set start_date = '2026-06-10' where id = '${rule}'`,
    )
    expect(state).toBe('23514')
  })

  it('rejects a date the schedule never produces', async () => {
    // The client draws the question; the database recomputes the answer. A date
    // that got through unchecked would open a version on a day off the calendar,
    // and every occurrence after it would land on the wrong phase.
    const rule = await seedRule()
    const [immediate] = await candidatesFor('2026-06-10')
    const state = await sqlstateOf(
      db,
      `select public.update_recurrence_schedule('${rule}'::uuid,
         jsonb_build_object('start_date', '2026-06-10'), '${shift(immediate, 1)}'::date)`,
    )
    expect(state).toBe('23514')
  })

  it('rejects an effective date in the past', async () => {
    const rule = await seedRule()
    const yesterday = shift(await today(), -1)
    const state = await sqlstateOf(
      db,
      `select public.update_recurrence_schedule('${rule}'::uuid,
         jsonb_build_object('start_date', '2026-06-10'), '${yesterday}'::date)`,
    )
    expect(state).toBe('23514')
  })

  it('lets a frequency-only change through, as it always did', async () => {
    // Nothing is ambiguous there: the anchor does not move, so no cycle can be
    // served twice. Requiring an answer would be friction for a question nobody
    // asked.
    const rule = await seedRule()
    await expect(
      db.exec(`update public.recurrences set interval_count = 2 where id = '${rule}'`),
    ).resolves.toBeDefined()
  })
})

describe('the outgoing version is closed so the two never overlap', () => {
  it('closes it yesterday when the new one starts today', async () => {
    // Anchored on today's own day of the month, so the FIRST candidate is today.
    const now = await today()
    const anchor = `2026-06-${now.slice(8)}`
    const rule = await seedRule()
    const [immediate] = await candidatesFor(anchor)
    expect(immediate).toBe(now)

    await correctAnchor(rule, anchor, immediate)

    const versions = await versionsOf(rule)
    expect(versions[0].effective_until).toBe(shift(now, -1))
    expect(versions[versions.length - 1].effective_from).toBe(now)
    expect(versions[versions.length - 1].effective_until).toBeNull()
  })

  it('closes it today when the new one starts later, leaving the gap empty', async () => {
    const rule = await seedRule()
    const now = await today()
    const [, later] = await candidatesFor('2026-06-10')
    await correctAnchor(rule, '2026-06-10', later)

    const versions = await versionsOf(rule)
    // Inclusive: the old schedule may still produce TODAY, and then stops. The
    // stretch up to `later` is described by nobody.
    expect(versions[0].effective_until).toBe(now)
    expect(versions[versions.length - 1].effective_from).toBe(later)
  })

  it('does not rewrite the end of a version that was already closed', async () => {
    // A rule that has been corrected before (or paused, or had its frequency
    // changed) carries versions already shut. Closing EVERY version that began
    // before today — rather than the one in force — pushes their ends forward to
    // today: the stretch a previous edit had shut reopens, two versions rule the
    // same days, and the walker hands back the dates that edit had excluded.
    const rule = await seedRule()
    const now = await today()
    await actAsAdmin(db)
    await db.exec(`
      update public.recurrence_schedule_versions
         set effective_until = '2026-07-31'
       where recurrence_id = '${rule}';
      insert into public.recurrence_schedule_versions
        (recurrence_id, user_id, effective_from, interval_count, interval_unit, anchor_date, is_assumed)
      values
        ('${rule}', '${U_A}', '2026-08-01', 1, 'month', '2026-06-08', false);
    `)
    await actAs(db, U_A)

    const [, later] = await candidatesFor('2026-06-10')
    await correctAnchor(rule, '2026-06-10', later)

    const versions = await versionsOf(rule)
    expect(versions).toHaveLength(3)
    // Untouched: it describes a stretch that already happened.
    expect(versions[0].effective_until).toBe('2026-07-31')
    // The one in force is the one being replaced.
    expect(versions[1].effective_until).toBe(now)
    expect(versions[2].effective_from).toBe(later)
  })

  it('records the floor on the rule, for the reads that do not know about versions', async () => {
    const rule = await seedRule()
    const [, later] = await candidatesFor('2026-06-10')
    await correctAnchor(rule, '2026-06-10', later)
    expect(await floorOf(rule)).toBe(later)
  })
})

describe('the fail-closed floor, on both sides of the wire', () => {
  it('is the same value in the migration and in the code that honours it', async () => {
    // A sentinel known to one side only is not a sentinel. The column's default
    // is what a row lands on; `SCHEDULE_NEVER_RULES` is what the readers check
    // for. If they drift, a bypassed trigger stops suppressing and starts
    // announcing vencimientos from the year the default happens to name.
    await actAsAdmin(db)
    const { rows } = await db.query<{ d: string }>(
      `select pg_get_expr(d.adbin, d.adrelid) as d
         from pg_attrdef d
         join pg_attribute a on a.attrelid = d.adrelid and a.attnum = d.adnum
        where d.adrelid = 'public.recurrences'::regclass
          and a.attname = 'schedule_effective_from'`,
    )
    await actAs(db, U_A)
    expect(rows[0].d).toContain(SCHEDULE_NEVER_RULES)
  })
})

describe('the shape of the data', () => {
  it('refuses a version that ends before it starts', async () => {
    const rule = await seedRule()
    await actAsAdmin(db)
    const state = await sqlstateOf(
      db,
      `update public.recurrence_schedule_versions
          set effective_until = effective_from - 1
        where recurrence_id = '${rule}'`,
    )
    await actAs(db, U_A)
    expect(state).toBe('23514')
  })

  it('keeps the anonymous role out of the RPC', async () => {
    // 0067's lesson, applied at birth instead of two years later.
    await actAsAdmin(db)
    const { rows } = await db.query<{ anon: boolean; auth: boolean }>(
      `select has_function_privilege('anon', 'public.update_recurrence_schedule(uuid, jsonb, date)', 'EXECUTE') as anon,
              has_function_privilege('authenticated', 'public.update_recurrence_schedule(uuid, jsonb, date)', 'EXECUTE') as auth`,
    )
    await actAs(db, U_A)
    expect(rows[0]).toEqual({ anon: false, auth: true })
  })
})

describe('the deployment window', () => {
  /**
   * `0068` is applied BEFORE the code that uses it, so for a while the live
   * client is the old one: it never sends `start_date` on an update, and it must
   * keep editing everything else exactly as it did. A migration that made the
   * deployed app start failing would be a migration that has to be applied at
   * the same second as a deploy, and there is no such second.
   */
  it('the client of today keeps editing what it always edited', async () => {
    const rule = await seedRule()
    await expect(
      db.exec(`
        update public.recurrences
           set amount = 4200, description = 'editada por el cliente viejo',
               end_date = '2027-01-01', interval_count = 2
         where id = '${rule}'
      `),
    ).resolves.toBeDefined()

    const versions = await versionsOf(rule)
    // A frequency-only change keeps ruling from today, as it always did.
    expect(versions[versions.length - 1].effective_from).toBe(await today())
    expect(await floorOf(rule)).toBe(await today())
  })

  it('ignores a floor a client tries to set by hand', async () => {
    // The column decides which occurrences exist. A client that could move it
    // could make its own backlog appear or vanish.
    const rule = await seedRule()
    const before = await floorOf(rule)
    await db.exec(
      `update public.recurrences set schedule_effective_from = '2020-01-01' where id = '${rule}'`,
    )
    expect(await floorOf(rule)).toBe(before)
  })
})

describe('the edges where there is nothing to choose between', () => {
  it('a paused rule takes no chosen date, and stays paused', async () => {
    // Both candidates would fall inside the pause: offering them as "the first
    // occurrence" is a promise the calendar will not keep. The corrected schedule
    // rules from today and waits.
    const rule = await seedRule()
    await actAsAdmin(db)
    await db.exec(`update public.recurrences set status = 'paused' where id = '${rule}'`)
    await actAs(db, U_A)

    const now = await today()
    await db.exec(`
      select public.update_recurrence_schedule('${rule}'::uuid,
        jsonb_build_object('start_date', '2026-06-10'), null);
    `)

    expect(await floorOf(rule)).toBe(now)
    await actAsAdmin(db)
    const { rows } = await db.query<{ status: string }>(
      `select status from public.recurrences where id = '${rule}'`,
    )
    await actAs(db, U_A)
    expect(rows[0].status).toBe('paused')
  })

  it('refuses a chosen date for a paused rule', async () => {
    const rule = await seedRule()
    await actAsAdmin(db)
    await db.exec(`update public.recurrences set status = 'paused' where id = '${rule}'`)
    await actAs(db, U_A)
    const [immediate] = await candidatesFor('2026-06-10')
    const state = await sqlstateOf(
      db,
      `select public.update_recurrence_schedule('${rule}'::uuid,
         jsonb_build_object('start_date', '2026-06-10'), '${immediate}'::date)`,
    )
    expect(state).toBe('23514')
  })

  it('offers nothing when the cap is already spent', async () => {
    // `max_occurrences` reached: the rule has no next occurrence, so there is no
    // date that could be "the first with the new reference".
    const rule = await seedRule()
    await actAsAdmin(db)
    await db.exec(`update public.recurrences set max_occurrences = 1 where id = '${rule}'`)
    await db.exec(`
      insert into public.recurrence_instances
        (id, recurrence_id, user_id, scheduled_date, due_date, status)
      values ('00000000-0000-4000-8000-00000000d101', '${rule}', '${U_A}',
              '2026-06-08', '2026-06-08', 'pending');
    `)
    await actAs(db, U_A)

    const [immediate] = await candidatesFor('2026-06-10')
    const state = await sqlstateOf(
      db,
      `select public.update_recurrence_schedule('${rule}'::uuid,
         jsonb_build_object('start_date', '2026-06-10'), '${immediate}'::date)`,
    )
    expect(state).toBe('23514')
  })

  it('offers nothing past end_date', async () => {
    const { rows } = await db.query<{ n: number }>(
      `select count(*)::int as n from public.recurrence_candidate_effective_dates(
         '2026-06-10'::date, 1, 'month',
         ((now() at time zone 'America/Argentina/Buenos_Aires')::date),
         '2020-01-01'::date, null)`,
    )
    expect(rows[0].n).toBe(0)
  })
})

describe('a database whose model drifted', () => {
  it('aborts the migration naming the rule instead of guessing a floor', async () => {
    // No version describes the schedule the rule has: the two halves of the model
    // disagree. Picking the newest version would freeze a false floor into a
    // column every read trusts.
    const drifted = await createRecurrenceIdentityDb({ scheduleGap: false })
    try {
      await drifted.exec(`
        insert into public.recurrences (id, user_id, start_date, interval_count, interval_unit, status)
        values ('00000000-0000-4000-8000-00000000e901', '${U_A}', '2026-06-08', 1, 'month', 'active');
        update public.recurrence_schedule_versions
           set anchor_date = '2020-01-01'
         where recurrence_id = '00000000-0000-4000-8000-00000000e901';
      `)
      await expect(applyEffectiveUntil(drifted)).rejects.toThrow(/the model drifted/)
    } finally {
      await drifted.close()
    }
    // The exception to this suite's 5s `testTimeout`, and the reason is in the
    // config: the default holds because the database is built in the HOOK, so a
    // long BODY is a hang. These two build a SECOND database inside the body —
    // they are about what a DIFFERENT schema does — so seconds here are the
    // Postgres starting up, not a hang.
  }, 60_000)
})

/**
 * The section of `validate_schema.sql` that pins this migration, LIFTED AND RUN.
 * A validator nobody executes is a validator that drifts: 8.1J's check was wrong
 * twice before anyone noticed, in opposite directions.
 */
function scheduleGapBranchOfValidateSchema(): string {
  const sql = readFileSync(
    resolve(__dirname, '../../../supabase/validate_schema.sql'),
    'utf-8',
  )
  const start = sql.indexOf('-- ── 8.1K · a schedule version can stop before the next one starts (0068) ───')
  if (start < 0) throw new Error('the 8.1K section moved: update this extraction')
  const from = sql.indexOf('do $$', start)
  const end = sql.indexOf('end $$;', from)
  return sql.slice(from, end + 'end $$;'.length)
}

describe('0068 is one transaction', () => {
  it('leaves NOTHING behind when it fails on its last statement', async () => {
    // It used to be five. A failure in the third left the first two applied, and
    // the database sat in a shape no version of the app is written against: the
    // columns installed, the triggers that maintain them missing. Nobody would
    // see it until a write went wrong.
    //
    // The failure is injected at the END on purpose — an abort in the first
    // section rolls back under either shape and would prove nothing.
    const db2 = await createRecurrenceIdentityDb({ scheduleGap: false })
    try {
      const sabotaged = MIGRATION_0068.replace(
        /\ncommit;\s*$/,
        "\ndo $sabotage$ begin raise exception 'sabotage'; end $sabotage$;\ncommit;\n",
      )
      expect(sabotaged).toContain('sabotage')
      await expect(db2.exec(sabotaged)).rejects.toThrow(/sabotage/)
      await db2.exec('rollback;').catch(() => undefined)

      // The very first thing the migration does, and it is gone.
      const { rows } = await db2.query<{ n: number }>(
        `select count(*)::int as n from information_schema.columns
          where table_schema = 'public'
            and (table_name, column_name) in (
              ('recurrence_schedule_versions', 'effective_until'),
              ('recurrences', 'schedule_effective_from'),
              ('recurrences', 'seed_occurrence_date'),
              ('recurrences', 'schedule_positions_before'))`,
      )
      expect(rows[0].n).toBe(0)
    } finally {
      await db2.close()
    }
  }, 60_000)

  it('says so in the file, with one begin and one commit', () => {
    // The structural half. A section added later with its own `commit;` would
    // reopen the window without failing anything above.
    expect(MIGRATION_0068.match(/^begin;$/gm)).toHaveLength(1)
    expect(MIGRATION_0068.match(/^commit;$/gm)).toHaveLength(1)
  })
})

describe('validate_schema.sql · 8.1K', () => {
  it('passes against a database that has 0068', async () => {
    await actAsAdmin(db)
    await expect(db.exec(scheduleGapBranchOfValidateSchema())).resolves.toBeDefined()
    await actAs(db, U_A)
  })

  // The three shapes a homonym can take while still being "a trigger of that
  // name": wired to half the events, or enabled only for replicas. Each one
  // leaves the writes the app actually makes unguarded, and each one passed the
  // gate when it asked only for name, function, timing and level.
  const CANONICAL_TRIGGER = `
    drop trigger if exists trg_recurrence_resolve_schedule_effective_from on public.recurrences;
    create trigger trg_recurrence_resolve_schedule_effective_from
      before insert or update on public.recurrences
      for each row
      execute function public.recurrence_resolve_schedule_effective_from();
  `

  const rewire = async (sql: string) => {
    await actAsAdmin(db)
    await db.exec(sql)
    try {
      await expect(db.exec(scheduleGapBranchOfValidateSchema())).rejects.toThrow(
        /trg_recurrence_resolve_schedule_effective_from/,
      )
    } finally {
      await db.exec('rollback;').catch(() => undefined)
      await db.exec(CANONICAL_TRIGGER)
      await actAs(db, U_A)
    }
  }

  it('REFUSES a homonym wired to INSERT only', async () => {
    // Moving an anchor is an UPDATE — the whole feature — so this one guards
    // nothing that matters and reads as present.
    await rewire(`
      drop trigger trg_recurrence_resolve_schedule_effective_from on public.recurrences;
      create trigger trg_recurrence_resolve_schedule_effective_from
        before insert on public.recurrences
        for each row
        execute function public.recurrence_resolve_schedule_effective_from();
    `)
  })

  it('REFUSES a homonym wired to UPDATE only', async () => {
    // And this one lets every rule start life with a floor the client chose.
    await rewire(`
      drop trigger trg_recurrence_resolve_schedule_effective_from on public.recurrences;
      create trigger trg_recurrence_resolve_schedule_effective_from
        before update on public.recurrences
        for each row
        execute function public.recurrence_resolve_schedule_effective_from();
    `)
  })

  it('REFUSES a trigger enabled only for replicas', async () => {
    // `tgenabled` is 'R': not disabled, and it never fires for an origin write.
    // A gate asking `<> 'D'` waves it through.
    await rewire(`
      alter table public.recurrences
        enable replica trigger trg_recurrence_resolve_schedule_effective_from;
    `)
  })

  it('REFUSES a database that does not', async () => {
    // The state this exists to catch: the code deployed and the migration not,
    // where an anchor moves with an implicit effective date again.
    const bare = await createRecurrenceIdentityDb({ scheduleGap: false })
    try {
      await expect(db_exec_on(bare)).rejects.toThrow(/0068 was not applied/)
    } finally {
      await bare.close()
    }
  }, 60_000)
})

const db_exec_on = (target: PGlite) => target.exec(scheduleGapBranchOfValidateSchema())
