import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { PGlite } from '@electric-sql/pglite'
import { candidateEffectiveDates } from '@grana/money-logic'
import { applyEffectiveUntil, createRecurrenceIdentityDb } from './support/recurrence-identity-db'

/**
 * The client draws the question; the database refuses anything else. That only
 * works while the two agree on what the calendar produces — if they drift, the
 * form offers a date the server rejects, and correcting a reference date becomes
 * impossible for the schedules where they disagree.
 *
 * So both are asked the same thing, over a matrix that includes the shapes date
 * arithmetic gets wrong: month-end clamping, February, a leap year, and the
 * every-N-days phases that have no month to reason about.
 */

let db: PGlite

beforeAll(async () => {
  db = await createRecurrenceIdentityDb()
})

afterAll(async () => {
  await db.close()
})

const fromSql = async (args: {
  anchor: string
  count: number
  unit: string
  from: string
  endDate?: string | null
  remaining?: number | null
}): Promise<string[]> => {
  const { rows } = await db.query<{ effective_from: string }>(
    `select effective_from::text from public.recurrence_candidate_effective_dates(
       '${args.anchor}'::date, ${args.count}, '${args.unit}', '${args.from}'::date,
       ${args.endDate == null ? 'null' : `'${args.endDate}'::date`},
       ${args.remaining == null ? 'null' : args.remaining})`,
  )
  return rows.map((r) => r.effective_from)
}

const cases: Array<{
  name: string
  anchor: string
  count: number
  unit: 'day' | 'week' | 'month' | 'year'
  from: string
  endDate?: string | null
  remaining?: number | null
}> = [
  { name: 'monthly, mid-month', anchor: '2026-06-10', count: 1, unit: 'month', from: '2026-09-10' },
  { name: 'monthly, the day after', anchor: '2026-06-10', count: 1, unit: 'month', from: '2026-09-11' },
  { name: 'monthly on the 31st, into February', anchor: '2026-01-31', count: 1, unit: 'month', from: '2026-02-01' },
  { name: 'monthly on the 30th, February in a leap year', anchor: '2024-01-30', count: 1, unit: 'month', from: '2024-02-01' },
  { name: 'every 3 days', anchor: '2026-09-02', count: 3, unit: 'day', from: '2026-09-10' },
  { name: 'every 3 days, landing exactly on `from`', anchor: '2026-09-01', count: 3, unit: 'day', from: '2026-09-10' },
  { name: 'weekly', anchor: '2026-05-04', count: 1, unit: 'week', from: '2026-09-10' },
  { name: 'every two weeks', anchor: '2026-05-04', count: 2, unit: 'week', from: '2026-09-10' },
  { name: 'annual, on 29 February', anchor: '2024-02-29', count: 1, unit: 'year', from: '2026-01-01' },
  { name: 'bounded by end_date', anchor: '2026-06-10', count: 1, unit: 'month', from: '2026-09-10', endDate: '2026-09-30' },
  { name: 'end_date already past', anchor: '2026-06-10', count: 1, unit: 'month', from: '2026-09-10', endDate: '2026-01-01' },
  { name: 'one left on the cap', anchor: '2026-06-10', count: 1, unit: 'month', from: '2026-09-10', remaining: 1 },
  { name: 'cap already spent', anchor: '2026-06-10', count: 1, unit: 'month', from: '2026-09-10', remaining: 0 },
  { name: 'anchor far in the past', anchor: '2019-03-15', count: 1, unit: 'month', from: '2026-09-10' },
]

describe('the same two dates, in TypeScript and in SQL', () => {
  it.each(cases)('$name', async (testCase) => {
    const sql = await fromSql({
      anchor: testCase.anchor,
      count: testCase.count,
      unit: testCase.unit,
      from: testCase.from,
      endDate: testCase.endDate,
      remaining: testCase.remaining,
    })
    const js = candidateEffectiveDates(
      {
        anchor_date: testCase.anchor,
        interval_count: testCase.count,
        interval_unit: testCase.unit,
        end_date: testCase.endDate ?? null,
        remaining: testCase.remaining ?? null,
      },
      testCase.from,
    )
    expect(js).toEqual(sql)
  })
})
