import type { PGlite } from '@electric-sql/pglite'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { updateRecurrence } from '../src/mutations'
import {
  actAs,
  actAsAdmin,
  createRecurrenceIdentityDb,
  U_A,
} from './support/recurrence-identity-db'
import { pglitePostgrest } from './support/pglite-postgrest'

/**
 * A NEW LIMIT CANNOT BE LOWER THAN WHAT THE RULE ALREADY SPENT — checked in the
 * write path, which is what makes it true.
 *
 * The form checks it too, so the user hears about it while typing. That is a
 * convenience: a form can be bypassed, and the rule still has to hold. So every
 * case here goes STRAIGHT TO `updateRecurrence`, with no form anywhere in the
 * call stack.
 *
 * Accepting a lower limit would show «3 de 3» over a rule that walked five
 * positions — a number that describes nothing — and would present the rule as
 * finished for a reason that is not true.
 */

const RULE = '00000000-0000-4000-8000-00000000c101'

let db: PGlite
let supabase: ReturnType<typeof pglitePostgrest>

/**
 * A monthly rule anchored far enough back that it has spent several positions by
 * the time this runs. Dated off the DATABASE's own clock: hard-coded months
 * would make it a rule that spent a different number every year.
 */
beforeAll(async () => {
  db = await createRecurrenceIdentityDb()
  supabase = pglitePostgrest(db, U_A)

  const { rows } = await db.query<{ start: string }>(
    `select ((now() at time zone 'America/Argentina/Buenos_Aires')::date
             - interval '4 months')::date::text as start`,
  )
  await db.exec(`
    insert into public.recurrences
      (id, user_id, start_date, interval_count, interval_unit, status, amount,
       currency_code, movement_type, max_occurrences)
    values ('${RULE}', '${U_A}', '${rows[0].start}', 1, 'month', 'active', 1000, 'ARS',
            'expense', 11);
  `)
}, 120_000)

beforeEach(async () => {
  await actAs(db, U_A)
})

afterAll(async () => {
  await db?.close()
})

/** What the normative read says — the same one the write path consults. */
async function positionsSpent(): Promise<number> {
  const { rows } = await db.query<{ spent: number }>(
    `select public.recurrence_positions_spent('${RULE}'::uuid,
       (now() at time zone 'America/Argentina/Buenos_Aires')::date) as spent`,
  )
  return rows[0].spent
}

const storedLimit = async (): Promise<number | null> => {
  await actAsAdmin(db)
  const { rows } = await db.query<{ max_occurrences: number | null }>(
    `select max_occurrences from public.recurrences where id = '${RULE}'`,
  )
  await actAs(db, U_A)
  return rows[0].max_occurrences
}

describe('changing a rule’s limit, through the mutation', () => {
  it('refuses a limit below the positions already spent, and says how many', async () => {
    const spent = await positionsSpent()
    expect(spent).toBeGreaterThan(1)

    const result = await updateRecurrence(supabase, U_A, RULE, {
      max_occurrences: spent - 1,
    })

    expect(result.ok).toBe(false)
    expect(result.ok === false ? result.formError : '').toContain(String(spent))
    // And nothing was written: the rule keeps the limit it had.
    expect(await storedLimit()).toBe(11)
  })

  it('accepts a limit EQUAL to what was spent — that is how a plan is closed', async () => {
    const spent = await positionsSpent()

    const result = await updateRecurrence(supabase, U_A, RULE, { max_occurrences: spent })

    expect(result.ok).toBe(true)
    expect(await storedLimit()).toBe(spent)
  })

  it('accepts a wider limit', async () => {
    const result = await updateRecurrence(supabase, U_A, RULE, { max_occurrences: 24 })

    expect(result.ok).toBe(true)
    expect(await storedLimit()).toBe(24)
  })

  it('accepts removing the limit', async () => {
    const result = await updateRecurrence(supabase, U_A, RULE, { max_occurrences: null })

    expect(result.ok).toBe(true)
    expect(await storedLimit()).toBeNull()
  })

  it('counts POSITIONS and not instance rows', async () => {
    // The rule has no rows in `recurrence_instances` at all, and has spent
    // several positions all the same. A check that counted rows would accept a
    // limit of 1 here — which is exactly the shape of the rule that opened #142.
    await actAsAdmin(db)
    const { rows } = await db.query<{ n: number }>(
      `select count(*)::int as n from public.recurrence_instances where recurrence_id = '${RULE}'`,
    )
    await actAs(db, U_A)
    expect(rows[0].n).toBe(0)

    const result = await updateRecurrence(supabase, U_A, RULE, { max_occurrences: 1 })

    expect(result.ok).toBe(false)
  })
})
