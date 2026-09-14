import type { PGlite } from '@electric-sql/pglite'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createRecurrenceIdentityDb, U_A } from './support/recurrence-identity-db'
import { pglitePostgrest } from './support/pglite-postgrest'

/**
 * A test OF the harness, not of the generator.
 *
 * Everything else in this folder asserts on dates that came back through
 * `pglitePostgrest`, so every one of those assertions rests on the double
 * reporting a `date` the way the real client does: as the text 'YYYY-MM-DD'.
 * When it did not, 14 tests across 6 files failed in Buenos Aires and passed in
 * CI — PGlite decodes a `DATE` to a JS Date at midnight UTC, and the double
 * formatted it back with the LOCAL getters, which subtract the zone's offset and
 * hand back the previous day (issue #131).
 *
 * These assertions are deliberately about the PLUMBING and use literal dates, so
 * they say nothing about recurrences and cannot drift with the calendar. They
 * fail in any zone west of Greenwich the moment a `Date` re-enters the path.
 */

const RULE = '00000000-0000-0000-0000-000000009001'

/**
 * The double's surface, structurally. The generated `Database` types do not
 * describe the reduced fixture schema these tests build, and a harness test has
 * no business borrowing a domain read just to reach `select`.
 */
type RawClient = {
  from: (table: string) => {
    select: (columns: string) => PromiseLike<{
      data: Array<Record<string, unknown>> | null
      error: unknown
    }> & {
      not: (
        column: string,
        operator: string,
        value: unknown,
      ) => PromiseLike<{
        data: Array<Record<string, unknown>> | null
        error: unknown
      }>
    }
    update: (payload: Record<string, unknown>) => {
      eq: (column: string, value: unknown) => {
        select: (columns: string) => PromiseLike<{
          data: Array<Record<string, unknown>> | null
          error: unknown
        }>
      }
    }
  }
}

let db: PGlite
let client: RawClient

beforeAll(async () => {
  db = await createRecurrenceIdentityDb()
  client = pglitePostgrest(db) as unknown as RawClient
  await db.exec(`
    insert into public.recurrences
      (id, user_id, start_date, last_generated_date, status)
    values ('${RULE}', '${U_A}', '2026-01-23', '2026-01-23', 'active');
    insert into public.recurrence_instances
      (recurrence_id, user_id, scheduled_date, due_date, status)
    values ('${RULE}', '${U_A}', '2026-06-23', '2026-06-23', 'pending');
  `)
}, 120_000)

afterAll(async () => {
  await db?.close()
})

describe('pglitePostgrest — date fidelity', () => {
  it('returns a date as the text that went in, not a day earlier', async () => {
    const { data } = await client.from('recurrence_instances').select('due_date, scheduled_date')

    expect(data?.[0]).toEqual({ due_date: '2026-06-23', scheduled_date: '2026-06-23' })
  })

  it('returns a date as a string, never as a Date object', async () => {
    const { data } = await client.from('recurrence_instances').select('due_date')

    const value = data?.[0]?.due_date
    expect(typeof value).toBe('string')
    expect(value).not.toBeInstanceOf(Date)
  })

  it('keeps the fidelity through an embedded resource', async () => {
    // Embeds resolve with a second query, which is its own call site: it had to
    // be converted too, so it can regress on its own.
    const { data } = await client
      .from('recurrence_instances')
      .select('due_date, recurrence_id, recurrence:recurrences(start_date)')

    expect(data?.[0]?.recurrence).toEqual({
      id: RULE,
      start_date: '2026-01-23',
    })
  })

  it('keeps the fidelity through an update ... returning', async () => {
    // The write path returns rows too, and returned a `Date` by the same route.
    const { data } = await client
      .from('recurrences')
      .update({ last_generated_date: '2026-07-23' })
      .eq('id', RULE)
      .select('last_generated_date')

    expect(data?.[0]).toEqual({ last_generated_date: '2026-07-23' })
  })

  it('returns a timestamptz as an ISO string, not a Date', async () => {
    // `created_at` defaults to now(), so this asserts the SHAPE, not a value.
    // The raw Postgres text would be a trap here: it renders in the session's
    // timezone, so passing it through unchanged would make the answer
    // environment-dependent all over again.
    const { data } = await client.from('recurrence_instances').select('created_at')

    const value = data?.[0]?.created_at
    expect(typeof value).toBe('string')
    expect(value).not.toBeInstanceOf(Date)
    expect(value).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
  })

  it('answers the same timestamptz instant from any timezone', async () => {
    // A fixed instant, so the expected value is absolute. Postgres would print
    // it as '...+00' under UTC and '...-03' in Buenos Aires; what the double
    // hands back must not move.
    await db.exec(`
      insert into public.recurrence_instances
        (recurrence_id, user_id, scheduled_date, due_date, status, resolved_at)
      values ('${RULE}', '${U_A}', '2026-08-23', '2026-08-23', 'skipped',
              '2026-06-23 15:04:05.123456+00');
    `)

    const original = process.env.TZ
    const answers: string[] = []
    try {
      for (const zone of ['Pacific/Kiritimati', 'Pacific/Midway', 'UTC']) {
        process.env.TZ = zone
        const { data } = await client
          .from('recurrence_instances')
          .select('resolved_at')
          .not('resolved_at', 'is', null)
        answers.push(String(data?.[0]?.resolved_at))
      }
    } finally {
      if (original === undefined) delete process.env.TZ
      else process.env.TZ = original
    }

    expect(answers).toEqual([
      '2026-06-23T15:04:05.123Z',
      '2026-06-23T15:04:05.123Z',
      '2026-06-23T15:04:05.123Z',
    ])
  })

  it('answers the same date on both sides of Greenwich', async () => {
    // The invariant the other four rest on, asserted directly: move the process
    // to an extreme offset either side of UTC and the answer MUST NOT move. With
    // a Date in the path this fails on the negative-offset leg — which is the
    // Buenos Aires leg, and the one that shipped red.
    const original = process.env.TZ
    const answers: string[] = []
    try {
      for (const zone of ['Pacific/Kiritimati', 'Pacific/Midway', 'UTC']) {
        process.env.TZ = zone
        const { data } = await client.from('recurrence_instances').select('due_date')
        answers.push(String(data?.[0]?.due_date))
      }
    } finally {
      if (original === undefined) delete process.env.TZ
      else process.env.TZ = original
    }

    expect(answers).toEqual(['2026-06-23', '2026-06-23', '2026-06-23'])
  })
})
