import type { PGlite } from '@electric-sql/pglite'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { getRecurrences } from '../src/queries'
import { updateRecurrence } from '../src/mutations'
import {
  actAs,
  actAsAdmin,
  createRecurrenceIdentityDb,
  U_A,
} from './support/recurrence-identity-db'
import { pglitePostgrest } from './support/pglite-postgrest'

/**
 * «Finalizada» IS DERIVED, and `recurrences.status` is never rewritten to say it.
 *
 * The derivation has its own table tests in `@grana/money-logic`, and they would
 * have passed while the hub was still wrong: the hub grouped by `end_date <
 * today`, so a rule that spent its `max_occurrences` sat among the active ones
 * announcing a next date it would never produce. So everything here goes through
 * the SHIPPED read and the SHIPPED mutation, against a real Postgres.
 */

const SPENT = '00000000-0000-4000-8000-00000000d201'
const DELETED = '00000000-0000-4000-8000-00000000d202'
const OPEN = '00000000-0000-4000-8000-00000000d203'

let db: PGlite
let supabase: ReturnType<typeof pglitePostgrest>

beforeAll(async () => {
  db = await createRecurrenceIdentityDb()
  supabase = pglitePostgrest(db, U_A)

  const { rows } = await db.query<{ start: string }>(
    `select ((now() at time zone 'America/Argentina/Buenos_Aires')::date
             - interval '3 months')::date::text as start`,
  )
  const rule = (id: string, max: number | null, status = 'active') => `
    insert into public.recurrences
      (id, user_id, start_date, interval_count, interval_unit, status, amount,
       currency_code, movement_type, max_occurrences)
    values ('${id}', '${U_A}', '${rows[0].start}', 1, 'month', '${status}', 1000, 'ARS',
            'expense', ${max == null ? 'null' : max});
  `
  // Its limit was spent months ago; its column still says `active`. This is the
  // exact shape of the rule that opened #142.
  await db.exec(rule(SPENT, 1))
  await db.exec(rule(DELETED, 1, 'deleted'))
  await db.exec(rule(OPEN, null))
}, 120_000)

beforeEach(async () => {
  await actAs(db, U_A)
})

afterAll(async () => {
  await db?.close()
})

const listed = async () => {
  const rules = await getRecurrences(supabase, { statuses: ['active', 'paused'] })
  return new Map(rules.map((rule) => [rule.id, rule]))
}

const storedStatus = async (id: string) => {
  await actAsAdmin(db)
  const { rows } = await db.query<{ status: string }>(
    `select status from public.recurrences where id = '${id}'`,
  )
  await actAs(db, U_A)
  return rows[0].status
}

describe('a rule whose limit is spent', () => {
  it('is shown as finished while its column still says active', async () => {
    const rules = await listed()
    const spent = rules.get(SPENT)

    expect(spent?.status).toBe('active')
    expect(spent?.lifecycle.state).toBe('finished')
    // It is not counted among the ones that still do something — the whole
    // point of grouping by the derived state.
    expect(spent?.next_occurrence).toBeNull()
  })

  it('does not have its stored status rewritten by being read', async () => {
    await listed()

    expect(await storedStatus(SPENT)).toBe('active')
  })
})

describe('changing the limit, through the real mutation', () => {
  it('widening it returns the rule to active, with no other operation', async () => {
    const before = await storedStatus(SPENT)

    const result = await updateRecurrence(supabase, U_A, SPENT, { max_occurrences: 24 })
    expect(result.ok).toBe(true)

    const rules = await listed()
    expect(rules.get(SPENT)?.lifecycle.state).toBe('active')
    expect(rules.get(SPENT)?.next_occurrence).not.toBeNull()
    // Nothing resumed it, nothing touched the column: the state is derived on
    // each read, so widening the limit takes effect by itself.
    expect(await storedStatus(SPENT)).toBe(before)
  })

  it('removing it leaves the rule indefinite and shows no progress', async () => {
    const result = await updateRecurrence(supabase, U_A, SPENT, { max_occurrences: null })
    expect(result.ok).toBe(true)

    const rules = await listed()
    expect(rules.get(SPENT)?.lifecycle.state).toBe('active')
    expect(rules.get(SPENT)?.lifecycle.progress).toBeNull()
    expect(rules.get(SPENT)?.last_expected_occurrence).toEqual({ kind: 'none' })
    expect(await storedStatus(SPENT)).toBe('active')
  })
})

describe('a deleted rule', () => {
  it('does not come back as finished on any surface that lists live rules', async () => {
    const rules = await listed()

    // The hub asks for active and paused, so it is not in the list at all — and
    // if it ever were, the derivation refuses to call it finished.
    expect(rules.has(DELETED)).toBe(false)
    expect(await storedStatus(DELETED)).toBe('deleted')
  })
})

describe('a rule with no limit at all', () => {
  it('stays active and shows nothing to measure', async () => {
    const rules = await listed()
    const open = rules.get(OPEN)

    expect(open?.lifecycle.state).toBe('active')
    expect(open?.lifecycle.progress).toBeNull()
    expect(open?.last_expected_occurrence).toEqual({ kind: 'none' })
  })
})
