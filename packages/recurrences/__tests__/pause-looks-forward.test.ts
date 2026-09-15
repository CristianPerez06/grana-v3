import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { PGlite } from '@electric-sql/pglite'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { occurrencePositionsSpent, owedOccurrencesForRule } from '@grana/money-logic'
import {
  actAs,
  actAsAdmin,
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
 * A date carries no time of day, so the calendar cannot tell whether the pause
 * came before or after that day's occurrence. The rule settles it in the one
 * direction that cannot destroy a commitment already made.
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
  // Monthly, anchored to today, three instalments.
  await db.exec(`
    insert into public.recurrences
      (id, user_id, start_date, interval_count, interval_unit, status, amount,
       currency_code, movement_type, max_occurrences)
    values ('${RULE}', '${U_A}', '${today}', 1, 'month', 'active', 1000, 'ARS', 'expense', 3);
  `)
})

afterAll(async () => {
  await db?.close()
})

/** What the DATABASE says the rule has spent. */
async function spentInSql(): Promise<number> {
  const { rows } = await db.query<{ n: number }>(
    `select public.recurrence_positions_spent('${RULE}'::uuid, '${today}'::date) as n`,
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
async function spentInTs(): Promise<number> {
  const input = await walkerInput()
  return occurrencePositionsSpent({ ...input, today })
}

const pause = () =>
  db.exec(`update public.recurrences set status = 'paused' where id = '${RULE}';`)
const resume = () =>
  db.exec(`update public.recurrences set status = 'active' where id = '${RULE}';`)

/** The occurrence the generator produced today, before anybody paused anything. */
const materializeToday = () =>
  db.exec(`
    insert into public.recurrence_instances
      (recurrence_id, user_id, due_date, scheduled_date, status, amount, currency_code)
    values ('${RULE}', '${U_A}', '${today}', '${today}', 'pending', 1000, 'ARS');
  `)

const shift = (date: string, days: number) => {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

describe('pausing on the day an occurrence falls', () => {
  it('keeps «1 de 3» when today’s cuota is already pending', async () => {
    await materializeToday()
    expect(await spentInSql()).toBe(1)

    await pause()

    // The row is still there, the money is still committed. Before this change
    // the count said 0 and the plan grew a fourth instalment.
    expect(await spentInSql()).toBe(1)
  })

  it('still owes today’s occurrence when the pause came first', async () => {
    // Paused BEFORE the generator ran: no instance row at all. The day the rule
    // was paused had already begun, so the calendar still owes it.
    await pause()

    expect(await spentInSql()).toBe(1)

    const input = await walkerInput()
    const owed = owedOccurrencesForRule({
      ...input,
      reconstructFrom: shift(today, -400),
      horizon: shift(today, -400),
      today,
      existing: [],
    })
    expect(owed).toContain(today)
  })

  it('resumed the same day, nothing is skipped', async () => {
    await materializeToday()
    await pause()
    await resume()

    expect(await spentInSql()).toBe(1)
  })

  it('resumed two days later, ONLY the day in between is skipped', async () => {
    await materializeToday()
    await pause()
    // Resumed the day after tomorrow, so the pause really covers a day.
    await db.exec(`
      update public.recurrence_pauses
         set resumed_at = '${today}'::date + 2
       where recurrence_id = '${RULE}';
    `)

    // Today still counts — it is the day the pause opened on.
    expect(await spentInSql()).toBe(1)

    const input = await walkerInput()
    const owed = owedOccurrencesForRule({
      ...input,
      reconstructFrom: shift(today, -400),
      horizon: shift(today, -400),
      today: shift(today, 3),
      existing: [],
    })
    // The only day removed is the one strictly inside the pause.
    expect(owed).toContain(today)
    expect(owed).not.toContain(shift(today, 1))
  })
})

describe('a plan of three never grows a fourth', () => {
  it('after pausing the day the first cuota fell', async () => {
    await materializeToday()
    await pause()
    await resume()

    const input = await walkerInput()
    // A year ahead: every position the rule could ever produce.
    const owed = owedOccurrencesForRule({
      ...input,
      reconstructFrom: shift(today, -400),
      horizon: shift(today, -400),
      today: shift(today, 400),
      existing: [today],
    })

    // One materialized plus two owed. Before the change the count restarted at
    // zero and this list had THREE, for four instalments in total.
    expect(owed).toHaveLength(2)
    expect([today, ...owed]).toHaveLength(3)
  })
})

describe('SQL and TypeScript count the same', () => {
  const shapes: Array<{ name: string; arrange: () => Promise<void> }> = [
    { name: 'no pause at all', arrange: async () => { await materializeToday() } },
    {
      name: 'paused on the day the occurrence fell',
      arrange: async () => {
        await materializeToday()
        await pause()
      },
    },
    {
      name: 'paused and resumed the same day',
      arrange: async () => {
        await materializeToday()
        await pause()
        await resume()
      },
    },
    {
      name: 'paused and resumed two days later',
      arrange: async () => {
        await materializeToday()
        await pause()
        await db.exec(`
          update public.recurrence_pauses set resumed_at = '${today}'::date + 2
           where recurrence_id = '${RULE}';
        `)
      },
    },
    {
      name: 'paused before the generator ran',
      arrange: async () => { await pause() },
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
      const { applyEffectiveUntil } = await import('./support/recurrence-identity-db')
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
      const { applyEffectiveUntil } = await import('./support/recurrence-identity-db')
      await applyEffectiveUntil(legacy)

      await expect(legacy.exec(contractOfValidateSchema())).rejects.toThrow(
        /INCLUSIVE of its opening day/,
      )
    } finally {
      await legacy.close()
    }
  }, 60_000)
})
