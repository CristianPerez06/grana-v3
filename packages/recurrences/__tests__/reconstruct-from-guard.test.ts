import { beforeAll, describe, expect, it } from 'vitest'
import type { PGlite } from '@electric-sql/pglite'
import {
  actAs,
  actAsAdmin,
  createRecurrenceIdentityDb,
  seedRule,
  sqlstateOf,
  U_A,
} from './support/recurrence-identity-db'

/**
 * `recurrences.reconstruct_from` is the floor of what the generator may
 * reconstruct, and the database owns it end to end.
 *
 * Owning it on INSERT is not enough. `recurrences` has had a "users update own
 * recurrences" policy since 0011 and the generated types expose every column in
 * `Update`, so a guard that only fires on INSERT leaves the floor writable by any
 * authenticated client. Moving the floor BACKWARDS fabricates months of backlog
 * out of nothing; moving it FORWARDS hides occurrences the user is owed. Neither
 * shows up in the UI.
 *
 * Who each case runs as is deliberate. Every case where the WRITER is part of
 * what is being asserted — the six UPDATE ones, and the two INSERTs where a
 * client tries to impose a value — runs under the `authenticated` role, because
 * asserting those as the superuser would prove nothing. The two that only assert
 * the DERIVATION itself seed as the superuser: `start_date - 1` and the cursor do
 * not depend on who is writing.
 */

const RULE = '00000000-0000-4000-8000-00000000e001'
const CHECK_VIOLATION = '23514'

describe('reconstruct_from — derived on INSERT', () => {
  let db: PGlite

  beforeAll(async () => {
    db = await createRecurrenceIdentityDb()
  })

  // These two seed as the superuser on purpose: what they assert is the
  // derivation itself, which does not depend on who is writing. The case where
  // the caller matters — a client trying to impose a value — runs as the user,
  // at the end of this block.

  it('a rule with no cursor gets start_date - 1, so its first occurrence survives', async () => {
    await seedRule(db, { id: RULE, start_date: '2026-05-01', last_generated_date: null })
    const { rows } = await db.query<{ reconstruct_from: string }>(
      `select reconstruct_from::text from public.recurrences where id = '${RULE}'`,
    )
    expect(rows[0].reconstruct_from).toBe('2026-04-30')
  })

  it('a rule seeded from a movement keeps its cursor as the floor', async () => {
    const id = '00000000-0000-4000-8000-00000000e002'
    await seedRule(db, { id, start_date: '2026-05-01', last_generated_date: '2026-06-01' })
    const { rows } = await db.query<{ reconstruct_from: string }>(
      `select reconstruct_from::text from public.recurrences where id = '${id}'`,
    )
    expect(rows[0].reconstruct_from).toBe('2026-06-01')
  })

  it('AS THE USER: a client that sends a value does not impose it', async () => {
    // The real threat model, so it runs with the same privileges a client has.
    // The database is the sole owner of the column, and `infinity` is only there
    // so the generated types do not demand it on Insert.
    const id = '00000000-0000-4000-8000-00000000e003'
    await actAs(db, U_A)
    await db.exec(`
      insert into public.recurrences (id, user_id, start_date, status, reconstruct_from)
      values ('${id}', '${U_A}', '2026-05-01', 'active', '1990-01-01');
    `)
    await actAsAdmin(db)

    const { rows } = await db.query<{ reconstruct_from: string }>(
      `select reconstruct_from::text from public.recurrences where id = '${id}'`,
    )
    expect(rows[0].reconstruct_from).toBe('2026-04-30')
  })

  it('AS THE USER: the placeholder default never survives an insert', async () => {
    const id = '00000000-0000-4000-8000-00000000e004'
    await actAs(db, U_A)
    await db.exec(`
      insert into public.recurrences (id, user_id, start_date, status)
      values ('${id}', '${U_A}', '2026-05-01', 'active');
    `)
    await actAsAdmin(db)

    const { rows } = await db.query<{ n: number }>(
      `select count(*)::int as n from public.recurrences where reconstruct_from = 'infinity'::date`,
    )
    expect(rows[0].n).toBe(0)
  })
})

describe('reconstruct_from — frozen on UPDATE, as the user', () => {
  let db: PGlite

  beforeAll(async () => {
    db = await createRecurrenceIdentityDb()
    await seedRule(db, {
      id: RULE,
      user_id: U_A,
      start_date: '2026-05-01',
      last_generated_date: '2026-06-01',
    })
    await actAs(db, U_A)
  })

  const floor = async () => {
    await actAsAdmin(db)
    const { rows } = await db.query<{ reconstruct_from: string; amount: string }>(
      `select reconstruct_from::text, amount::text from public.recurrences where id = '${RULE}'`,
    )
    await actAs(db, U_A)
    return rows[0]
  }

  it('the legitimate update still works: the guard freezes ONE column, not the row', async () => {
    await db.exec(`update public.recurrences set amount = 999 where id = '${RULE}'`)
    const row = await floor()
    expect(row.amount).toBe('999.00')
    expect(row.reconstruct_from).toBe('2026-06-01')
  })

  it('moving the floor BACKWARDS is rejected — it would fabricate backlog', async () => {
    expect(
      await sqlstateOf(db, `update public.recurrences set reconstruct_from = '2020-01-01' where id = '${RULE}'`),
    ).toBe(CHECK_VIOLATION)
    expect(
      await sqlstateOf(db, `update public.recurrences set reconstruct_from = '-infinity' where id = '${RULE}'`),
    ).toBe(CHECK_VIOLATION)
    expect((await floor()).reconstruct_from).toBe('2026-06-01')
  })

  it('moving the floor FORWARDS is rejected — it would hide occurrences', async () => {
    expect(
      await sqlstateOf(db, `update public.recurrences set reconstruct_from = '2030-01-01' where id = '${RULE}'`),
    ).toBe(CHECK_VIOLATION)
    expect(
      await sqlstateOf(db, `update public.recurrences set reconstruct_from = 'infinity' where id = '${RULE}'`),
    ).toBe(CHECK_VIOLATION)
    expect((await floor()).reconstruct_from).toBe('2026-06-01')
  })

  it('smuggling it inside a legitimate update is rejected too, and rolls the whole write back', async () => {
    // This case asserts that the LEGITIMATE half of the statement does not land
    // either. That only means something if the amount it must stay at is
    // distinctive, so the case writes its own marker instead of relying on a
    // value some earlier test happened to leave behind.
    await db.exec(`update public.recurrences set amount = 777 where id = '${RULE}'`)
    expect((await floor()).amount).toBe('777.00')

    expect(
      await sqlstateOf(
        db,
        `update public.recurrences set amount = 1, reconstruct_from = '2020-01-01' where id = '${RULE}'`,
      ),
    ).toBe(CHECK_VIOLATION)

    const after = await floor()
    expect(after.reconstruct_from).toBe('2026-06-01')
    expect(after.amount).toBe('777.00')
  })

  it('rewriting it to the SAME value is a no-op, not an error', async () => {
    // The guard rejects a CHANGE, not the column appearing in an UPDATE: a client
    // that sends the whole row back unchanged must not break.
    expect(
      await sqlstateOf(db, `update public.recurrences set reconstruct_from = '2026-06-01' where id = '${RULE}'`),
    ).toBeNull()
    expect((await floor()).reconstruct_from).toBe('2026-06-01')
  })

  it('pausing a rule does not move its floor', async () => {
    await db.exec(`update public.recurrences set status = 'paused' where id = '${RULE}'`)
    expect((await floor()).reconstruct_from).toBe('2026-06-01')
  })
})
