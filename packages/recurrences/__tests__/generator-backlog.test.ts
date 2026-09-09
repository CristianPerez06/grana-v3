import type { PGlite } from '@electric-sql/pglite'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { generateDueRecurrenceInstances } from '../src/queries'
import { createRecurrenceIdentityDb, U_A } from './support/recurrence-identity-db'
import { pglitePostgrest } from './support/pglite-postgrest'

/**
 * The generator against a real Postgres, with 0064 applied and
 * `recurrence_instances_one_pending_per_rule` STILL IN PLACE — the state
 * production is in between the expansion and the activation.
 *
 * This is the state the multi-occurrence generator has to survive: a batch
 * insert is one statement, so the first unique violation rejects every row in
 * it. Testing this against a fake client would only prove the rejection we
 * imagined.
 */

const TODAY = '2026-09-08'
const HORIZON_SAFE_START = '2026-05-23'

let db: PGlite

beforeAll(async () => {
  db = await createRecurrenceIdentityDb()
}, 120_000)

afterAll(async () => {
  await db?.close()
})

let ruleSeq = 0

/**
 * A monthly rule due on the 23rd whose floor sits at `reconstructFrom`, with the
 * assumed schedule version and no pause — the shape 0064 leaves behind. Each
 * case gets its own rule so no test depends on another having run.
 */
async function createStuckRule(options: {
  reconstructFrom: string
  startDate?: string
  intervalCount?: number
  intervalUnit?: string
}): Promise<string> {
  ruleSeq += 1
  const start = options.startDate ?? HORIZON_SAFE_START
  const id = `00000000-0000-0000-0000-00000000${String(1000 + ruleSeq)}`
  await db.exec(`
    insert into public.recurrences
      (id, user_id, amount, description, interval_count, interval_unit, start_date, last_generated_date, status)
    values ('${id}', '${U_A}', 2500, 'rule-${ruleSeq}',
            ${options.intervalCount ?? 1}, '${options.intervalUnit ?? 'month'}',
            '${start}', '${options.reconstructFrom}', 'active');
  `)
  // 0064's backfill only covers rows that existed when it ran, so a rule created
  // afterwards gets its floor and its assumed version the same way the dual-write
  // trigger would.
  await db.exec(`
    update public.recurrences set reconstruct_from = '${options.reconstructFrom}' where id = '${id}';
    insert into public.recurrence_schedule_versions
      (recurrence_id, user_id, effective_from, interval_count, interval_unit, anchor_date, is_assumed)
    values ('${id}', '${U_A}', '${options.reconstructFrom}',
            ${options.intervalCount ?? 1}, '${options.intervalUnit ?? 'month'}', '${start}', true)
    on conflict (recurrence_id, effective_from) do nothing;
  `)
  return id
}

async function dueDatesOf(ruleId: string): Promise<string[]> {
  const result = await db.query<{ due_date: string }>(
    `select to_char(due_date, 'YYYY-MM-DD') as due_date from public.recurrence_instances
      where recurrence_id = $1 order by due_date`,
    [ruleId],
  )
  return result.rows.map((row) => row.due_date)
}

describe('generateDueRecurrenceInstances — with the single-pending index still alive', () => {
  it('materializes the current occurrence even though the batch is rejected', async () => {
    // Three occurrences owed, one statement, and 0011's index allows one pending
    // per rule. Without the fallback the run would create NOTHING — the failure
    // mode an earlier note wrongly described as "degraded, not broken".
    const ruleId = await createStuckRule({ reconstructFrom: '2026-05-23' })

    const result = await generateDueRecurrenceInstances(pglitePostgrest(db), U_A, { today: TODAY })

    expect(result.error).toBeNull()
    expect(result.created).toBeGreaterThanOrEqual(1)
    const dates = await dueDatesOf(ruleId)
    expect(dates).toHaveLength(1)
    // The most recent one already due: the occurrence whose absence IS #96.
    expect(dates[0]).toBe('2026-08-23')
  })

  it('reports what is still owed instead of pretending it finished', async () => {
    const ruleId = await createStuckRule({ reconstructFrom: '2026-05-23' })

    const result = await generateDueRecurrenceInstances(pglitePostgrest(db), U_A, { today: TODAY })

    // June and July are still owed on this rule, and the caller has to be able
    // to say so and offer to continue.
    expect(result.remaining).toBeGreaterThan(0)
    expect(await dueDatesOf(ruleId)).toHaveLength(1)
  })

  it('is idempotent: a second run does not duplicate what exists', async () => {
    const ruleId = await createStuckRule({ reconstructFrom: '2026-07-23' })

    await generateDueRecurrenceInstances(pglitePostgrest(db), U_A, { today: TODAY })
    const afterFirst = await dueDatesOf(ruleId)
    await generateDueRecurrenceInstances(pglitePostgrest(db), U_A, { today: TODAY })
    const afterSecond = await dueDatesOf(ruleId)

    expect(afterSecond).toEqual(afterFirst)
  })

  it('does not bring back an occurrence the user already skipped', async () => {
    const ruleId = await createStuckRule({ reconstructFrom: '2026-07-23' })
    await db.exec(`
      insert into public.recurrence_instances
        (recurrence_id, user_id, scheduled_date, due_date, status, resolved_at)
      values ('${ruleId}', '${U_A}', '2026-08-23', '2026-08-23', 'skipped', now());
    `)

    await generateDueRecurrenceInstances(pglitePostgrest(db), U_A, { today: TODAY })

    // Exactly one row for that date, and it is still the skipped one. A cursor
    // would additionally have blocked everything after it; existence does not.
    const rows = await db.query<{ status: string }>(
      `select status from public.recurrence_instances
        where recurrence_id = $1 and due_date = '2026-08-23'`,
      [ruleId],
    )
    expect(rows.rows).toEqual([{ status: 'skipped' }])
  })

  it('owes nothing while the rule is paused', async () => {
    const ruleId = await createStuckRule({ reconstructFrom: '2026-05-23' })
    await db.exec(`
      insert into public.recurrence_pauses (recurrence_id, user_id, paused_from)
      values ('${ruleId}', '${U_A}', '2026-06-01');
    `)

    await generateDueRecurrenceInstances(pglitePostgrest(db), U_A, { today: TODAY })

    expect(await dueDatesOf(ruleId)).toEqual([])
  })

  it('does not fabricate occurrences before a schedule change', async () => {
    const ruleId = await createStuckRule({ reconstructFrom: '2026-05-23' })
    await db.exec(`
      insert into public.recurrence_schedule_versions
        (recurrence_id, user_id, effective_from, interval_count, interval_unit, anchor_date)
      values ('${ruleId}', '${U_A}', '2026-07-01', 2, 'week', '2026-07-01');
    `)

    await generateDueRecurrenceInstances(pglitePostgrest(db), U_A, { today: TODAY })

    // The monthly 2026-07-23 belonged to a schedule that no longer applied by
    // then: it must never be materialized.
    expect(await dueDatesOf(ruleId)).not.toContain('2026-07-23')
  })
})

describe('generateDueRecurrenceInstances — nothing owed', () => {
  it('reports a clean, empty run rather than an error', async () => {
    const emptyDb = await createRecurrenceIdentityDb()
    try {
      const result = await generateDueRecurrenceInstances(pglitePostgrest(emptyDb), U_A, { today: TODAY })
      expect(result).toEqual({ created: 0, remaining: 0, error: null })
    } finally {
      await emptyDb.close()
    }
  }, 120_000)
})

describe('generateDueRecurrenceInstances — a read failure is not an empty state', () => {
  it('reports the error instead of an empty, successful-looking run', async () => {
    // A rule that IS owed occurrences, and a history the run cannot read. The
    // wrong answer here is `{ created: 0, error: null }`, which every surface
    // would draw as "nothing to review" — the same claim as being up to date.
    const brokenDb = await createRecurrenceIdentityDb()
    try {
      await brokenDb.exec(`
        insert into public.recurrences
          (id, user_id, amount, interval_count, interval_unit, start_date, last_generated_date, reconstruct_from, status)
        values ('00000000-0000-0000-0000-0000000009f1', '${U_A}', 2500, 1, 'month',
                '2026-05-23', '2026-05-23', '2026-05-23', 'active');
      `)
      await brokenDb.exec('drop table public.recurrence_pauses cascade;')

      const result = await generateDueRecurrenceInstances(pglitePostgrest(brokenDb), U_A, {
        today: TODAY,
      })

      expect(result.created).toBe(0)
      expect(result.error).not.toBeNull()
    } finally {
      await brokenDb.close()
    }
  }, 120_000)
})
