import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { PGlite } from '@electric-sql/pglite'
import {
  actAs,
  actAsAdmin,
  applyEffectiveUntil,
  createRecurrenceIdentityDb,
  sqlstateOf,
  U_A,
} from './support/recurrence-identity-db'

/**
 * 0068 — moving an anchor has to say from when (#121).
 *
 * The calendar consequences live in `@grana/money-logic`, injected with a fixed
 * `today`. What is pinned HERE is the half only the database can guarantee: that
 * the effective date is required, that it is recorded, and that the outgoing
 * version is closed so two schedules never overlap and the gap between them
 * belongs to nobody.
 */

let db: PGlite

beforeAll(async () => {
  db = await createRecurrenceIdentityDb()
  await applyEffectiveUntil(db)
})

afterAll(async () => {
  await db.close()
})

const today = async (): Promise<string> => {
  const { rows } = await db.query<{ d: string }>(
    `select ((now() at time zone 'America/Argentina/Buenos_Aires')::date)::text as d`,
  )
  return rows[0].d
}

const shift = (date: string, days: number): string => {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

let seq = 0
/** A monthly rule that started a while back, as the superuser. */
const seedRule = async (): Promise<string> => {
  const id = `00000000-0000-4000-8000-00000000c1${(seq++).toString(16).padStart(2, '0')}`
  await actAsAdmin(db)
  await db.exec(`
    insert into public.recurrences (id, user_id, start_date, interval_count, interval_unit, status)
    values ('${id}', '${U_A}', '2026-06-08', 1, 'month', 'active');
  `)
  await actAs(db, U_A)
  return id
}

const versionsOf = async (ruleId: string) => {
  await actAsAdmin(db)
  const { rows } = await db.query<{
    effective_from: string
    effective_until: string | null
    anchor_date: string
  }>(
    `select effective_from::text, effective_until::text, anchor_date::text
       from public.recurrence_schedule_versions
      where recurrence_id = '${ruleId}' order by effective_from`,
  )
  await actAs(db, U_A)
  return rows
}

const floorOf = async (ruleId: string): Promise<string | null> => {
  await actAsAdmin(db)
  const { rows } = await db.query<{ f: string | null }>(
    `select schedule_effective_from::text as f from public.recurrences where id = '${ruleId}'`,
  )
  await actAs(db, U_A)
  return rows[0].f
}

const correctAnchor = (ruleId: string, anchor: string, effectiveFrom: string) =>
  db.exec(`
    select public.update_recurrence_schedule(
      '${ruleId}'::uuid,
      jsonb_build_object('start_date', '${anchor}'),
      '${effectiveFrom}'::date
    );
  `)

describe('the effective date is required, not inferred', () => {
  it('rejects a bare update of the anchor', async () => {
    // The bug this migration exists for: an anchor that moves on its own terms.
    const rule = await seedRule()
    const state = await sqlstateOf(
      db,
      `update public.recurrences set start_date = '2026-06-10' where id = '${rule}'`,
    )
    expect(state).toBe('23514')
  })

  it('rejects an effective date in the past', async () => {
    const rule = await seedRule()
    const yesterday = shift(await today(), -1)
    const state = await sqlstateOf(
      db,
      `select public.update_recurrence_schedule('${rule}'::uuid,
         jsonb_build_object('start_date', '2026-06-10'), '${yesterday}'::date)`,
    )
    expect(state).toBe('23514')
  })

  it('lets a frequency-only change through, as it always did', async () => {
    // Nothing is ambiguous there: the anchor does not move, so no cycle can be
    // served twice. Requiring an answer would be friction for a question nobody
    // asked.
    const rule = await seedRule()
    await expect(
      db.exec(`update public.recurrences set interval_count = 2 where id = '${rule}'`),
    ).resolves.toBeDefined()
  })
})

describe('the outgoing version is closed so the two never overlap', () => {
  it('closes it yesterday when the new one starts today', async () => {
    const rule = await seedRule()
    const now = await today()
    await correctAnchor(rule, '2026-06-10', now)

    const versions = await versionsOf(rule)
    expect(versions[0].effective_until).toBe(shift(now, -1))
    expect(versions[versions.length - 1].effective_from).toBe(now)
    expect(versions[versions.length - 1].effective_until).toBeNull()
  })

  it('closes it today when the new one starts later, leaving the gap empty', async () => {
    const rule = await seedRule()
    const now = await today()
    const later = shift(now, 30)
    await correctAnchor(rule, '2026-06-10', later)

    const versions = await versionsOf(rule)
    // Inclusive: the old schedule may still produce TODAY, and then stops. The
    // stretch up to `later` is described by nobody.
    expect(versions[0].effective_until).toBe(now)
    expect(versions[versions.length - 1].effective_from).toBe(later)
  })

  it('records the floor on the rule, for the reads that do not know about versions', async () => {
    const rule = await seedRule()
    const later = shift(await today(), 30)
    await correctAnchor(rule, '2026-06-10', later)
    expect(await floorOf(rule)).toBe(later)
  })
})

describe('the shape of the data', () => {
  it('refuses a version that ends before it starts', async () => {
    const rule = await seedRule()
    await actAsAdmin(db)
    const state = await sqlstateOf(
      db,
      `update public.recurrence_schedule_versions
          set effective_until = effective_from - 1
        where recurrence_id = '${rule}'`,
    )
    await actAs(db, U_A)
    expect(state).toBe('23514')
  })

  it('keeps the anonymous role out of the RPC', async () => {
    // 0067's lesson, applied at birth instead of two years later.
    await actAsAdmin(db)
    const { rows } = await db.query<{ anon: boolean; auth: boolean }>(
      `select has_function_privilege('anon', 'public.update_recurrence_schedule(uuid, jsonb, date)', 'EXECUTE') as anon,
              has_function_privilege('authenticated', 'public.update_recurrence_schedule(uuid, jsonb, date)', 'EXECUTE') as auth`,
    )
    await actAs(db, U_A)
    expect(rows[0]).toEqual({ anon: false, auth: true })
  })
})
