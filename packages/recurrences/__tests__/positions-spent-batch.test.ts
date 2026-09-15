import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { PGlite } from '@electric-sql/pglite'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { getRecurrences } from '../src/queries'
import {
  actAs,
  actAsAdmin,
  applyPositionsBatch,
  createRecurrenceIdentityDb,
  U_A,
  U_B,
} from './support/recurrence-identity-db'
import { pglitePostgrest } from './support/pglite-postgrest'

/**
 * 0070 — the spent positions of many rules in ONE round trip.
 *
 * Two things are pinned here, and they are different in kind:
 *
 *   · PARITY. The batch must answer exactly what `recurrence_positions_spent`
 *     answers, rule by rule, for rules of every shape the model allows. It is a
 *     second way to ASK, never a second way to COUNT — a copy of the walk would
 *     drift, and this number decides whether a rule goes on reminding someone
 *     about money.
 *   · THE FRONTIER. The function receives a LIST OF IDS. A `security definer`
 *     would hand back the progress of anyone's rule to whoever guessed a uuid,
 *     and Postgres grants EXECUTE to PUBLIC unless told otherwise. The harness
 *     runs with the real `authenticated` and `anon` roles, so both can be asked
 *     rather than reasoned about.
 */

const TODAY = '2026-09-15'

/** One id per shape, so a mismatch names the shape that broke. */
const PLAIN = '00000000-0000-4000-8000-00000000e001'
const SEEDED = '00000000-0000-4000-8000-00000000e002'
const CORRECTED = '00000000-0000-4000-8000-00000000e003'
const PAUSED = '00000000-0000-4000-8000-00000000e004'
const UNCAPPED = '00000000-0000-4000-8000-00000000e005'
const OTHERS = '00000000-0000-4000-8000-00000000e006'
const SEED_TX = '00000000-0000-4000-8000-00000000e0aa'

const ALL = [PLAIN, SEEDED, CORRECTED, PAUSED, UNCAPPED, OTHERS]

/**
 * Rules of five different shapes for one user, plus one belonging to another.
 *
 * Built through the real write paths where the shape depends on them: the anchor
 * correction is an `update`, so 0068's trigger opens the second schedule version
 * exactly as it does in production. Hand-writing the versions would test a
 * history the database cannot produce.
 */
async function database(): Promise<PGlite> {
  const db = await createRecurrenceIdentityDb()

  const rule = (id: string, user: string, start: string, max: number | null) => `
    insert into public.recurrences
      (id, user_id, start_date, interval_count, interval_unit, status, amount,
       currency_code, movement_type, max_occurrences)
    values ('${id}', '${user}', '${start}', 1, 'month', 'active', 1000, 'ARS', 'expense',
            ${max == null ? 'null' : max});
  `

  // Deliberately different lives, so the parity assertion below discriminates:
  // if every shape spent the same number of positions, comparing the two ways of
  // asking would pass on a fixture that proves nothing.
  await db.exec(rule(PLAIN, U_A, '2026-03-10', 11))
  await db.exec(rule(CORRECTED, U_A, '2026-03-10', 11))
  await db.exec(rule(PAUSED, U_A, '2026-01-10', 11))
  await db.exec(rule(UNCAPPED, U_A, '2026-06-10', null))
  await db.exec(rule(OTHERS, U_B, '2026-03-10', 11))

  // Seeded from a movement: its first occurrence has no instance row, which is
  // the whole reason this count cannot be a `count(*)`.
  await db.exec(`
    insert into public.transactions (id, user_id, date, amount)
    values ('${SEED_TX}', '${U_A}', '2026-07-10', 1000);
  `)
  await db.exec(`
    insert into public.recurrences
      (id, user_id, start_date, interval_count, interval_unit, status, amount,
       currency_code, movement_type, max_occurrences, last_generated_date,
       created_from_transaction_id)
    values ('${SEEDED}', '${U_A}', '2026-07-10', 1, 'month', 'active', 1000, 'ARS', 'expense',
            3, '2026-07-10', '${SEED_TX}');
  `)

  // The anchor correction, through the only door there is: a plain `update` of
  // `start_date` is refused since 0068, because moving an anchor has to say from
  // when. This is what leaves `schedule_positions_before` carrying the positions
  // spent under the old anchor — the shape the batch must not get wrong.
  await actAs(db, U_A)
  await db.exec(`
    select public.update_recurrence_schedule(
      '${CORRECTED}'::uuid, jsonb_build_object('start_date', '2026-05-08'::date), '2026-10-08'::date
    );
  `)
  await actAsAdmin(db)
  await db.exec(`update public.recurrences set status = 'paused' where id = '${PAUSED}';`)

  return db
}

/** What the function under test says, as a map. */
async function batch(db: PGlite, ids: string[], today = TODAY) {
  const { rows } = await db.query<{ recurrence_id: string; positions_spent: number }>(
    `select recurrence_id::text, positions_spent
       from public.recurrence_positions_spent_batch($1::uuid[], $2::date)`,
    [ids, today],
  )
  return new Map(rows.map((row) => [row.recurrence_id, row.positions_spent]))
}

/** What asking one rule at a time says — the definition the batch must not restate. */
async function oneByOne(db: PGlite, ids: string[], today = TODAY) {
  const out = new Map<string, number>()
  for (const id of ids) {
    const { rows } = await db.query<{ spent: number }>(
      `select public.recurrence_positions_spent($1::uuid, $2::date) as spent`,
      [id, today],
    )
    out.set(id, rows[0].spent)
  }
  return out
}

/**
 * ONE database, built in the HOOK.
 *
 * Booting Postgres is seconds, and this suite's `testTimeout` is 5s on purpose:
 * a slow test BODY here means a hang, not a cold start. `beforeEach` puts the
 * session back to the superuser so a test that switched roles cannot leak into
 * the next one.
 */
let db: PGlite

beforeAll(async () => {
  db = await database()
})

beforeEach(async () => {
  await actAsAdmin(db)
})

afterAll(async () => {
  await db.close()
})

describe('0070 — the batch agrees with the individual function', () => {
  it('rule by rule, across every shape', async () => {
    const mine = ALL.filter((id) => id !== OTHERS)

    await actAs(db, U_A)
    const asked = await batch(db, mine)
    const expected = await oneByOne(db, mine)

    expect(asked).toEqual(expected)
    // And the fixture is not accidentally uniform: if every shape answered the
    // same number, the comparison above would pass without discriminating.
    expect(new Set(expected.values()).size).toBeGreaterThan(1)

  })

  it('reports the seeded rule’s first occurrence, which has no instance row', async () => {
    await actAs(db, U_A)

    const asked = await batch(db, [SEEDED])
    const { rows } = await db.query<{ n: number }>(
      `select count(*)::int as n from public.recurrence_instances where recurrence_id = '${SEEDED}'`,
    )

    // Three positions since July — the plan is spent — and not one of them is
    // materialized. A count of rows would say zero and go on offering cuotas the
    // user already paid.
    expect(rows[0].n).toBe(0)
    expect(asked.get(SEEDED)).toBe(3)

  })

  it('answers for the ids given, and nothing else', async () => {
    await actAs(db, U_A)

    const asked = await batch(db, [PLAIN, PAUSED])

    expect([...asked.keys()].sort()).toEqual([PLAIN, PAUSED].sort())

  })
})

describe('0070 — the frontier', () => {
  it('returns nothing for another user’s rules, rather than their progress', async () => {

    // The other user's rule exists and has spent positions: asked as its owner,
    // the number is there to leak.
    await actAs(db, U_B)
    expect(await batch(db, [OTHERS])).toEqual(new Map([[OTHERS, expect.any(Number)]]))

    await actAsAdmin(db)
    await actAs(db, U_A)
    const asked = await batch(db, [...ALL])

    // Asked by someone else, the row is simply not there — `security invoker` is
    // what makes the caller's RLS the authorization, and a definer would have
    // answered.
    expect(asked.has(OTHERS)).toBe(false)
    expect(asked.size).toBe(ALL.length - 1)

  })

  it('cannot be executed by anon', async () => {
    await db.exec(`set role anon;`)

    await expect(batch(db, [PLAIN])).rejects.toMatchObject({ code: '42501' })

  })

  it('is declared security invoker, not definer', async () => {
    const { rows } = await db.query<{ prosecdef: boolean; provolatile: string }>(
      `select prosecdef, provolatile from pg_proc
        where proname = 'recurrence_positions_spent_batch'`,
    )

    expect(rows[0].prosecdef).toBe(false)
    expect(rows[0].provolatile).toBe('s')

  })
})

/**
 * The section of `validate_schema.sql` that pins this function, LIFTED AND RUN.
 *
 * A validator nobody executes is a validator that drifts — 8.1J's check was
 * wrong twice in opposite directions before anyone noticed. This block needs
 * only `pg_proc` and the privilege functions, so it runs for real here instead
 * of being read and believed.
 */
function contractOfValidateSchema(): string {
  const sql = readFileSync(
    resolve(__dirname, '../../../supabase/validate_schema.sql'),
    'utf-8',
  )
  const open = sql.indexOf('-- ┌── BEGIN 8.1M CONTRACT')
  const close = sql.indexOf('-- └── END 8.1M CONTRACT')
  if (open < 0 || close < 0) throw new Error('8.1M moved: update this extraction')
  // The WHOLE block, declarations included. Rebuilding the `declare` here would
  // be a second copy of the section's variables, free to drift from the one the
  // validator actually runs — which is the thing this lift exists to prevent.
  return sql.slice(open, close)
}

describe('validate_schema.sql 8.1M', () => {
  it('passes against the schema 0070 produces', async () => {
    await expect(db.exec(contractOfValidateSchema())).resolves.toBeDefined()
  })

  it('REFUSES a database where the function is missing', async () => {
    // `scheduleGap: false` stops the default chain before 0070 is applied, which
    // is the only way to ask what the validator says about a database that
    // predates it.
    const bare = await createRecurrenceIdentityDb({ scheduleGap: false })
    try {
      await expect(bare.exec(contractOfValidateSchema())).rejects.toThrow(
        /recurrence_positions_spent_batch is missing/,
      )
    } finally {
      await bare.close()
    }
  }, 60_000)

  it('REFUSES a security definer replacement', async () => {
    const swapped = await createRecurrenceIdentityDb()
    try {
      // The exact substitution the check exists for: same name, same signature,
      // same body — and RLS no longer applies to the ids it is handed.
      await swapped.exec(`
        create or replace function public.recurrence_positions_spent_batch(
          p_ids uuid[], p_today date
        ) returns table (recurrence_id uuid, positions_spent int)
        language sql stable security definer set search_path = public, pg_temp as $fn$
          select r.id, public.recurrence_positions_spent(r.id, p_today)
            from public.recurrences r where r.id = any(p_ids)
        $fn$;
      `)

      await expect(swapped.exec(contractOfValidateSchema())).rejects.toThrow(
        /is SECURITY DEFINER/,
      )
    } finally {
      await swapped.close()
    }
  }, 60_000)

  it('REFUSES a body that counts on its own instead of asking', async () => {
    const reimplemented = await createRecurrenceIdentityDb()
    try {
      // The drift the check exists for: a body that no longer defers to the one
      // definition of what `max_occurrences` counts.
      await reimplemented.exec(`
        create or replace function public.recurrence_positions_spent_batch(
          p_ids uuid[], p_today date
        ) returns table (recurrence_id uuid, positions_spent int)
        language sql stable security invoker set search_path = public, pg_temp as $fn$
          select r.id, (select count(*)::int from public.recurrence_instances i
                         where i.recurrence_id = r.id)
            from public.recurrences r where r.id = any(p_ids)
        $fn$;
      `)

      await expect(reimplemented.exec(contractOfValidateSchema())).rejects.toThrow(
        /no longer calls recurrence_positions_spent/,
      )
    } finally {
      await reimplemented.close()
    }
  }, 60_000)


  it('REFUSES a replacement whose two return columns are swapped', async () => {
    const swapped = await createRecurrenceIdentityDb()
    try {
      // Type-checks in every reader, and hands each rule's progress to another
      // rule. Nothing on screen would say so — which is why the shape is pinned
      // and not only the argument list.
      await swapped.exec(`
        drop function if exists public.recurrence_positions_spent_batch(uuid[], date);
        create function public.recurrence_positions_spent_batch(p_ids uuid[], p_today date)
        returns table (positions_spent int, recurrence_id uuid)
        language sql stable security invoker set search_path = public, pg_temp as $fn$
          select public.recurrence_positions_spent(r.id, p_today), r.id
            from public.recurrences r where r.id = any(p_ids)
        $fn$;
      `)

      await expect(swapped.exec(contractOfValidateSchema())).rejects.toThrow(
        /returns positions_spent integer, recurrence_id uuid/,
      )
    } finally {
      await swapped.close()
    }
  }, 60_000)

  it('REFUSES a VOLATILE replacement', async () => {
    const volatileOne = await createRecurrenceIdentityDb()
    try {
      await volatileOne.exec(`
        create or replace function public.recurrence_positions_spent_batch(
          p_ids uuid[], p_today date
        ) returns table (recurrence_id uuid, positions_spent int)
        language sql volatile security invoker set search_path = public, pg_temp as $fn$
          select r.id, public.recurrence_positions_spent(r.id, p_today)
            from public.recurrences r where r.id = any(p_ids)
        $fn$;
      `)

      await expect(volatileOne.exec(contractOfValidateSchema())).rejects.toThrow(/not STABLE/)
    } finally {
      await volatileOne.close()
    }
  }, 60_000)

  it('REFUSES the function left open to anon', async () => {
    await db.exec(
      `grant execute on function public.recurrence_positions_spent_batch(uuid[], date) to anon;`,
    )

    try {
      await expect(db.exec(contractOfValidateSchema())).rejects.toThrow(
        /anon conserva EXECUTE/,
      )
    } finally {
      await db.exec(
        `revoke execute on function public.recurrence_positions_spent_batch(uuid[], date) from anon;`,
      )
    }
  })

  it('REFUSES a replacement with search_path left open', async () => {
    const unpinned = await createRecurrenceIdentityDb()
    try {
      await unpinned.exec(`
        create or replace function public.recurrence_positions_spent_batch(
          p_ids uuid[], p_today date
        ) returns table (recurrence_id uuid, positions_spent int)
        language sql stable security invoker as $fn$
          select r.id, public.recurrence_positions_spent(r.id, p_today)
            from public.recurrences r where r.id = any(p_ids)
        $fn$;
      `)

      await expect(unpinned.exec(contractOfValidateSchema())).rejects.toThrow(
        /does not pin search_path/,
      )
    } finally {
      await unpinned.close()
    }
  }, 60_000)
})

/**
 * 0070 CHECKS ITSELF before it commits, and the check has to be able to fail.
 *
 * The migration is four statements — the function and three privilege
 * statements — and run loose a failure on the third leaves the function created
 * with EXECUTE still granted to PUBLIC, which is what Postgres does by default.
 * Wrapped in a transaction with this block at the end, either all four land or
 * none does.
 */
describe('0070’s own verification block', () => {
  /** The `do $verify$ … $verify$;` at the end of the migration, on its own. */
  function verifyBlockOfMigration(): string {
    const sql = readFileSync(
      resolve(__dirname, '../../../supabase/migrations/0070_recurrence_positions_spent_batch.sql'),
      'utf-8',
    )
    const open = sql.indexOf('do $verify$')
    const close = sql.indexOf('$verify$;')
    if (open < 0 || close < 0) throw new Error('0070’s verify block moved: update this extraction')
    return sql.slice(open, close + '$verify$;'.length)
  }

  it('passes on the database the migration produces', async () => {
    await expect(db.exec(verifyBlockOfMigration())).resolves.toBeDefined()
  })

  it('CATCHES the half-applied privileges it exists for', async () => {
    // The exact state a failed `revoke` would leave: the function created, and
    // EXECUTE still on PUBLIC because nobody took it away.
    await db.exec(
      `grant execute on function public.recurrence_positions_spent_batch(uuid[], date) to public;`,
    )

    try {
      // Either message is the right answer: a grant to PUBLIC reaches `anon`
      // too, so whichever of the two checks runs first is the one that speaks.
      // What matters is that the block refuses to commit.
      await expect(db.exec(verifyBlockOfMigration())).rejects.toThrow(/retains EXECUTE/)
    } finally {
      await db.exec(
        `revoke execute on function public.recurrence_positions_spent_batch(uuid[], date) from public;`,
      )
      await db.exec(
        `revoke execute on function public.recurrence_positions_spent_batch(uuid[], date) from anon;`,
      )
    }
  })

})

/**
 * THE WIRING, not the function.
 *
 * The reason 0070 exists is a number of round trips, so the thing to pin is the
 * number of round trips. A hub that went back to `recurrence_positions_spent`
 * per row would still be correct and still show the right states — and would
 * cost one request per rule, growing with how many rules the user has.
 */
describe('the hub asks once for the whole list', () => {
  it('makes ONE call for N rules, not N', async () => {
    await actAs(db, U_A)

    const calls: string[] = []
    const client = pglitePostgrest(db, U_A)
    const counted = {
      ...client,
      rpc: (name: string, args: Record<string, unknown>) => {
        calls.push(name)
        return client.rpc(name, args)
      },
    } as typeof client

    const rules = await getRecurrences(counted, { statuses: ['active', 'paused'] })

    // The fixture has to have enough rules for "one" and "one per rule" to be
    // different numbers at all.
    expect(rules.length).toBeGreaterThan(2)
    expect(calls.filter((name) => name === 'recurrence_positions_spent_batch')).toHaveLength(1)
    expect(calls.filter((name) => name === 'recurrence_positions_spent')).toHaveLength(0)
  })

  it('carries the count through to the state each rule is shown in', async () => {
    await actAs(db, U_A)

    const rules = await getRecurrences(pglitePostgrest(db, U_A), {
      statuses: ['active', 'paused'],
    })
    const seeded = rules.find((rule) => rule.id === SEEDED)

    // The rule whose three cuotas are spent, with no instance row to show for
    // any of them: the hub says finalizada, while `status` still says active.
    expect(seeded?.status).toBe('active')
    expect(seeded?.positions_spent).toBe(3)
    expect(seeded?.lifecycle.state).toBe('finished')
    expect(seeded?.lifecycle.progress).toEqual({ spent: 3, total: 3, remaining: 0 })

    // And the paused one is paused, not finished — its calendar has positions
    // ahead once it resumes, and the pause is why nothing is coming out.
    const paused = rules.find((rule) => rule.id === PAUSED)
    expect(paused?.lifecycle.state).toBe('paused')
    expect(paused?.last_expected_occurrence).toEqual({ kind: 'unknown-while-paused' })
  })
})

/**
 * AN INCOMPLETE ANSWER IS AN ERROR, NOT A ZERO.
 *
 * The ids handed to the batch were just read from `recurrences` as this same
 * caller, so it owes exactly one row for each. If a row went missing — drift, a
 * miswired call, a function replaced with a narrower one — reading it as zero
 * would produce a plausible screen instead of a failure: an exhausted rule
 * showing «0 de 11» and grouped with the active ones, which is the exact defect
 * this change exists to remove.
 */
describe('the hub refuses an answer it cannot trust', () => {
  const swapFunction = (body: string) =>
    db.exec(`
      create or replace function public.recurrence_positions_spent_batch(
        p_ids uuid[], p_today date
      ) returns table (recurrence_id uuid, positions_spent int)
      language sql stable security invoker set search_path = public, pg_temp as $fn$
        ${body}
      $fn$;
    `)

  const restore = () =>
    swapFunction(`
      select r.id, public.recurrence_positions_spent(r.id, p_today)
        from public.recurrences r where r.id = any(p_ids)
    `)

  it('fails when a rule is missing from the answer', async () => {
    await actAs(db, U_A)
    // One rule silently dropped — the shape a partial answer has.
    await actAsAdmin(db)
    await swapFunction(`
      select r.id, public.recurrence_positions_spent(r.id, p_today)
        from public.recurrences r
       where r.id = any(p_ids) and r.id <> '${PLAIN}'::uuid
    `)
    await actAs(db, U_A)

    try {
      await expect(
        getRecurrences(pglitePostgrest(db, U_A), { statuses: ['active', 'paused'] }),
      ).rejects.toThrow(/missing/)
    } finally {
      await actAsAdmin(db)
      await restore()
      await actAs(db, U_A)
    }
  })

  it('fails when a rule comes back twice', async () => {
    await actAsAdmin(db)
    await swapFunction(`
      select r.id, public.recurrence_positions_spent(r.id, p_today)
        from public.recurrences r, generate_series(1, 2)
       where r.id = any(p_ids)
    `)
    await actAs(db, U_A)

    try {
      await expect(
        getRecurrences(pglitePostgrest(db, U_A), { statuses: ['active', 'paused'] }),
      ).rejects.toThrow(/more than once/)
    } finally {
      await actAsAdmin(db)
      await restore()
      await actAs(db, U_A)
    }
  })

  it('fails when a count comes back null', async () => {
    await actAsAdmin(db)
    await swapFunction(`
      select r.id, null::int from public.recurrences r where r.id = any(p_ids)
    `)
    await actAs(db, U_A)

    try {
      await expect(
        getRecurrences(pglitePostgrest(db, U_A), { statuses: ['active', 'paused'] }),
      ).rejects.toThrow(/no count/)
    } finally {
      await actAsAdmin(db)
      await restore()
      await actAs(db, U_A)
    }
  })

  it('fails on a negative count, which the screen would otherwise disguise', async () => {
    await actAsAdmin(db)
    await swapFunction(`
      select r.id, -1 from public.recurrences r where r.id = any(p_ids)
    `)
    await actAs(db, U_A)

    try {
      // The progress shown saturates at zero and reads as a sober «0 de 11»,
      // while the last-expected date is walked from `max_occurrences - spent`
      // and projects ONE OCCURRENCE MORE than the rule has. A screen that is
      // believable and wrong is the thing this change exists to remove.
      await expect(
        getRecurrences(pglitePostgrest(db, U_A), { statuses: ['active', 'paused'] }),
      ).rejects.toThrow(/whole number and never negative/)
    } finally {
      await actAsAdmin(db)
      await restore()
      await actAs(db, U_A)
    }
  })

  it('fails when a rule nobody asked about comes back', async () => {
    await actAsAdmin(db)
    // Every rule in the table, the other user's included — the shape a function
    // that stopped filtering by `p_ids` would have.
    await swapFunction(`
      select r.id, public.recurrence_positions_spent(r.id, p_today)
        from public.recurrences r
    `)
    await actAsAdmin(db)
    await db.exec(`
      insert into public.recurrences
        (id, user_id, start_date, interval_count, interval_unit, status, amount,
         currency_code, movement_type)
      values ('00000000-0000-4000-8000-00000000e0ff', '${U_A}', '2026-03-10', 1, 'month',
              'deleted', 1000, 'ARS', 'expense');
    `)
    await actAs(db, U_A)

    try {
      // The hub asks about active and paused rules; a deleted one coming back
      // means the answer does not describe the question that was asked.
      await expect(
        getRecurrences(pglitePostgrest(db, U_A), { statuses: ['active', 'paused'] }),
      ).rejects.toThrow(/not asked about/)
    } finally {
      await actAsAdmin(db)
      await db.exec(
        `delete from public.recurrences where id = '00000000-0000-4000-8000-00000000e0ff';`,
      )
      await restore()
      await actAs(db, U_A)
    }
  })

  it('and reads normally again once the function is the real one', async () => {
    await actAs(db, U_A)
    const rules = await getRecurrences(pglitePostgrest(db, U_A), {
      statuses: ['active', 'paused'],
    })

    expect(rules.length).toBeGreaterThan(2)
  })
})
