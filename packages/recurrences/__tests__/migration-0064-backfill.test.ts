import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { PGlite } from '@electric-sql/pglite'
import { walkOccurrences, type OccurrenceSchedule } from '@grana/money-logic'
import {
  applyMigration,
  createRecurrenceIdentityDb,
  seedInstance,
  seedRule,
  U_A,
} from './support/recurrence-identity-db'

/**
 * What migration 0064 leaves behind for rules that already existed.
 *
 * The migration does not generate anything — it establishes the two facts the
 * generator will read: `reconstruct_from`, the floor of what may be rebuilt, and
 * the assumed schedule version, which says from when the current calendar is
 * known to have applied. So each case asserts the migration's output first, and
 * then walks the calendar FROM that output to show what the rule is owed.
 *
 * Dates are fixed, never `today`: the only branch that reads the clock is the one
 * for paused rules, and it is exercised on its own.
 */

const TODAY = '2026-09-08'   // the day #96 was reported
const HORIZON = '2025-09-08' // 12 months back

const scheduleOf = (
  db: PGlite,
  ruleId: string,
): Promise<OccurrenceSchedule & { reconstruct_from: string }> =>
  db
    .query<{
      start_date: string
      interval_count: number
      interval_unit: string
      reconstruct_from: string
    }>(
      `select start_date::text, interval_count, interval_unit, reconstruct_from::text
         from public.recurrences where id = '${ruleId}'`,
    )
    .then(({ rows }) => ({
      start_date: rows[0].start_date,
      end_date: null,
      interval_count: rows[0].interval_count,
      interval_unit: rows[0].interval_unit as OccurrenceSchedule['interval_unit'],
      max_occurrences: null,
      reconstruct_from: rows[0].reconstruct_from,
    }))

describe('0064 — the exact #96 case', () => {
  // Every 3 days from 2026-05-02. The cursor stuck at 2026-06-10 IS on that
  // schedule (39 days, 39 % 3 = 0), and the pending occurrence it never advanced
  // past is the 2026-06-13.
  const RULE = '00000000-0000-4000-8000-000000000961'
  const PENDING = '00000000-0000-4000-8000-000000000962'
  let db: PGlite

  beforeAll(async () => {
    db = await createRecurrenceIdentityDb({ applyMigration: false })
    await seedRule(db, {
      id: RULE,
      start_date: '2026-05-02',
      interval_count: 3,
      interval_unit: 'day',
      last_generated_date: '2026-06-10',
    })
    await seedInstance(db, {
      id: PENDING,
      recurrence_id: RULE,
      scheduled_date: '2026-06-13',
      status: 'pending',
    })
    await applyMigration(db)
  })

  afterAll(async () => {
    await db.close()
  })

  it('the floor lands on the cursor, not earlier', async () => {
    // Anything before the cursor the rule already considers covered. Anything
    // after it — which is the whole bug — is owed.
    const { rows } = await db.query<{ reconstruct_from: string }>(
      `select reconstruct_from::text from public.recurrences where id = '${RULE}'`,
    )
    expect(rows[0].reconstruct_from).toBe('2026-06-10')
  })

  it('the unresolved pending occurrence keeps its exact identity', async () => {
    const { rows } = await db.query<{ due_date: string; due_date_is_unknown: boolean }>(
      `select due_date::text, due_date_is_unknown
         from public.recurrence_instances where id = '${PENDING}'`,
    )
    expect(rows[0].due_date).toBe('2026-06-13')
    expect(rows[0].due_date_is_unknown).toBe(false)
  })

  it('the assumed schedule version starts at the floor and is flagged as assumed', async () => {
    const { rows } = await db.query<{
      effective_from: string
      anchor_date: string
      is_assumed: boolean
      n: number
    }>(
      `select effective_from::text, anchor_date::text, is_assumed,
              count(*) over ()::int as n
         from public.recurrence_schedule_versions where recurrence_id = '${RULE}'`,
    )
    expect(rows[0].n).toBe(1)
    expect(rows[0].effective_from).toBe('2026-06-10')
    // The anchor is start_date because that is what the generator clamps against
    // today — it is not a claim that the schedule applied from there.
    expect(rows[0].anchor_date).toBe('2026-05-02')
    expect(rows[0].is_assumed).toBe(true)
  })

  it('walking from that floor owes 29 occurrences, with the pending one deduplicated', async () => {
    const schedule = await scheduleOf(db, RULE)
    const owed = walkOccurrences(schedule, {
      from: HORIZON,
      to: TODAY,
      cursor: schedule.reconstruct_from,
    })

    expect(owed[0]).toBe('2026-06-13')
    expect(owed[owed.length - 1]).toBe(TODAY)
    expect(owed).toHaveLength(30)

    // Per month, which is what makes the number readable: June 6, July 11,
    // August 10, September 3.
    const byMonth = owed.reduce<Record<string, number>>((acc, d) => {
      acc[d.slice(0, 7)] = (acc[d.slice(0, 7)] ?? 0) + 1
      return acc
    }, {})
    expect(byMonth).toEqual({
      '2026-06': 6,
      '2026-07': 11,
      '2026-08': 10,
      '2026-09': 3,
    })

    // The 13/06 already exists as a pending row, so the generator will not create
    // it again: 29 are new. THAT is the bug — before this change the rule was
    // stuck at one pending occurrence and produced none of them.
    const { rows } = await db.query<{ due_date: string }>(
      `select due_date::text from public.recurrence_instances where recurrence_id = '${RULE}'`,
    )
    const existing = new Set(rows.map((r) => r.due_date))
    expect(owed.filter((d) => !existing.has(d))).toHaveLength(29)
  })
})

describe('0064 — a rule whose frequency was edited', () => {
  // There is no history of schedule edits, so the migration must NOT claim the
  // current calendar applied from the beginning: the assumed version starts at
  // the last known point and the walker never looks before it.
  const RULE = '00000000-0000-4000-8000-000000000971'
  let db: PGlite

  beforeAll(async () => {
    db = await createRecurrenceIdentityDb({ applyMigration: false })
    // Started monthly in 2024 and was later edited to every 2 months. The cursor
    // is all we know for certain.
    await seedRule(db, {
      id: RULE,
      start_date: '2024-01-15',
      interval_count: 2,
      interval_unit: 'month',
      last_generated_date: '2026-05-15',
    })
    await applyMigration(db)
  })

  afterAll(async () => {
    await db.close()
  })

  it('the assumed version does not reach back before the cursor', async () => {
    const { rows } = await db.query<{ effective_from: string; is_assumed: boolean }>(
      `select effective_from::text, is_assumed
         from public.recurrence_schedule_versions where recurrence_id = '${RULE}'`,
    )
    expect(rows[0].effective_from).toBe('2026-05-15')
    expect(rows[0].is_assumed).toBe(true)
  })

  it('nothing earlier than effective_from is ever produced', async () => {
    const schedule = await scheduleOf(db, RULE)
    const owed = walkOccurrences(schedule, {
      from: HORIZON,
      to: TODAY,
      cursor: schedule.reconstruct_from,
    })
    // Two years of monthly occurrences would be fabricated backlog: the rule may
    // have run on a different calendar then, and nothing records which.
    expect(owed.every((d) => d > '2026-05-15')).toBe(true)
    expect(owed).toEqual(['2026-07-15'])
  })
})

describe('0064 — the three shapes of a directly created rule', () => {
  let db: PGlite

  beforeAll(async () => {
    db = await createRecurrenceIdentityDb({ applyMigration: false })
    // (a) no cursor, starting today.
    await seedRule(db, { id: ruleId('a'), start_date: TODAY, last_generated_date: null })
    // (b) no cursor, started three months ago and never materialized.
    await seedRule(db, { id: ruleId('b'), start_date: '2026-06-08', last_generated_date: null })
    // (c) born from a movement: the seed already covers start_date.
    await seedRule(db, { id: ruleId('c'), start_date: '2026-06-08', last_generated_date: '2026-06-08' })
    await applyMigration(db)
  })

  afterAll(async () => {
    await db.close()
  })

  function ruleId(k: 'a' | 'b' | 'c') {
    return `00000000-0000-4000-8000-00000000098${{ a: 1, b: 2, c: 3 }[k]}`
  }

  const owedFor = async (k: 'a' | 'b' | 'c') => {
    const schedule = await scheduleOf(db, ruleId(k))
    return {
      floor: schedule.reconstruct_from,
      owed: walkOccurrences(schedule, {
        from: HORIZON,
        to: TODAY,
        cursor: schedule.reconstruct_from,
      }),
    }
  }

  it('(a) no cursor, starting today: the floor is the day before, so today is owed', async () => {
    // `start_date - 1` and not `start_date`: the contract generates STRICTLY
    // after the floor, and the first occurrence of a direct rule falls ON
    // start_date. With a plain start_date the rule would lose its first one.
    const { floor, owed } = await owedFor('a')
    expect(floor).toBe('2026-09-07')
    expect(owed).toEqual([TODAY])
  })

  it('(b) no cursor, started three months ago: start_date is included', async () => {
    const { floor, owed } = await owedFor('b')
    expect(floor).toBe('2026-06-07')
    expect(owed).toEqual(['2026-06-08', '2026-07-08', '2026-08-08', '2026-09-08'])
  })

  it('(c) born from a movement: the seed is not proposed again', async () => {
    const { floor, owed } = await owedFor('c')
    expect(floor).toBe('2026-06-08')
    expect(owed).not.toContain('2026-06-08')
    expect(owed).toEqual(['2026-07-08', '2026-08-08', '2026-09-08'])
  })
})

describe('0064 — identity: a confirmed occurrence does not block the real due date', () => {
  // The trap an earlier version of this migration fell into. Monthly on the
  // 10th. August's occurrence was confirmed LATE, on 10/09, and the old code
  // overwrote `scheduled_date` with the payment date. Copying that into
  // `due_date` would let the August row occupy September's identity, and the
  // unique index would then reject the real 10/09 — reproducing #96 by another
  // route.
  const RULE = '00000000-0000-4000-8000-000000000991'
  const CONFIRMED = '00000000-0000-4000-8000-000000000992'
  let db: PGlite

  beforeAll(async () => {
    db = await createRecurrenceIdentityDb({ applyMigration: false })
    await seedRule(db, {
      id: RULE,
      start_date: '2026-01-10',
      last_generated_date: '2026-08-10',
    })
    await seedInstance(db, {
      id: CONFIRMED,
      recurrence_id: RULE,
      scheduled_date: '2026-09-10', // the PAYMENT date, not the due date
      status: 'confirmed',
    })
    await applyMigration(db)
  })

  afterAll(async () => {
    await db.close()
  })

  it('the historical confirmed row is declared unknown, not approximated', async () => {
    const { rows } = await db.query<{
      due_date: string | null
      due_date_is_unknown: boolean
      scheduled_date: string
      resolution_kind: string
    }>(
      `select due_date::text, due_date_is_unknown, scheduled_date::text, resolution_kind
         from public.recurrence_instances where id = '${CONFIRMED}'`,
    )
    expect(rows[0].due_date).toBeNull()
    expect(rows[0].due_date_is_unknown).toBe(true)
    // The legacy column keeps the only datum there is, without pretending it is
    // a due date.
    expect(rows[0].scheduled_date).toBe('2026-09-10')
    // Until migration C, confirming always created the movement.
    expect(rows[0].resolution_kind).toBe('created')
  })

  it('the real 2026-09-10 due date still materializes', async () => {
    await db.exec(`
      insert into public.recurrence_instances
        (id, recurrence_id, user_id, scheduled_date, status)
      values ('00000000-0000-4000-8000-000000000993', '${RULE}', '${U_A}', '2026-09-10', 'pending');
    `)
    const { rows } = await db.query<{ due_date: string }>(
      `select due_date::text from public.recurrence_instances
        where id = '00000000-0000-4000-8000-000000000993'`,
    )
    expect(rows[0].due_date).toBe('2026-09-10')
  })
})
