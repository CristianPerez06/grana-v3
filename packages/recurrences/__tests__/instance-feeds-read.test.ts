import type { PGlite } from '@electric-sql/pglite'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { getPendingRecurrenceInstances, getRecurrenceDetail } from '../src/queries'
import { applyMigration, createRecurrenceIdentityDb, U_A } from './support/recurrence-identity-db'
import { pglitePostgrest } from './support/pglite-postgrest'

/**
 * The two reads that RENDER lists: the global "vencimientos por revisar" feed,
 * and one rule's history. Both stopped being at most one row per rule the moment
 * the backlog exists, so both need to page exhaustively and to come back in the
 * order the screen shows.
 *
 * The single-pending index is dropped here: these lists describe the state after
 * the activation, and with the index in place a rule could not hold two
 * unresolved occurrences to begin with.
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

async function createRule(): Promise<string> {
  ruleSeq += 1
  const id = `00000000-0000-0000-0000-00000000${String(4000 + ruleSeq)}`
  await db.exec(`
    insert into public.recurrences
      (id, user_id, amount, interval_count, interval_unit, start_date, last_generated_date, status)
    values ('${id}', '${U_A}', 2500, 1, 'month', '2026-01-23', '2026-01-23', 'active');
  `)
  return id
}

describe('getPendingRecurrenceInstances — the global review feed', () => {
  it('returns every unresolved occurrence across rules, past the server row cap', async () => {
    // Two rules, several unresolved occurrences each, and a server that
    // truncates at 10 rows. Read in one request the block would show a slice and
    // look like the whole backlog.
    const first = await createRule()
    const second = await createRule()
    await db.exec(`
      insert into public.recurrence_instances
        (recurrence_id, user_id, scheduled_date, due_date, status)
      select r.id, '${U_A}', d::date, d::date, 'pending'
        from (values ('${first}'::uuid), ('${second}'::uuid)) as r(id),
             generate_series('2026-01-01'::date, '2026-01-15'::date, '1 day') as d;
    `)

    const feed = await getPendingRecurrenceInstances(
      pglitePostgrest(db, { maxRows: 10, unstableTies: true }),
    )

    expect(feed).toHaveLength(30)
    // Several of them belong to the same rule — the whole point of the backlog.
    expect(feed.filter((instance) => instance.recurrence_id === first)).toHaveLength(15)
    expect(feed.filter((instance) => instance.recurrence_id === second)).toHaveLength(15)
    // No row comes back twice: a partial order over an OFFSET window would repeat.
    expect(new Set(feed.map((instance) => instance.id)).size).toBe(30)
  })

  it('reads oldest first — the order the block reviews them in', async () => {
    const ruleId = await createRule()
    await db.exec(`
      insert into public.recurrence_instances
        (recurrence_id, user_id, scheduled_date, due_date, status)
      values ('${ruleId}', '${U_A}', '2026-03-23', '2026-03-23', 'pending'),
             ('${ruleId}', '${U_A}', '2026-02-23', '2026-02-23', 'pending');
    `)

    const feed = await getPendingRecurrenceInstances(pglitePostgrest(db))
    const mine = feed
      .filter((instance) => instance.recurrence_id === ruleId)
      .map((instance) => instance.scheduled_date)

    expect(mine).toEqual(['2026-02-23', '2026-03-23'])
  })

  it('orders by the VENCIMIENTO, even when the legacy column disagrees', async () => {
    // Two unresolved occurrences whose `scheduled_date` order is the REVERSE of
    // their `due_date` order. Sorting by `scheduled_date` puts the later
    // vencimiento first, so the block asks the user to review August before July.
    //
    // The state is SYNTHETIC and says so: an older client overwrites
    // `scheduled_date` when it CONFIRMS, which leaves the row resolved, so no
    // known write produces a `pending` row whose two dates disagree. It is built
    // by hand for one reason — to make the two columns give different answers,
    // and pin which one the read obeys. Ordering by a column nothing else may
    // read is a hole worth closing before something opens it.
    const ruleId = await createRule()
    await db.exec(`
      insert into public.recurrence_instances
        (recurrence_id, user_id, scheduled_date, due_date, status)
      values ('${ruleId}', '${U_A}', '2026-07-01', '2026-07-23', 'pending'),
             ('${ruleId}', '${U_A}', '2026-07-05', '2026-06-23', 'pending');
    `)

    const feed = await getPendingRecurrenceInstances(pglitePostgrest(db))
    const mine = feed
      .filter((instance) => instance.recurrence_id === ruleId)
      .map((instance) => instance.due_date)

    expect(mine).toEqual(['2026-06-23', '2026-07-23'])
  })

  it('embeds the rule each occurrence belongs to', async () => {
    const ruleId = await createRule()
    await db.exec(`
      insert into public.recurrence_instances
        (recurrence_id, user_id, scheduled_date, due_date, status)
      values ('${ruleId}', '${U_A}', '2026-04-23', '2026-04-23', 'pending');
    `)

    const feed = await getPendingRecurrenceInstances(pglitePostgrest(db))
    const mine = feed.find((instance) => instance.recurrence_id === ruleId)

    expect(mine?.recurrence?.id).toBe(ruleId)
  })
})

describe('getRecurrenceDetail — the history list', () => {
  it('orders by the date the list shows, newest first, with legacy rows in place', async () => {
    // Three shapes at once, and the legacy one can only be built the way it
    // really exists: inserted BEFORE 0064 and left with a null `due_date` by its
    // backfill. Inserting it afterwards is impossible — the compatibility trigger
    // derives `due_date` from `scheduled_date`, and the immutability guard
    // refuses to clear it — so a fixture that seeds it after the migration is
    // testing a row production does not have.
    const legacyDb = await createRecurrenceIdentityDb({ applyMigration: false })
    try {
      const ruleId = '00000000-0000-0000-0000-000000004900'
      await legacyDb.exec(`
        insert into public.recurrences
          (id, user_id, amount, interval_count, interval_unit, start_date, last_generated_date, status)
        -- The cursor sits ON the rule's own calendar: 0064's phase guard aborts
        -- the whole migration for a rule whose cursor is off schedule, and this
        -- fixture is about the history list, not about that guard.
        values ('${ruleId}', '${U_A}', 2500, 1, 'month', '2026-05-10', '2026-05-10', 'active');
        -- Confirmed before the distinction existed: 0064 leaves its due_date null,
        -- because the vencimiento it came from was overwritten and is not
        -- recoverable.
        insert into public.recurrence_instances
          (recurrence_id, user_id, scheduled_date, status, resolved_at, confirmed_transaction_id)
        values ('${ruleId}', '${U_A}', '2026-05-10', 'confirmed', now(), gen_random_uuid());
      `)
      await applyMigration(legacyDb)
      await legacyDb.exec('drop index recurrence_instances_one_pending_per_rule;')

      const legacy = await legacyDb.query<{ due_date: string | null }>(
        'select due_date from public.recurrence_instances',
      )
      expect(legacy.rows[0].due_date).toBeNull()

      await legacyDb.exec(`
        insert into public.recurrence_instances
          (recurrence_id, user_id, scheduled_date, due_date, status, resolved_at, confirmed_transaction_id)
        values
          -- An August cuota paid on 15-Sep: the two dates diverge on purpose.
          ('${ruleId}', '${U_A}', '2026-09-15', '2026-08-23', 'confirmed', now(), gen_random_uuid()),
          -- A September cuota paid on the 10th — earlier payment, later vencimiento.
          ('${ruleId}', '${U_A}', '2026-09-10', '2026-09-23', 'confirmed', now(), gen_random_uuid());
        insert into public.recurrence_instances
          (recurrence_id, user_id, scheduled_date, due_date, status)
        values ('${ruleId}', '${U_A}', '2026-10-23', '2026-10-23', 'pending');
      `)

      const detail = await getRecurrenceDetail(pglitePostgrest(legacyDb), ruleId)

      // Sorting by `due_date` breaks this twice: the legacy row jumps to the TOP,
      // because Postgres orders nulls first in DESC; and the August cuota drops
      // below the September one, because they are sorted by a date the list does
      // not show.
      expect(detail?.instances.map((instance) => instance.scheduled_date)).toEqual([
        '2026-10-23',
        '2026-09-15',
        '2026-09-10',
        '2026-05-10',
      ])
    } finally {
      await legacyDb.close()
    }
  }, 120_000)

  it('reads the whole history past the server row cap', async () => {
    const ruleId = await createRule()
    await db.exec(`
      insert into public.recurrence_instances
        (recurrence_id, user_id, scheduled_date, due_date, status)
      select '${ruleId}', '${U_A}', d::date, d::date, 'pending'
        from generate_series('2026-01-01'::date, '2026-02-09'::date, '1 day') as d;
    `)

    const detail = await getRecurrenceDetail(
      pglitePostgrest(db, { maxRows: 7, unstableTies: true }),
      ruleId,
    )

    expect(detail?.instances).toHaveLength(40)
    expect(new Set(detail?.instances.map((instance) => instance.id)).size).toBe(40)
  })

  it('exposes the unresolved ones oldest first, whatever order the history uses', async () => {
    const ruleId = await createRule()
    await db.exec(`
      insert into public.recurrence_instances
        (recurrence_id, user_id, scheduled_date, due_date, status)
      values ('${ruleId}', '${U_A}', '2026-07-23', '2026-07-23', 'pending'),
             ('${ruleId}', '${U_A}', '2026-06-23', '2026-06-23', 'pending');
    `)

    const detail = await getRecurrenceDetail(pglitePostgrest(db), ruleId)

    // The history reads newest first; the review order is the opposite.
    expect(detail?.instances.map((i) => i.scheduled_date)).toEqual(['2026-07-23', '2026-06-23'])
    expect(detail?.pending_instances.map((i) => i.scheduled_date)).toEqual([
      '2026-06-23',
      '2026-07-23',
    ])
  })
})
