import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { PGlite } from '@electric-sql/pglite'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { occurrencePositionsSpent, owedOccurrencesForRule } from '@grana/money-logic'
import {
  actAsAdmin,
  applyEffectiveUntil,
  applyPauseLooksForward,
  createRecurrenceIdentityDb,
  U_A,
} from './support/recurrence-identity-db'

/**
 * A PAUSE LOOKS FORWARD: the day it is opened still belongs to the calendar.
 *
 * Found in QA, on the real database. A monthly rule anchored to today with a
 * limit of 3 produced its first cuota — the instance row was there, pending —
 * and the user paused the rule the same day. The progress went from «1 de 3» to
 * «0 de 3»: the pause had swallowed its own opening day.
 *
 * That number is not only what the screens show, it is what CUTS THE GENERATION.
 * At «0 de 3» with one cuota already pending, the rule goes on to produce three
 * more — four instalments in a plan of three.
 *
 * WHAT EVERY TEST HERE HAS TO EARN. The pause that opens and closes on the same
 * day is empty under BOTH readings, so any assertion built on one discriminates
 * nothing — it passes just as happily against the defect. Wherever the point is
 * that a day is or is not skipped, the pause covers a real day, and the calendar
 * is DAILY so that the skipped day is a position the rule would otherwise have
 * produced. A monthly rule never falls due tomorrow, and a test that says
 * "tomorrow is skipped" about one is a test that cannot fail.
 */

const RULE = '00000000-0000-4000-8000-00000000fa01'

let db: PGlite
let today: string

beforeAll(async () => {
  db = await createRecurrenceIdentityDb()
  const { rows } = await db.query<{ d: string }>(
    `select ((now() at time zone 'America/Argentina/Buenos_Aires')::date)::text as d`,
  )
  today = rows[0].d
}, 120_000)

beforeEach(async () => {
  await actAsAdmin(db)
  await db.exec(`delete from public.recurrences where id = '${RULE}';`)
})

afterAll(async () => {
  await db?.close()
})

const shift = (date: string, days: number) => {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/** A rule of the shape each test needs, anchored where it needs. */
async function seedRule(options: {
  start: string
  intervalCount?: number
  intervalUnit?: 'day' | 'week' | 'month' | 'year'
  max?: number | null
}): Promise<void> {
  const { start, intervalCount = 1, intervalUnit = 'month', max = null } = options
  await db.exec(`
    insert into public.recurrences
      (id, user_id, start_date, interval_count, interval_unit, status, amount,
       currency_code, movement_type, max_occurrences)
    values ('${RULE}', '${U_A}', '${start}', ${intervalCount}, '${intervalUnit}', 'active',
            1000, 'ARS', 'expense', ${max == null ? 'null' : max});
  `)
}

/** The occurrence the generator produced on `date`, before anybody paused anything. */
const materialize = (date: string) =>
  db.exec(`
    insert into public.recurrence_instances
      (recurrence_id, user_id, due_date, scheduled_date, status, amount, currency_code)
    values ('${RULE}', '${U_A}', '${date}', '${date}', 'pending', 1000, 'ARS');
  `)

const pause = () =>
  db.exec(`update public.recurrences set status = 'paused' where id = '${RULE}';`)
const resume = () =>
  db.exec(`update public.recurrences set status = 'active' where id = '${RULE}';`)

/** Push the open pause's end out, so it really covers the days in between. */
const resumeDaysLater = (days: number) =>
  db.exec(`
    update public.recurrence_pauses set resumed_at = '${today}'::date + ${days}
     where recurrence_id = '${RULE}';
  `)

/** What the DATABASE says the rule has spent, as of `asOf`. */
async function spentInSql(asOf = today): Promise<number> {
  const { rows } = await db.query<{ n: number }>(
    `select public.recurrence_positions_spent('${RULE}'::uuid, '${asOf}'::date) as n`,
  )
  return rows[0].n
}

/** The rule's schedule versions and pauses, as the walker takes them. */
async function walkerInput() {
  const { rows: versions } = await db.query<{
    effective_from: string
    effective_until: string | null
    interval_count: number
    interval_unit: string
    anchor_date: string
  }>(
    `select effective_from::text, effective_until::text, interval_count,
            interval_unit, anchor_date::text
       from public.recurrence_schedule_versions
      where recurrence_id = '${RULE}' order by effective_from`,
  )
  const { rows: pauses } = await db.query<{ paused_from: string; resumed_at: string | null }>(
    `select paused_from::text, resumed_at::text from public.recurrence_pauses
      where recurrence_id = '${RULE}' order by paused_from`,
  )
  const { rows: rule } = await db.query<{
    end_date: string | null
    max_occurrences: number | null
    seed_occurrence_date: string | null
  }>(
    `select end_date::text, max_occurrences, seed_occurrence_date::text
       from public.recurrences where id = '${RULE}'`,
  )
  return {
    versions: versions.map((v) => ({
      ...v,
      interval_unit: v.interval_unit as 'day' | 'week' | 'month' | 'year',
    })),
    pauses,
    endDate: rule[0].end_date,
    maxOccurrences: rule[0].max_occurrences,
    seedOccurrenceDate: rule[0].seed_occurrence_date,
  }
}

/** What TYPESCRIPT says the rule has spent, from the same rows. */
async function spentInTs(asOf = today): Promise<number> {
  return occurrencePositionsSpent({ ...(await walkerInput()), today: asOf })
}

/** Every date the rule still owes, walked far enough to see its whole life. */
async function owed(asOf: string, existing: string[] = []): Promise<string[]> {
  return owedOccurrencesForRule({
    ...(await walkerInput()),
    reconstructFrom: shift(today, -400),
    horizon: shift(today, -400),
    today: asOf,
    existing,
  })
}

describe('pausing on the day an occurrence falls', () => {
  it('keeps «1 de 3» when today’s cuota is already pending', async () => {
    await seedRule({ start: today, max: 3 })
    await materialize(today)
    expect(await spentInSql()).toBe(1)

    await pause()

    // The row is still there, the money is still committed. Before this change
    // the count said 0 and the plan grew a fourth instalment.
    expect(await spentInSql()).toBe(1)
  })

  it('still owes today’s occurrence when the pause came first', async () => {
    // Paused BEFORE the generator ran: no instance row at all. The day the rule
    // was paused had already begun, so the calendar still owes it — the day
    // belongs to the calendar whether or not the generator got to it.
    await seedRule({ start: today, max: 3 })
    await pause()

    expect(await spentInSql()).toBe(1)
    expect(await owed(today)).toContain(today)
  })

  it('resumed the same day, nothing is skipped', async () => {
    await seedRule({ start: today, max: 3 })
    await materialize(today)
    await pause()
    await resume()

    expect(await spentInSql()).toBe(1)
  })

  it('resumed two days later, ONLY the day in between is skipped', async () => {
    // DAILY, and started before today: every day is a position, so "skipped"
    // and "not skipped" are different observable outcomes. On a monthly rule
    // tomorrow is never a position and the assertion below would pass against
    // the defect too.
    await seedRule({ start: shift(today, -3), intervalUnit: 'day' })
    await pause()
    await resumeDaysLater(2)

    const ahead = await owed(shift(today, 3))

    // Today is the day the pause opened on: it still belongs to the calendar.
    expect(ahead).toContain(today)
    // Tomorrow is strictly inside the pause, and it is the ONLY day removed.
    expect(ahead).not.toContain(shift(today, 1))
    expect(ahead).toContain(shift(today, 2))
    expect(ahead).toContain(shift(today, 3))
  })
})

describe('a plan of three never grows a fourth', () => {
  it('after pausing the day the first cuota fell and resuming two days later', async () => {
    await seedRule({ start: today, max: 3 })
    await materialize(today)
    await pause()
    // TWO DAYS LATER, not the same day. Resumed on the same day the pause is
    // empty under the old reading too, so that version of this test passed
    // against the defect it was written for.
    await resumeDaysLater(2)

    // One materialized plus two owed. Under the old reading the count restarted
    // at zero and this list had THREE, for four instalments in total.
    const ahead = await owed(shift(today, 400), [today])
    expect(ahead).toHaveLength(2)
    expect([today, ...ahead]).toHaveLength(3)
  })
})

/**
 * THE EMPTY-PAUSE GUARD, and why it is not decoration.
 *
 * Moving the pause's start one day forward opened a case that did not exist
 * before: a pause resumed the same day it was opened now has a start AFTER its
 * end. Without a guard, `subtractPauses` splits the segment into a left half
 * ending on the pause's own day and a right half STARTING on it — two halves
 * that overlap on exactly one day, so that day is walked twice.
 */
describe('a pause of zero days removes nothing, and duplicates nothing', () => {
  /**
   * A daily rule anchored FIVE days back, with an empty pause on the third.
   *
   * Both halves of that shape are load-bearing, and the first fixture written
   * for this had neither. The pause has to sit strictly INSIDE the walked
   * stretch — with the pause on today the segment ends before the (shifted)
   * pause starts, so the no-overlap branch takes it and the splitting code is
   * never reached. And the calendar has to begin at least two days before it, or
   * the other no-overlap branch catches it instead.
   *
   * Written directly rather than through the Pausar button, because the trigger
   * can only open a pause today: this is a pause from the rule's past, which is
   * the only place an empty one can sit inside the walk.
   */
  const arrange = async () => {
    await seedRule({ start: shift(today, -5), intervalUnit: 'day' })
    await db.exec(`
      insert into public.recurrence_pauses (recurrence_id, user_id, paused_from, resumed_at)
      values ('${RULE}', '${U_A}', '${shift(today, -3)}'::date, '${shift(today, -3)}'::date);
    `)
  }

  it('counts each day once', async () => {
    await arrange()

    // Six days: the anchor and the five after it, today included. The empty
    // pause removes none of them.
    expect(await spentInTs()).toBe(6)
    expect(await spentInSql()).toBe(6)
  })

  it('and WITHOUT the guard the pause’s own day would be counted twice', async () => {
    await arrange()
    const { pauses } = await walkerInput()

    // The same algorithm as `subtractPauses`, with the guard taken out — the
    // only way to show this fixture discriminates rather than asserting that it
    // does. If the real one ever loses the guard, the number above moves to
    // match this one.
    const segment = { from: shift(today, -5), to: today }
    const withoutGuard: Array<{ from: string; to: string }> = []
    for (const p of pauses) {
      const pauseStart = shift(p.paused_from, 1)
      const pauseEnd = p.resumed_at == null ? null : shift(p.resumed_at, -1)
      if (segment.to < pauseStart || (pauseEnd != null && segment.from > pauseEnd)) {
        withoutGuard.push(segment)
        continue
      }
      if (segment.from < pauseStart) {
        withoutGuard.push({ from: segment.from, to: shift(pauseStart, -1) })
      }
      if (pauseEnd != null && segment.to > pauseEnd) {
        withoutGuard.push({ from: shift(pauseEnd, 1), to: segment.to })
      }
    }

    // Two segments that OVERLAP on the pause's own day: it would be walked, and
    // counted, twice — seven positions where the calendar has six.
    const pausedOn = shift(today, -3)
    expect(withoutGuard).toHaveLength(2)
    expect(withoutGuard[0]).toEqual({ from: shift(today, -5), to: pausedOn })
    expect(withoutGuard[1]).toEqual({ from: pausedOn, to: today })
  })
})

describe('SQL and TypeScript count the same', () => {
  const shapes: Array<{ name: string; arrange: () => Promise<void> }> = [
    {
      name: 'no pause at all',
      arrange: async () => {
        await seedRule({ start: today, max: 3 })
        await materialize(today)
      },
    },
    {
      name: 'paused on the day the occurrence fell',
      arrange: async () => {
        await seedRule({ start: today, max: 3 })
        await materialize(today)
        await pause()
      },
    },
    {
      // The empty pause that sits INSIDE the walked stretch — the one shape
      // where the guard in `subtractPauses` is what keeps TypeScript from
      // counting a day twice. SQL has no such split, so parity here is the
      // guard's own test.
      name: 'an empty pause in the middle of a daily rule',
      arrange: async () => {
        await seedRule({ start: shift(today, -5), intervalUnit: 'day' })
        await db.exec(`
          insert into public.recurrence_pauses (recurrence_id, user_id, paused_from, resumed_at)
          values ('${RULE}', '${U_A}', '${shift(today, -3)}'::date, '${shift(today, -3)}'::date);
        `)
      },
    },
    {
      name: 'paused and resumed two days later, on a daily rule',
      arrange: async () => {
        await seedRule({ start: shift(today, -3), intervalUnit: 'day' })
        await pause()
        await resumeDaysLater(2)
      },
    },
    {
      name: 'paused before the generator ran',
      arrange: async () => {
        await seedRule({ start: today, max: 3 })
        await pause()
      },
    },
  ]

  for (const shape of shapes) {
    it(`agree with ${shape.name}`, async () => {
      await shape.arrange()

      // One character separates the two implementations — `>` against `>=` —
      // and nothing on any screen would say which one is being read.
      expect(await spentInTs()).toBe(await spentInSql())
    })
  }
})

describe('the old behaviour, so the fix is not mistaken for a no-op', () => {
  it('a database WITHOUT 0071 loses the position', async () => {
    // Everything up to 0070 and no further: the pause still swallows its own
    // opening day, which is the state this migration repairs.
    const legacy = await createRecurrenceIdentityDb({ scheduleGap: false })
    try {
      const { rows } = await legacy.query<{ d: string }>(
        `select ((now() at time zone 'America/Argentina/Buenos_Aires')::date)::text as d`,
      )
      const t = rows[0].d
      await legacy.exec(`
        insert into public.recurrences
          (id, user_id, start_date, interval_count, interval_unit, status, amount,
           currency_code, movement_type, max_occurrences)
        values ('${RULE}', '${U_A}', '${t}', 1, 'month', 'active', 1000, 'ARS', 'expense', 3);
        insert into public.recurrence_instances
          (recurrence_id, user_id, due_date, scheduled_date, status, amount, currency_code)
        values ('${RULE}', '${U_A}', '${t}', '${t}', 'pending', 1000, 'ARS');
      `)
      // 0068 brings the schedule versions and the old counting function.
      await applyEffectiveUntil(legacy)
      await legacy.exec(`update public.recurrences set status = 'paused' where id = '${RULE}';`)

      const before = await legacy.query<{ n: number }>(
        `select public.recurrence_positions_spent('${RULE}'::uuid, '${t}'::date) as n`,
      )
      expect(before.rows[0].n).toBe(0)

      // And the migration repairs it, on the same database, without touching a
      // single row of data.
      await applyPauseLooksForward(legacy)
      const after = await legacy.query<{ n: number }>(
        `select public.recurrence_positions_spent('${RULE}'::uuid, '${t}'::date) as n`,
      )
      expect(after.rows[0].n).toBe(1)
    } finally {
      await legacy.close()
    }
  }, 60_000)
})

/**
 * The section of `validate_schema.sql` that pins this predicate, LIFTED AND RUN.
 *
 * One character decides it, and no screen distinguishes the two readings. A
 * validator nobody executes is a validator that drifts.
 */
describe('validate_schema.sql 8.1N', () => {
  function contractOfValidateSchema(): string {
    const sql = readFileSync(
      resolve(__dirname, '../../../supabase/validate_schema.sql'),
      'utf-8',
    )
    const open = sql.indexOf('-- ┌── BEGIN 8.1N CONTRACT')
    const close = sql.indexOf('-- └── END 8.1N CONTRACT')
    if (open < 0 || close < 0) throw new Error('8.1N moved: update this extraction')
    return `do $$\ndeclare\n  v_body text;\nbegin\n${sql.slice(open, close)}end $$;`
  }

  it('passes against the schema 0071 produces', async () => {
    await expect(db.exec(contractOfValidateSchema())).resolves.toBeDefined()
  })

  it('REFUSES a database that still subtracts the pause inclusively', async () => {
    // Everything up to 0070: the old predicate is exactly what 8.1N must catch.
    const legacy = await createRecurrenceIdentityDb({ scheduleGap: false })
    try {
      await applyEffectiveUntil(legacy)

      await expect(legacy.exec(contractOfValidateSchema())).rejects.toThrow(
        /INCLUSIVE of its opening day/,
      )
    } finally {
      await legacy.close()
    }
  }, 60_000)
})

/**
 * 0071 REPLACES ONE FUNCTION, and the file says so. An earlier draft extracted
 * the body from 0068 with a cut that swept up `recurrence_positions_before` and
 * its three grants as well — identical to what was already deployed, so nothing
 * would have broken, and a migration that re-creates objects it never mentions
 * is a migration nobody can review by reading it.
 */
describe('0071’s scope, read off the file', () => {
  const file = () =>
    readFileSync(
      resolve(__dirname, '../../../supabase/migrations/0071_pause_looks_forward.sql'),
      'utf-8',
    )

  it('creates exactly one function, and drops none', () => {
    const sql = file()
    const created = sql.match(/^create or replace function /gm) ?? []

    expect(created).toHaveLength(1)
    expect(sql).toContain('create or replace function public.recurrence_positions_spent(')
    expect(sql).not.toMatch(/^drop function/m)
    expect(sql).not.toContain('recurrence_positions_before')
  })

  it('touches privileges only for the function it replaces', () => {
    const sql = file()
    const privileges = sql.match(/^(revoke|grant) .*$/gm) ?? []

    expect(privileges).toHaveLength(3)
    for (const line of privileges) {
      expect(line).toContain('recurrence_positions_spent(uuid, date)')
    }
  })
})
