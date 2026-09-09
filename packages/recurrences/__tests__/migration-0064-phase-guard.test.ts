import { describe, expect, it } from 'vitest'
import {
  applyMigration,
  createRecurrenceIdentityDb,
  seedRule,
  U_A,
} from './support/recurrence-identity-db'

/**
 * Section 4b of 0064: the migration re-checks, in its own transaction, that
 * reading each rule off the calendar gives the SAME next occurrence the rule
 * produces today.
 *
 * The cursor-phase audit answers this against production, but its answer is a
 * snapshot — between running it and applying the migration one edit is enough to
 * create a drifted rule. So the guard has to hold at the moment of the write,
 * and it has to hold for the invariant the audit actually measured
 * (`con_proxima_distinta`), not a weaker one.
 */

const drifted = async (
  rules: Array<Parameters<typeof seedRule>[1]>,
): Promise<{ ok: true } | { ok: false; message: string }> => {
  const db = await createRecurrenceIdentityDb({ applyMigration: false })
  for (const rule of rules) await seedRule(db, rule)
  try {
    await applyMigration(db)
    return { ok: true }
  } catch (error) {
    return { ok: false, message: (error as Error).message }
  }
}

const RULE = '00000000-0000-4000-8000-00000000b001'

/**
 * Every case here builds its own Postgres in the test BODY, not in a hook: each
 * seeds a different pre-migration state and then applies 0064 on top, so a shared
 * database would not answer the question. That puts them under `testTimeout`,
 * whose 5s default is not enough for a WASM Postgres boot when the whole monorepo
 * suite is competing for CPU — measured, it failed there while passing alone.
 *
 * So the time is given to these cases and to nothing else. The package's
 * `testTimeout` stays at its default: raising it globally would buy this file a
 * margin at the cost of hiding a genuine hang in every other one.
 */
const BOOTS_POSTGRES = 30_000

describe('0064 §4b — the migration aborts on a rule whose calendar disagrees with it', () => {
  it('applies cleanly when every rule reads the same on both', async () => {
    const result = await drifted([
      // Cursor ON schedule: monthly on the 10th, cursor on a 10th.
      { id: RULE, start_date: '2026-01-10', last_generated_date: '2026-08-10' },
      // Every 3 days, cursor 39 days out — 39 % 3 = 0.
      {
        id: '00000000-0000-4000-8000-00000000b002',
        start_date: '2026-05-02',
        interval_count: 3,
        interval_unit: 'day',
        last_generated_date: '2026-06-10',
      },
      // No cursor at all: the first occurrence falls ON start_date.
      {
        id: '00000000-0000-4000-8000-00000000b003',
        start_date: '2026-01-15',
        last_generated_date: null,
      },
    ])
    expect(result.ok).toBe(true)
  }, BOOTS_POSTGRES)

  it('THE CASE THE WEAKER CHECK MISSED: the next date is on the schedule and still wrong', async () => {
    // Monthly on the 10th, cursor 2026-02-05. `addInterval` gives 2026-03-10 —
    // on the schedule, with an ordinal — while the calendar's next occurrence
    // after that cursor is 2026-02-10. A month of difference in what the user
    // would be shown, which a check for "is it on the schedule" waves through.
    const result = await drifted([
      { id: RULE, start_date: '2026-01-10', last_generated_date: '2026-02-05' },
    ])
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.message).toContain('today 2026-03-10 vs calendar 2026-02-10')
  }, BOOTS_POSTGRES)

  it('aborts for a drifted rule of every unit, naming each one', async () => {
    const result = await drifted([
      // Phase: every 2 months from the 1st, cursor on a 10th.
      {
        id: '00000000-0000-4000-8000-00000000b011',
        start_date: '2026-01-01',
        interval_count: 2,
        interval_unit: 'month',
        last_generated_date: '2026-02-10',
      },
      // Phase: a yearly rule whose cursor landed in another month.
      {
        id: '00000000-0000-4000-8000-00000000b012',
        start_date: '2026-01-01',
        interval_count: 1,
        interval_unit: 'year',
        last_generated_date: '2026-06-10',
      },
      // Phase: every 3 days, cursor 40 days out — 40 % 3 = 1.
      {
        id: '00000000-0000-4000-8000-00000000b013',
        start_date: '2026-05-01',
        interval_count: 3,
        interval_unit: 'day',
        last_generated_date: '2026-06-10',
      },
      // A moved start: the cursor now sits BEFORE the rule begins. Reaches even
      // a monthly rule of interval 1, which phase alone could never drift.
      {
        id: '00000000-0000-4000-8000-00000000b014',
        start_date: '2026-06-15',
        interval_count: 1,
        interval_unit: 'month',
        last_generated_date: '2026-01-10',
      },
    ])
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.message).toContain('4 rule(s)')
    for (const suffix of ['b011', 'b012', 'b013', 'b014']) {
      expect(result.message).toContain(`00000000-0000-4000-8000-00000000${suffix}`)
    }
    // And it points at the column of the audit that measures the same thing, so
    // whoever hits this knows which number to go re-read.
    expect(result.message).toContain('con_proxima_distinta')
  }, BOOTS_POSTGRES)

  it('the abort rolls the WHOLE migration back, not just the versions', async () => {
    const db = await createRecurrenceIdentityDb({ applyMigration: false })
    await seedRule(db, {
      id: RULE,
      start_date: '2026-01-01',
      interval_count: 2,
      interval_unit: 'month',
      last_generated_date: '2026-02-10',
    })
    await expect(applyMigration(db)).rejects.toThrow()

    // Everything 0064 does lives in one transaction, so a rule that was fine
    // does not come out half-migrated either.
    const { rows } = await db.query<{ n: number }>(`
      select count(*)::int as n from information_schema.columns
       where table_schema = 'public' and table_name = 'recurrences'
         and column_name = 'reconstruct_from'
    `)
    expect(rows[0].n).toBe(0)

    const tables = await db.query<{ n: number }>(`
      select count(*)::int as n from information_schema.tables
       where table_schema = 'public'
         and table_name in ('recurrence_schedule_versions', 'recurrence_pauses')
    `)
    expect(tables.rows[0].n).toBe(0)
  }, BOOTS_POSTGRES)

  it('a rule with no cursor is never flagged: it has no phase to lose', async () => {
    const result = await drifted([
      { id: RULE, start_date: '2026-06-15', last_generated_date: null },
      { id: '00000000-0000-4000-8000-00000000b021', start_date: '2020-01-31', last_generated_date: null },
    ])
    expect(result.ok).toBe(true)
    expect(U_A).toBeTruthy()
  }, BOOTS_POSTGRES)
})
