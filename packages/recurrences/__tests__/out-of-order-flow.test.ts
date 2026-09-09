import type { PGlite } from '@electric-sql/pglite'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { generateDueRecurrenceInstances } from '../src/queries'
import { skipRecurrenceInstance } from '../src/mutations'
import { createRecurrenceIdentityDb, U_A } from './support/recurrence-identity-db'
import { pglitePostgrest } from './support/pglite-postgrest'

/**
 * #96, END TO END, through the real mutations and the real generator.
 *
 * `out-of-order-resolution.test.ts` pins the property on the pure core, but it
 * builds the set of existing occurrences by hand. That proved nothing about what
 * happens to the user, because the flow used to advance a cursor: resolving
 * August moved `last_generated_date` past July, and July — still owed — stopped
 * existing for every reader.
 *
 * Here the occurrences are materialized by the generator, resolved by the
 * mutations, and recomputed by the generator again.
 *
 * The single-pending index is dropped: this is the state after the activation,
 * and with it in place a rule could not hold June, July and August at once.
 */

const TODAY = '2026-09-08'
const RULE = '00000000-0000-0000-0000-000000005001'

let db: PGlite

beforeAll(async () => {
  db = await createRecurrenceIdentityDb()
  await db.exec('drop index recurrence_instances_one_pending_per_rule;')
  // Monthly on the 23rd, last known point 2026-05-23: June, July and August are
  // owed. The exact shape of the ticket.
  await db.exec(`
    insert into public.recurrences
      (id, user_id, amount, description, interval_count, interval_unit, start_date, last_generated_date, status)
    values ('${RULE}', '${U_A}', 450000, 'Alquiler', 1, 'month', '2026-05-23', '2026-05-23', 'active');
  `)
}, 120_000)

afterAll(async () => {
  await db?.close()
})

const client = () => pglitePostgrest(db)

async function occurrences(): Promise<Array<{ due_date: string; status: string }>> {
  const result = await db.query<{ due_date: string; status: string }>(
    `select to_char(due_date, 'YYYY-MM-DD') as due_date, status
       from public.recurrence_instances
      where recurrence_id = $1 order by due_date`,
    [RULE],
  )
  return result.rows
}

async function cursor(): Promise<string | null> {
  const result = await db.query<{ cursor: string | null }>(
    `select to_char(last_generated_date, 'YYYY-MM-DD') as cursor
       from public.recurrences where id = $1`,
    [RULE],
  )
  return result.rows[0].cursor
}

/**
 * Confirming creates a real movement through `@grana/transactions-mutations`,
 * which this harness does not model. What the recurrence side of a confirmation
 * leaves behind is this row state — and `confirm-writes.test.ts` is what pins
 * that `confirmRecurrenceInstance` writes exactly this and nothing on the rule.
 */
async function confirmInDb(dueDate: string): Promise<void> {
  await db.exec(`
    update public.recurrence_instances
       set status = 'confirmed',
           resolved_at = now(),
           confirmed_transaction_id = gen_random_uuid()
     where recurrence_id = '${RULE}' and due_date = '${dueDate}';
  `)
}

describe('resolving out of order, through the real flow', () => {
  it('materializes the three occurrences the rule owes', async () => {
    // Three runs: the single-pending index is gone, but the batch is filled
    // current-first, so the backlog completes over successive openings.
    for (let i = 0; i < 3; i += 1) {
      await generateDueRecurrenceInstances(client(), U_A, { today: TODAY })
    }

    expect(await occurrences()).toEqual([
      { due_date: '2026-06-23', status: 'pending' },
      { due_date: '2026-07-23', status: 'pending' },
      { due_date: '2026-08-23', status: 'pending' },
    ])
  })

  it('resolves AUGUST first, and neither July nor June is disturbed', async () => {
    await confirmInDb('2026-08-23')

    expect(await occurrences()).toEqual([
      { due_date: '2026-06-23', status: 'pending' },
      { due_date: '2026-07-23', status: 'pending' },
      { due_date: '2026-08-23', status: 'confirmed' },
    ])
  })

  it('then resolves JULY, out of order, through the real mutation', async () => {
    const july = await db.query<{ id: string }>(
      `select id from public.recurrence_instances
        where recurrence_id = $1 and due_date = '2026-07-23'`,
      [RULE],
    )

    const result = await skipRecurrenceInstance(client(), U_A, july.rows[0].id)

    expect(result).toEqual({ ok: true })
  })

  it('neither resolution wrote the cursor', async () => {
    // The write that made #96 permanent. Confirming August would have pushed it
    // to 2026-08-23, and from then on July did not exist for anyone.
    expect(await cursor()).toBe('2026-05-23')
  })

  it('re-running the generator brings nothing back and skips nothing', async () => {
    const before = await occurrences()
    await generateDueRecurrenceInstances(client(), U_A, { today: TODAY })

    // August does not reappear, July stays skipped, June stays available.
    expect(await occurrences()).toEqual(before)
    expect(await occurrences()).toEqual([
      { due_date: '2026-06-23', status: 'pending' },
      { due_date: '2026-07-23', status: 'skipped' },
      { due_date: '2026-08-23', status: 'confirmed' },
    ])
  })

  it('the calendar did not move: September is the next thing owed', async () => {
    const result = await generateDueRecurrenceInstances(client(), U_A, {
      today: '2026-09-30',
    })

    expect(result.error).toBeNull()
    expect((await occurrences()).map((o) => o.due_date)).toEqual([
      '2026-06-23',
      '2026-07-23',
      '2026-08-23',
      '2026-09-23',
    ])
  })

  it('June is still there, and still resolvable, after all of it', async () => {
    const june = await db.query<{ id: string }>(
      `select id from public.recurrence_instances
        where recurrence_id = $1 and due_date = '2026-06-23'`,
      [RULE],
    )

    expect(await skipRecurrenceInstance(client(), U_A, june.rows[0].id)).toEqual({ ok: true })
    expect(await cursor()).toBe('2026-05-23')
  })
})
