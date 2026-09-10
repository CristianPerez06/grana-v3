import type { PGlite } from '@electric-sql/pglite'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { generateDueRecurrenceInstances } from '../src/queries'
import {
  applyActivation,
  createRecurrenceIdentityDb,
  U_A,
} from './support/recurrence-identity-db'
import { pglitePostgrest } from './support/pglite-postgrest'

/**
 * THE CASE THAT IS #96, and the only test that can hold it.
 *
 * `reconstruction-batch.test.ts` seeds rules with NOTHING materialized, so it
 * exercises starvation between rules but not the reported bug: a rule already
 * holding one unreviewed occurrence, which the single-pending index turns into a
 * permanent stop. Before the activation those rules cannot receive a row at all,
 * so a test could only assert that nothing breaks — never that they get served.
 *
 * The shape here is production's, at the size production has: 61 rules, each
 * with an old unresolved occurrence sitting in the way and its current one
 * missing. The generator caps a run at 50 rows, so two runs are what it takes,
 * and "two runs" is also what proves the `blocked` tier of
 * `selectReconstructionBatch` stops costing anything once the constraint is
 * gone — while the index lived, those rules were served last on purpose because
 * writing to them could not succeed.
 *
 * The activation is applied FROM THE SHIPPED FILE, not with a hand-written
 * `drop index`: the migration refuses to run unless the new model is in place,
 * and dropping the index by hand would prove the generator works in a state the
 * migration would never have produced.
 */

const TODAY = '2026-09-08'
const RULES = 61

let db: PGlite

beforeAll(async () => {
  db = await createRecurrenceIdentityDb()

  // 61 monthly rules due on the 23rd, each already holding ONE unresolved
  // occurrence from June — the vencimiento the user never reviewed. Their floor
  // sits before it, so July and August are owed and August is the current one.
  const ids = Array.from(
    { length: RULES },
    (_, index) => `00000000-0000-0000-0000-0000000${String(70000 + index)}`,
  )

  for (const id of ids) {
    await db.exec(`
      insert into public.recurrences
        (id, user_id, amount, description, interval_count, interval_unit,
         start_date, last_generated_date, status)
      values ('${id}', '${U_A}', 2500, 'rule-${id.slice(-5)}', 1, 'month',
              '2026-05-23', '2026-05-23', 'active');
      insert into public.recurrence_instances
        (recurrence_id, user_id, scheduled_date, due_date, status)
      values ('${id}', '${U_A}', '2026-06-23', '2026-06-23', 'pending');
    `)
  }
}, 180_000)

afterAll(async () => {
  await db?.close()
})

const client = () => pglitePostgrest(db)

async function dueDatesByRule(): Promise<Map<string, string[]>> {
  const { rows } = await db.query<{ recurrence_id: string; due_date: string }>(
    `select recurrence_id::text,
            to_char(due_date, 'YYYY-MM-DD') as due_date
       from public.recurrence_instances
      order by recurrence_id, due_date`,
  )
  const byRule = new Map<string, string[]>()
  for (const row of rows) {
    const list = byRule.get(row.recurrence_id)
    if (list == null) byRule.set(row.recurrence_id, [row.due_date])
    else list.push(row.due_date)
  }
  return byRule
}

describe('61 stuck rules, before and after the activation', () => {
  // ONE test, not four. This is a SEQUENCE — the same database walked from the
  // transition into the activation — and splitting it into separate `it`s made
  // the later ones silently depend on an earlier one having run: on their own
  // they never saw the activation at all. A staged single case says out loud
  // that the order is the subject, and `it.only` on it still reproduces the
  // whole story.
  it('walks from stuck to fully materialized, and only the activation moves it', async () => {
    // ── Stage 1 · while the index lives ────────────────────────────────────
    // The bug, at production's size. Not one of the 61 gets its current
    // vencimiento, however many times the generator runs — the row it would
    // have to write is the one the index forbids.
    const stuckFirst = await generateDueRecurrenceInstances(client(), U_A, { today: TODAY })
    const stuckSecond = await generateDueRecurrenceInstances(client(), U_A, { today: TODAY })

    // No error: the run degrades on the compatibility violation rather than
    // reporting a failure it cannot do anything about.
    expect(stuckFirst.error).toBeNull()
    expect(stuckSecond.error).toBeNull()
    expect(stuckFirst.created + stuckSecond.created).toBe(0)

    let byRule = await dueDatesByRule()
    expect(byRule.size).toBe(RULES)
    for (const [ruleId, dates] of byRule) {
      expect({ ruleId, dates }).toEqual({ ruleId, dates: ['2026-06-23'] })
    }

    // And it says so instead of looking finished.
    expect(stuckSecond.remaining).toBeGreaterThan(0)

    // ── Stage 2 · the activation, and two runs ─────────────────────────────
    await applyActivation(db)

    const first = await generateDueRecurrenceInstances(client(), U_A, { today: TODAY })
    const second = await generateDueRecurrenceInstances(client(), U_A, { today: TODAY })
    expect(first.error).toBeNull()
    expect(second.error).toBeNull()

    byRule = await dueDatesByRule()
    expect(byRule.size).toBe(RULES)

    // THE ASSERTION THIS FILE EXISTS FOR: not one rule left behind. A batch that
    // served the same rules twice would leave the rest exactly as they were —
    // which is what starvation looks like from the outside.
    const withoutCurrent = [...byRule.entries()]
      .filter(([, dates]) => !dates.includes('2026-08-23'))
      .map(([ruleId]) => ruleId)
    expect(withoutCurrent).toEqual([])

    // The occurrence nobody reviewed is still there, untouched: materializing
    // the backlog resolves nothing on its own.
    for (const dates of byRule.values()) expect(dates).toContain('2026-06-23')

    // ── Stage 3 · the older backlog, without duplicating anything ──────────
    // 61 rules × one missing July each, and a run caps at 50: the leftovers
    // have to come out of the next run, not be forgotten.
    await generateDueRecurrenceInstances(client(), U_A, { today: TODAY })
    const final = await generateDueRecurrenceInstances(client(), U_A, { today: TODAY })

    byRule = await dueDatesByRule()
    for (const [ruleId, dates] of byRule) {
      expect({ ruleId, dates }).toEqual({
        ruleId,
        dates: ['2026-06-23', '2026-07-23', '2026-08-23'],
      })
    }

    // Nothing owed and nothing written: the reconstruction is over.
    expect(final.remaining).toBe(0)

    // ── Stage 4 · what 0011 made impossible ────────────────────────────────
    const { rows } = await db.query<{ n: number }>(
      `select count(*)::int as n
         from public.recurrence_instances
        where status = 'pending'
        group by recurrence_id
        having count(*) > 1`,
    )

    // Every rule now holds three unresolved occurrences at once. That row was
    // impossible under the single-pending index, and that impossibility WAS #96.
    expect(rows).toHaveLength(RULES)
    expect(rows.every((row) => row.n === 3)).toBe(true)
  }, 300_000)
})
