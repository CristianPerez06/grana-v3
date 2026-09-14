import type { PGlite } from '@electric-sql/pglite'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  generateDueRecurrenceInstances,
  getDuplicateRulesFor,
  getRecurrences,
} from '../src/queries'
import {
  actAs,
  actAsAdmin,
  applyActivation,
  createRecurrenceIdentityDb,
  U_A,
} from './support/recurrence-identity-db'
import { pglitePostgrest } from './support/pglite-postgrest'

/**
 * THE WIRING, not the calculation.
 *
 * The calculation has its own tests in `@grana/money-logic`, and they passed
 * while production was still broken: they built the schedule versions by hand,
 * so the walker got a column the real query never selected and a floor the real
 * mapper never copied. A test that constructs its own inputs proves the function
 * and nothing about the path that feeds it.
 *
 * So everything here goes through the SHIPPED reads — the generator's query, the
 * hub's mapper, the duplicate detector — against a real Postgres, with the gap
 * created the way the app creates it: by calling the RPC.
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

/**
 * A monthly rule anchored on the 8th, its floor just before it, and its anchor
 * then corrected to the 10th with the LATER candidate chosen — which is what
 * opens a gap: the old schedule stops today, the new one starts next cycle.
 * Returns the rule id and the two dates that bound the gap.
 */
async function ruleWithAGap(): Promise<{ id: string; gapEnds: string; opens: string }> {
  const id = `00000000-0000-4000-8000-00000000f1${(seq++).toString(16).padStart(2, '0')}`
  await actAsAdmin(db)
  await db.exec(`
    insert into public.recurrences
      (id, user_id, start_date, interval_count, interval_unit, status, amount, currency_code,
       movement_type, account_id, last_generated_date)
    values ('${id}', '${U_A}', '2026-06-08', 1, 'month', 'active', 1000, 'ARS', 'expense', null,
            ((now() at time zone 'America/Argentina/Buenos_Aires')::date));
  `)
  // The floor lands on today because the rule is seeded as if it had already
  // generated up to here: its backlog is not the subject — the gap is — and a
  // rule that also owed June to September would answer with noise. Case C, where
  // the backlog keeps the old dates, has its own test. It is set at INSERT
  // because the floor is immutable once derived, which 0064 enforces.
  await actAs(db, U_A)

  const { rows } = await db.query<{ effective_from: string }>(
    `select effective_from::text from public.recurrence_candidate_effective_dates(
       '2026-06-10'::date, 1, 'month',
       ((now() at time zone 'America/Argentina/Buenos_Aires')::date))`,
  )
  const opens = rows[1].effective_from
  await db.exec(`
    select public.update_recurrence_schedule('${id}'::uuid,
      jsonb_build_object('start_date', '2026-06-10'), '${opens}'::date);
  `)
  return { id, gapEnds: await today(), opens }
}

describe('the generator, through its own query', () => {
  it('owes nothing inside the gap', async () => {
    // The old schedule fires on the 8th and there is one of those inside the
    // stretch. If `effective_until` does not reach the walker — and it only
    // reaches it through the SELECT — this creates it.
    const { id, opens } = await ruleWithAGap()
    const result = await generateDueRecurrenceInstances(supabase, U_A, {
      today: shift(opens, -1),
    })
    expect(result.error).toBeNull()

    await actAsAdmin(db)
    const { rows } = await db.query<{ due_date: string }>(
      `select due_date::text from public.recurrence_instances
        where recurrence_id = '${id}' order by due_date`,
    )
    await actAs(db, U_A)
    expect(rows.map((r) => r.due_date)).toEqual([])
  })

  it('owes the corrected date once the new schedule rules', async () => {
    const { id, opens } = await ruleWithAGap()
    const result = await generateDueRecurrenceInstances(supabase, U_A, { today: opens })
    expect(result.error).toBeNull()

    await actAsAdmin(db)
    const { rows } = await db.query<{ due_date: string }>(
      `select due_date::text from public.recurrence_instances
        where recurrence_id = '${id}' order by due_date`,
    )
    await actAs(db, U_A)
    expect(rows.map((r) => r.due_date)).toEqual([opens])
  })
})

describe('what the hub says, through its own mapper', () => {
  it('announces the first date of the new schedule, not one from the gap', async () => {
    // `next_occurrence` is built in the mapper from an object literal. The floor
    // lives on the rule row; if the mapper does not copy it across, this answers
    // with a date inside the gap.
    const { id, opens } = await ruleWithAGap()
    const rules = await getRecurrences(supabase, { statuses: ['active'] })
    const rule = rules.find((r) => r.id === id)
    expect(rule?.next_occurrence).toBe(opens)
  })
})

describe('a spent cap survives the anchor moving, through the real read', () => {
  it('stops announcing once the cuotas the new anchor inherited are gone', async () => {
    // Nine cuotas on the 25th since January; eight are behind us. The user
    // corrects the reference date to the 27th OF THIS CYCLE, which is what the
    // form offers — so the rule's calendar gets a new origin near today, and the
    // position it sits at under that origin is ZERO. The generator composes both
    // anchors and knows one cuota is left; a reader that counts the cap from the
    // anchor it can see starts the nine over again.
    //
    // The old fixture shifted the anchor by two days within the same month,
    // where the new origin's index happens to equal what was already spent — it
    // agreed with the bug and proved nothing.
    const id = `00000000-0000-4000-8000-00000000f2${(seq++).toString(16).padStart(2, '0')}`
    await actAsAdmin(db)
    await db.exec(`
      insert into public.recurrences
        (id, user_id, start_date, interval_count, interval_unit, status, amount, currency_code,
         movement_type, max_occurrences, last_generated_date)
      values ('${id}', '${U_A}', '2026-01-25', 1, 'month', 'active', 1000, 'ARS', 'expense', 9,
              ((now() at time zone 'America/Argentina/Buenos_Aires')::date));
    `)
    await actAs(db, U_A)

    const corrected = `${(await today()).slice(0, 7)}-27`
    const { rows: candidates } = await db.query<{ effective_from: string }>(
      `select effective_from::text from public.recurrence_candidate_effective_dates(
         '${corrected}'::date, 1, 'month',
         ((now() at time zone 'America/Argentina/Buenos_Aires')::date))`,
    )
    await db.exec(`
      select public.update_recurrence_schedule('${id}'::uuid,
        jsonb_build_object('start_date', '${corrected}'), '${candidates[0].effective_from}'::date);
    `)

    await actAsAdmin(db)
    const { rows } = await db.query<{ n: number }>(
      `select schedule_positions_before as n from public.recurrences where id = '${id}'`,
    )
    // January through August on the 25th, spent under the anchor the rule no
    // longer has — and invisible to anything that walks only the new one.
    expect(Number(rows[0].n)).toBe(8)

    // The ninth and last, materialized.
    await db.exec(`
      insert into public.recurrence_instances
        (recurrence_id, user_id, due_date, scheduled_date, status, amount, currency_code)
      values ('${id}', '${U_A}', '${candidates[0].effective_from}',
              '${candidates[0].effective_from}', 'pending', 1000, 'ARS');
    `)
    await actAs(db, U_A)

    const rules = await getRecurrences(supabase, { statuses: ['active'] })
    // Nine cuotas exist. There is no tenth.
    expect(rules.find((r) => r.id === id)?.next_occurrence).toBeNull()
  })
})

describe('the duplicate detector, through its own query', () => {
  it('compares against a date that will actually exist', async () => {
    // It selects its columns one by one, so the floor has to be named there too.
    // Without it the warning is computed against an occurrence nobody will create.
    const { id, opens } = await ruleWithAGap()
    const matches = await getDuplicateRulesFor(supabase, {
      account_id: null,
      currency_code: 'ARS',
      movement_type: 'expense',
      amount: 1000,
    })
    const match = matches.find((m) => m.id === id)
    expect(match?.next_occurrence).toBe(opens)
  })
})
