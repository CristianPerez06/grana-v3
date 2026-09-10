import type { PGlite } from '@electric-sql/pglite'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { getPendingInstancesByRecurrenceId } from '../src/queries'
import { createRecurrenceIdentityDb, U_A } from './support/recurrence-identity-db'
import { pglitePostgrest } from './support/pglite-postgrest'

/**
 * The read that used to answer "the pending occurrence of each rule" and now has
 * to answer "the pending occurrenceS". While the database allowed one per rule,
 * collapsing them into a single value was harmless; with the backlog
 * materialized, the same code silently drops occurrences a rule owes.
 *
 * The single-pending index is dropped here on purpose: the point of this read is
 * the state that exists AFTER the activation, and with the index in place the
 * fixture could not hold two unresolved occurrences at all.
 */

let db: PGlite

beforeAll(async () => {
  db = await createRecurrenceIdentityDb()
  await db.exec('drop index recurrence_instances_one_pending_per_rule;')
}, 120_000)

afterAll(async () => {
  await db?.close()
})

let ruleSeq = 0

async function ruleWithPendings(dueDates: string[]): Promise<string> {
  ruleSeq += 1
  const id = `00000000-0000-0000-0000-00000000${String(3000 + ruleSeq)}`
  await db.exec(`
    insert into public.recurrences
      (id, user_id, amount, interval_count, interval_unit, start_date, last_generated_date, status)
    values ('${id}', '${U_A}', 2500, 1, 'month', '2026-01-23', '2026-01-23', 'active');
  `)
  for (const dueDate of dueDates) {
    await db.exec(`
      insert into public.recurrence_instances
        (recurrence_id, user_id, scheduled_date, due_date, status)
      values ('${id}', '${U_A}', '${dueDate}', '${dueDate}', 'pending');
    `)
  }
  return id
}

describe('getPendingInstancesByRecurrenceId', () => {
  it('returns every unresolved occurrence of a rule, not one', async () => {
    const ruleId = await ruleWithPendings(['2026-06-23', '2026-07-23', '2026-08-23'])

    const byRule = await getPendingInstancesByRecurrenceId(pglitePostgrest(db), [ruleId])

    expect(byRule.get(ruleId)?.map((instance) => instance.due_date)).toEqual([
      '2026-06-23',
      '2026-07-23',
      '2026-08-23',
    ])
  })

  it('orders them oldest first — the order they get reviewed in', async () => {
    const ruleId = await ruleWithPendings(['2026-08-23', '2026-06-23', '2026-07-23'])

    const byRule = await getPendingInstancesByRecurrenceId(pglitePostgrest(db), [ruleId])

    const dates = byRule.get(ruleId)?.map((instance) => instance.due_date)
    expect(dates).toEqual([...(dates ?? [])].sort())
  })

  it('orders by the VENCIMIENTO, even when the legacy column disagrees', async () => {
    // Same shape as the global feed: `scheduled_date` ascending is the reverse of
    // `due_date` ascending. The rule's own list has to agree with the feed.
    //
    // Synthetic, like the feed's: no known write leaves a `pending` row whose two
    // dates disagree (an older client overwrites `scheduled_date` at confirm
    // time, which resolves the row). It exists to make the columns answer
    // differently and pin which one the read obeys.
    ruleSeq += 1
    const id = `00000000-0000-0000-0000-00000000${String(3000 + ruleSeq)}`
    await db.exec(`
      insert into public.recurrences
        (id, user_id, amount, interval_count, interval_unit, start_date, last_generated_date, status)
      values ('${id}', '${U_A}', 2500, 1, 'month', '2026-01-23', '2026-01-23', 'active');
      insert into public.recurrence_instances
        (recurrence_id, user_id, scheduled_date, due_date, status)
      values ('${id}', '${U_A}', '2026-07-01', '2026-07-23', 'pending'),
             ('${id}', '${U_A}', '2026-07-05', '2026-06-23', 'pending');
    `)

    const byRule = await getPendingInstancesByRecurrenceId(pglitePostgrest(db), [id])

    expect(byRule.get(id)?.map((instance) => instance.due_date)).toEqual([
      '2026-06-23',
      '2026-07-23',
    ])
  })

  it('keeps each rule occurrences separate', async () => {
    const first = await ruleWithPendings(['2026-06-23'])
    const second = await ruleWithPendings(['2026-06-23', '2026-07-23'])

    const byRule = await getPendingInstancesByRecurrenceId(pglitePostgrest(db), [first, second])

    expect(byRule.get(first)).toHaveLength(1)
    expect(byRule.get(second)).toHaveLength(2)
  })

  it('leaves resolved occurrences out', async () => {
    const ruleId = await ruleWithPendings(['2026-06-23'])
    await db.exec(`
      insert into public.recurrence_instances
        (recurrence_id, user_id, scheduled_date, due_date, status, resolved_at)
      values ('${ruleId}', '${U_A}', '2026-07-23', '2026-07-23', 'skipped', now());
    `)

    const byRule = await getPendingInstancesByRecurrenceId(pglitePostgrest(db), [ruleId])

    expect(byRule.get(ruleId)?.map((instance) => instance.due_date)).toEqual(['2026-06-23'])
  })

  it('has no entry for a rule that is up to date', async () => {
    const ruleId = await ruleWithPendings([])

    const byRule = await getPendingInstancesByRecurrenceId(pglitePostgrest(db), [ruleId])

    expect(byRule.has(ruleId)).toBe(false)
  })

  it('returns nothing for an empty id list, without asking the database', async () => {
    const byRule = await getPendingInstancesByRecurrenceId(pglitePostgrest(db), [])
    expect(byRule.size).toBe(0)
  })

  it('does not drop occurrences past the server row cap', async () => {
    // A rule with a year of daily backlog unresolved. Read in one request,
    // PostgREST truncates at `db-max-rows` and the rule looks up to date on
    // occurrences it still owes.
    const ruleId = await ruleWithPendings([])
    await db.exec(`
      insert into public.recurrence_instances
        (recurrence_id, user_id, scheduled_date, due_date, status)
      select '${ruleId}', '${U_A}', d::date, d::date, 'pending'
        from generate_series('2026-01-01'::date, '2026-03-31'::date, '1 day') as d;
    `)

    const byRule = await getPendingInstancesByRecurrenceId(
      pglitePostgrest(db, { maxRows: 10, unstableTies: true }),
      [ruleId],
    )

    expect(byRule.get(ruleId)).toHaveLength(90)
  })
})
