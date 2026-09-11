import type { PGlite } from '@electric-sql/pglite'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { generateDueRecurrenceInstances, getRecurrenceDetail } from '../src/queries'
import { actAs, actAsAdmin, applyActivation, createRecurrenceIdentityDb, U_A } from './support/recurrence-identity-db'
import { pglitePostgrest } from './support/pglite-postgrest'

/**
 * A CORRECTED ANCHOR AND A DELETED SEED, end to end (#121).
 *
 * These two features were built against the same premise from opposite sides,
 * and the premise stopped being true:
 *
 *   · a rule created from a movement covers ONE occurrence with no instance row
 *     — the movement itself — and that occurrence was read off `start_date`;
 *   · correcting a reference date MOVES `start_date`.
 *
 * From the moment both exist, deleting the seed of a corrected rule computes its
 * floor from an occurrence the movement never covered, 0064's guard rejects the
 * transition, and the movement can no longer be deleted AT ALL. Which is worse
 * than a wrong number: a user with a mistyped future movement is stuck with it.
 *
 * So the sequence runs whole, against a real Postgres, through the same RPCs the
 * app calls — create from a future movement, correct the anchor, delete the
 * seed — and then asks the generator what it owes.
 */

let db: PGlite
let supabase: ReturnType<typeof pglitePostgrest>

beforeAll(async () => {
  db = await createRecurrenceIdentityDb()
  await applyActivation(db)
  supabase = pglitePostgrest(db, U_A)
}, 120_000)

afterAll(async () => {
  await db?.close()
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
const nextId = (prefix: string) =>
  `00000000-0000-4000-8000-0000000${prefix}${(seq++).toString(16).padStart(4, '0')}`

type Seeded = { ruleId: string; txId: string; seedDate: string; anchor: string }

/**
 * What `createRecurrenceFromMovement` writes, with the movement dated in the
 * FUTURE — the only case where deleting the seed has to release anything.
 * `last_generated_date` is set at INSERT because the floor derives from it and
 * is immutable afterwards.
 */
async function seededFromAFutureMovement(): Promise<Seeded> {
  const ruleId = nextId('a')
  const txId = nextId('b')
  const seedDate = shift(await today(), 12)

  await actAsAdmin(db)
  await db.exec(`
    insert into public.transactions (id, user_id, date, amount)
    values ('${txId}', '${U_A}', '${seedDate}', 1000);
    insert into public.recurrences
      (id, user_id, start_date, interval_count, interval_unit, status, amount, currency_code,
       movement_type, last_generated_date, created_from_transaction_id)
    values ('${ruleId}', '${U_A}', '${seedDate}', 1, 'month', 'active', 1000, 'ARS', 'expense',
            '${seedDate}', '${txId}');
  `)
  await actAs(db, U_A)
  return { ruleId, txId, seedDate, anchor: seedDate }
}

const ruleRow = async (id: string) => {
  await actAsAdmin(db)
  const { rows } = await db.query<{
    start_date: string
    seed_occurrence_date: string | null
    reconstruct_from: string
    schedule_effective_from: string
    created_from_transaction_id: string | null
  }>(
    `select start_date::text, seed_occurrence_date::text, reconstruct_from::text,
            schedule_effective_from::text, created_from_transaction_id
       from public.recurrences where id = '${id}'`,
  )
  await actAs(db, U_A)
  return rows[0]
}

const transactionExists = async (id: string): Promise<boolean> => {
  await actAsAdmin(db)
  const { rows } = await db.query(`select 1 from public.transactions where id = '${id}'`)
  await actAs(db, U_A)
  return rows.length === 1
}

/** Correct the anchor by `days`, taking effect on the first date offered. */
async function correctAnchor(seeded: Seeded, days: number): Promise<string> {
  const anchor = shift(seeded.anchor, days)
  const { rows } = await db.query<{ effective_from: string }>(
    `select effective_from::text from public.recurrence_candidate_effective_dates(
       '${anchor}'::date, 1, 'month', ((now() at time zone 'America/Argentina/Buenos_Aires')::date))`,
  )
  const chosen = rows[0].effective_from
  await db.exec(`
    select public.update_recurrence_schedule('${seeded.ruleId}'::uuid,
      jsonb_build_object('start_date', '${anchor}'), '${chosen}'::date);
  `)
  seeded.anchor = anchor
  return chosen
}

const deleteSeed = (txId: string) =>
  db.exec(`select public.delete_movement_unlinking_seed('${txId}'::uuid);`)

describe('the occurrence the seed covers keeps its own identity', () => {
  it('records it at creation and does not follow the anchor', async () => {
    const seeded = await seededFromAFutureMovement()
    expect((await ruleRow(seeded.ruleId)).seed_occurrence_date).toBe(seeded.seedDate)

    const chosen = await correctAnchor(seeded, 2)
    const after = await ruleRow(seeded.ruleId)
    expect(after.start_date).toBe(seeded.anchor)
    expect(after.schedule_effective_from).toBe(chosen)
    // The anchor moved; the occurrence the movement covers did not.
    expect(after.seed_occurrence_date).toBe(seeded.seedDate)
  })

  it('refuses a write that tries to move it', async () => {
    const seeded = await seededFromAFutureMovement()
    await expect(
      db.exec(`
        update public.recurrences set seed_occurrence_date = '2026-01-01'
         where id = '${seeded.ruleId}';
      `),
    ).rejects.toThrow(/seed_occurrence_date is immutable/)
  })
})

describe('the link and the date it implies cannot come apart', () => {
  it('refuses to point an existing rule at a different movement', async () => {
    const seeded = await seededFromAFutureMovement()
    const otherTx = nextId('d')
    await actAsAdmin(db)
    await db.exec(`
      insert into public.transactions (id, user_id, date, amount)
      values ('${otherTx}', '${U_A}', '${seeded.seedDate}', 1000);
    `)
    await actAs(db, U_A)

    await expect(
      db.exec(`
        update public.recurrences set created_from_transaction_id = '${otherTx}'
         where id = '${seeded.ruleId}';
      `),
    ).rejects.toThrow(/cannot be introduced or replaced/)
  })

  it('refuses to seed a rule that was never seeded', async () => {
    // The seed date is frozen at birth, so a link attached later names an
    // occurrence this rule never covered — and no write can put the date right.
    const plain = nextId('e')
    const tx = nextId('f')
    await actAsAdmin(db)
    await db.exec(`
      insert into public.transactions (id, user_id, date, amount)
      values ('${tx}', '${U_A}', '${await today()}', 1000);
      insert into public.recurrences
        (id, user_id, start_date, interval_count, interval_unit, status, amount, currency_code, movement_type)
      values ('${plain}', '${U_A}', '2026-06-08', 1, 'month', 'active', 1000, 'ARS', 'expense');
    `)
    await actAs(db, U_A)

    await expect(
      db.exec(`
        update public.recurrences set created_from_transaction_id = '${tx}' where id = '${plain}';
      `),
    ).rejects.toThrow(/cannot be introduced or replaced/)
  })

  it('the table refuses the broken pair even with the trigger out of the way', async () => {
    // The second line of defence, and the reason it exists: a trigger rules over
    // WRITES, and 0064 itself documents disabling one around a migration as a
    // legitimate move. A linked rule with no seed date is the row every reader
    // of `coveredOccurrences` misreads, so the table must not hold it at all.
    const seeded = await seededFromAFutureMovement()
    await actAsAdmin(db)
    await db.exec(`alter table public.recurrences disable trigger trg_recurrence_reconstruct_from_guard;`)
    try {
      await expect(
        db.exec(`
          update public.recurrences set seed_occurrence_date = null where id = '${seeded.ruleId}';
        `),
      ).rejects.toThrow(/chk_recurrences_seed_pair/)
    } finally {
      await db.exec(`alter table public.recurrences enable trigger trg_recurrence_reconstruct_from_guard;`)
      await actAs(db, U_A)
    }
  })
})

describe('the cap counts positions, and rows are not positions', () => {
  it('counts the occurrence the seed movement covers, which has no row', async () => {
    // The case that makes the difference visible: a rule seeded by a movement
    // has one occurrence and zero `recurrence_instances`. Counting rows says
    // nothing is spent.
    const seeded = await seededFromAFutureMovement()
    await actAsAdmin(db)
    const { rows: instances } = await db.query(
      `select 1 from public.recurrence_instances where recurrence_id = '${seeded.ruleId}'`,
    )
    // The seed is dated ahead, so the calendar has not reached it yet: what is
    // spent is everything up to today, and there is no row for any of it.
    const { rows } = await db.query<{ n: number }>(
      `select public.recurrence_positions_spent('${seeded.ruleId}'::uuid,
         '${shift(seeded.seedDate, 1)}'::date) as n`,
    )
    await actAs(db, U_A)
    expect(instances).toHaveLength(0)
    expect(Number(rows[0].n)).toBe(1)
  })

  it('counts a position the calendar produced while nothing was generating', async () => {
    // A rule whose dates came and went with no generator run. Every position is
    // spent; not one has a row.
    const idle = nextId('8')
    await actAsAdmin(db)
    await db.exec(`
      insert into public.recurrences
        (id, user_id, start_date, interval_count, interval_unit, status, amount, currency_code, movement_type)
      values ('${idle}', '${U_A}', '2026-01-10', 1, 'month', 'active', 1000, 'ARS', 'expense');
    `)
    const { rows } = await db.query<{ n: number }>(
      `select public.recurrence_positions_spent('${idle}'::uuid, '2026-04-15'::date) as n`,
    )
    await actAs(db, U_A)
    // 10/01, 10/02, 10/03 and 10/04 — four positions, zero rows.
    expect(Number(rows[0].n)).toBe(4)
  })
})

describe('what the edit screen is handed, through its own read', () => {
  it('carries the database\'s count and not the length of the history list', async () => {
    // The form builds its offer from this number. Handed `instances.length` it
    // believes a rule with a cap still has occurrences left — which is the whole
    // defect, and it is invisible unless the read itself is exercised.
    const idle = nextId('6')
    await actAsAdmin(db)
    await db.exec(`
      insert into public.recurrences
        (id, user_id, start_date, interval_count, interval_unit, status, amount, currency_code, movement_type)
      values ('${idle}', '${U_A}', '2026-01-10', 1, 'month', 'active', 1000, 'ARS', 'expense');
    `)
    const { rows } = await db.query<{ n: number }>(
      `select public.recurrence_positions_spent('${idle}'::uuid,
         ((now() at time zone 'America/Argentina/Buenos_Aires')::date)) as n`,
    )
    await actAs(db, U_A)

    const detail = await getRecurrenceDetail(supabase, idle)
    expect(detail?.instances).toHaveLength(0)
    expect(detail?.positions_spent).toBe(Number(rows[0].n))
    // The two numbers must not be the same one: with no rows at all, a read that
    // counted them would answer zero.
    expect(detail?.positions_spent).toBeGreaterThan(0)
  })
})

describe('the RPC validates against positions too', () => {
  it('refuses a reference date for a rule whose cap the calendar already spent', async () => {
    // Six cuotas anchored back in January and NOT ONE materialized: by rows the
    // rule looks untouched and the server hands out reference dates for cuotas
    // that will never exist. By positions it is finished.
    const spent = nextId('7')
    await actAsAdmin(db)
    await db.exec(`
      insert into public.recurrences
        (id, user_id, start_date, interval_count, interval_unit, status, amount, currency_code,
         movement_type, max_occurrences)
      values ('${spent}', '${U_A}', '2026-01-10', 1, 'month', 'active', 1000, 'ARS', 'expense', 3);
    `)
    await actAs(db, U_A)

    const { rows } = await db.query<{ effective_from: string }>(
      `select effective_from::text from public.recurrence_candidate_effective_dates(
         '2026-06-12'::date, 1, 'month', ((now() at time zone 'America/Argentina/Buenos_Aires')::date))`,
    )
    // A date the CALENDAR produces, so only the cap can be the reason it is
    // refused: this fails for the right reason or not at all.
    await expect(
      db.exec(`
        select public.update_recurrence_schedule('${spent}'::uuid,
          jsonb_build_object('start_date', '2026-06-12'), '${rows[0].effective_from}'::date);
      `),
    ).rejects.toThrow(/is not one of the next occurrences/)
  })
})

describe('the floor a row lands on when nothing decides it', () => {
  it('suppresses rather than projects', async () => {
    // Reached only when the trigger is gone, disabled or bypassed — exactly when
    // a wrong value goes unnoticed. A card showing nothing gets reported; a card
    // announcing vencimientos nobody will owe gets believed.
    const bypassed = nextId('9')
    await actAsAdmin(db)
    await db.exec(`alter table public.recurrences disable trigger trg_recurrence_resolve_schedule_effective_from;`)
    try {
      await db.exec(`
        insert into public.recurrences
          (id, user_id, start_date, interval_count, interval_unit, status, amount, currency_code, movement_type)
        values ('${bypassed}', '${U_A}', '2026-06-08', 1, 'month', 'active', 1000, 'ARS', 'expense');
      `)
    } finally {
      await db.exec(`alter table public.recurrences enable trigger trg_recurrence_resolve_schedule_effective_from;`)
    }
    const { rows } = await db.query<{ f: string }>(
      `select schedule_effective_from::text as f from public.recurrences where id = '${bypassed}'`,
    )
    await actAs(db, U_A)
    expect(rows[0].f).toBe('9999-12-31')
  })
})

describe('deleting the seed of a rule whose reference date was corrected', () => {
  it('goes through, and releases the floor the SEED established', async () => {
    const seeded = await seededFromAFutureMovement()
    await correctAnchor(seeded, 2)

    await deleteSeed(seeded.txId)

    const after = await ruleRow(seeded.ruleId)
    expect(await transactionExists(seeded.txId)).toBe(false)
    expect(after.created_from_transaction_id).toBeNull()
    // The day before the occurrence the movement covered — NOT the day before
    // the corrected anchor, which is a date the movement never covered.
    expect(after.reconstruct_from).toBe(shift(seeded.seedDate, -1))
    expect(after.start_date).toBe(seeded.anchor)
  })

  it('materializes the corrected date once, and the old one never', async () => {
    const seeded = await seededFromAFutureMovement()
    const chosen = await correctAnchor(seeded, 2)
    await deleteSeed(seeded.txId)

    // Standing on the corrected date, twice: the generator is asked the same
    // question again to prove the released floor did not turn into a backlog.
    await generateDueRecurrenceInstances(supabase, U_A, { today: chosen })
    const result = await generateDueRecurrenceInstances(supabase, U_A, { today: chosen })
    expect(result.error).toBeNull()

    await actAsAdmin(db)
    const { rows } = await db.query<{ due_date: string }>(
      `select due_date::text from public.recurrence_instances
        where recurrence_id = '${seeded.ruleId}' order by due_date`,
    )
    await actAs(db, U_A)
    expect(rows.map((r) => r.due_date)).toEqual([chosen])
  })

  it('leaves NOTHING behind when the delete cannot go through', async () => {
    // Atomicity, with a failure the database itself produces: a second rule
    // seeded by the same movement holds the ON DELETE RESTRICT, so the unlink
    // and the release succeed and the DELETE does not. Either all three land or
    // none do — a half-applied repair is the defect 0065 exists for.
    const seeded = await seededFromAFutureMovement()
    await correctAnchor(seeded, 2)
    const otherRule = nextId('c')
    await actAsAdmin(db)
    await db.exec(`
      insert into public.recurrences
        (id, user_id, start_date, interval_count, interval_unit, status, amount, currency_code,
         movement_type, last_generated_date, created_from_transaction_id)
      values ('${otherRule}', '${U_A}', '${seeded.seedDate}', 1, 'month', 'active', 1000, 'ARS',
              'expense', '${seeded.seedDate}', '${seeded.txId}');
    `)
    await actAs(db, U_A)
    const before = await ruleRow(seeded.ruleId)

    await expect(deleteSeed(seeded.txId)).rejects.toThrow()

    expect(await transactionExists(seeded.txId)).toBe(true)
    const after = await ruleRow(seeded.ruleId)
    expect(after.created_from_transaction_id).toBe(before.created_from_transaction_id)
    expect(after.reconstruct_from).toBe(before.reconstruct_from)
  })
})
