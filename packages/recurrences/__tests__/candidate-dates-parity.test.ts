import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { PGlite } from '@electric-sql/pglite'
import { candidateEffectiveDates, occurrencePositionsSpent } from '@grana/money-logic'
import { applyEffectiveUntil, createRecurrenceIdentityDb, U_A } from './support/recurrence-identity-db'

/**
 * The client draws the question; the database refuses anything else. That only
 * works while the two agree on what the calendar produces — if they drift, the
 * form offers a date the server rejects, and correcting a reference date becomes
 * impossible for the schedules where they disagree.
 *
 * So both are asked the same thing, over a matrix that includes the shapes date
 * arithmetic gets wrong: month-end clamping, February, a leap year, and the
 * every-N-days phases that have no month to reason about.
 */

let db: PGlite

beforeAll(async () => {
  db = await createRecurrenceIdentityDb()
})

afterAll(async () => {
  await db.close()
})

const fromSql = async (args: {
  anchor: string
  count: number
  unit: string
  from: string
  endDate?: string | null
  remaining?: number | null
}): Promise<string[]> => {
  const { rows } = await db.query<{ effective_from: string }>(
    `select effective_from::text from public.recurrence_candidate_effective_dates(
       '${args.anchor}'::date, ${args.count}, '${args.unit}', '${args.from}'::date,
       ${args.endDate == null ? 'null' : `'${args.endDate}'::date`},
       ${args.remaining == null ? 'null' : args.remaining})`,
  )
  return rows.map((r) => r.effective_from)
}

const cases: Array<{
  name: string
  anchor: string
  count: number
  unit: 'day' | 'week' | 'month' | 'year'
  from: string
  endDate?: string | null
  remaining?: number | null
}> = [
  { name: 'monthly, mid-month', anchor: '2026-06-10', count: 1, unit: 'month', from: '2026-09-10' },
  { name: 'monthly, the day after', anchor: '2026-06-10', count: 1, unit: 'month', from: '2026-09-11' },
  { name: 'monthly on the 31st, into February', anchor: '2026-01-31', count: 1, unit: 'month', from: '2026-02-01' },
  { name: 'monthly on the 30th, February in a leap year', anchor: '2024-01-30', count: 1, unit: 'month', from: '2024-02-01' },
  { name: 'every 3 days', anchor: '2026-09-02', count: 3, unit: 'day', from: '2026-09-10' },
  { name: 'every 3 days, landing exactly on `from`', anchor: '2026-09-01', count: 3, unit: 'day', from: '2026-09-10' },
  { name: 'weekly', anchor: '2026-05-04', count: 1, unit: 'week', from: '2026-09-10' },
  { name: 'every two weeks', anchor: '2026-05-04', count: 2, unit: 'week', from: '2026-09-10' },
  { name: 'annual, on 29 February', anchor: '2024-02-29', count: 1, unit: 'year', from: '2026-01-01' },
  { name: 'bounded by end_date', anchor: '2026-06-10', count: 1, unit: 'month', from: '2026-09-10', endDate: '2026-09-30' },
  { name: 'end_date already past', anchor: '2026-06-10', count: 1, unit: 'month', from: '2026-09-10', endDate: '2026-01-01' },
  { name: 'one left on the cap', anchor: '2026-06-10', count: 1, unit: 'month', from: '2026-09-10', remaining: 1 },
  { name: 'cap already spent', anchor: '2026-06-10', count: 1, unit: 'month', from: '2026-09-10', remaining: 0 },
  { name: 'anchor far in the past', anchor: '2019-03-15', count: 1, unit: 'month', from: '2026-09-10' },
]

describe('the same two dates, in TypeScript and in SQL', () => {
  it.each(cases)('$name', async (testCase) => {
    const sql = await fromSql({
      anchor: testCase.anchor,
      count: testCase.count,
      unit: testCase.unit,
      from: testCase.from,
      endDate: testCase.endDate,
      remaining: testCase.remaining,
    })
    const js = candidateEffectiveDates(
      {
        anchor_date: testCase.anchor,
        interval_count: testCase.count,
        interval_unit: testCase.unit,
        end_date: testCase.endDate ?? null,
        remaining: testCase.remaining ?? null,
      },
      testCase.from,
    )
    expect(js).toEqual(sql)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// The other number both sides compute: how much of the cap is spent.
//
// `max_occurrences` counts POSITIONS of the calendar. Both sides used to count
// `recurrence_instances` rows instead, and agreed — which is why the parity
// above never caught it: two implementations sharing the same wrong input agree
// perfectly. So the cases below are built so that rows and positions DIFFER, and
// each is run through the generator's own walk in TypeScript and through the
// function the RPC validates with in SQL.
// ═══════════════════════════════════════════════════════════════════════════

type Version = {
  effective_from: string
  effective_until?: string | null
  anchor_date: string
  interval_count: number
  interval_unit: 'day' | 'week' | 'month' | 'year'
}

let parityRule = 0

const spentBothWays = async (setup: {
  versions: Version[]
  pauses?: Array<{ paused_from: string; resumed_at: string | null }>
  endDate?: string | null
  maxOccurrences?: number | null
  seedOccurrenceDate?: string | null
  today: string
}): Promise<{ ts: number; sql: number }> => {
  const id = `00000000-0000-4000-8000-00000000ca${(parityRule++).toString(16).padStart(2, '0')}`
  const first = [...setup.versions].sort((a, b) => a.effective_from.localeCompare(b.effective_from))[0]

  // The rule is inserted with the guards out of the way: these fixtures describe
  // histories the triggers build over time, and rebuilding each one through the
  // real edits would be testing the edits, not the count.
  await db.exec(`
    alter table public.recurrences disable trigger trg_recurrence_resolve_schedule_effective_from;
    alter table public.recurrences disable trigger trg_recurrence_sync_schedule_and_pauses;
    alter table public.recurrences disable trigger trg_recurrence_reconstruct_from_guard;
    insert into public.recurrences
      (id, user_id, start_date, interval_count, interval_unit, status, amount, currency_code,
       movement_type, end_date, max_occurrences, schedule_effective_from, seed_occurrence_date)
    values ('${id}', '${U_A}', '${first.anchor_date}', ${first.interval_count},
            '${first.interval_unit}', 'active', 1000, 'ARS', 'expense',
            ${setup.endDate == null ? 'null' : `'${setup.endDate}'`},
            ${setup.maxOccurrences == null ? 'null' : setup.maxOccurrences},
            '${first.effective_from}',
            ${setup.seedOccurrenceDate == null ? 'null' : `'${setup.seedOccurrenceDate}'`});
    alter table public.recurrences enable trigger trg_recurrence_resolve_schedule_effective_from;
    alter table public.recurrences enable trigger trg_recurrence_sync_schedule_and_pauses;
    alter table public.recurrences enable trigger trg_recurrence_reconstruct_from_guard;
  `)
  for (const v of setup.versions) {
    await db.exec(`
      insert into public.recurrence_schedule_versions
        (recurrence_id, user_id, effective_from, effective_until, interval_count, interval_unit,
         anchor_date, is_assumed)
      values ('${id}', '${U_A}', '${v.effective_from}',
              ${v.effective_until == null ? 'null' : `'${v.effective_until}'`},
              ${v.interval_count}, '${v.interval_unit}', '${v.anchor_date}', false)
      on conflict (recurrence_id, effective_from) do update
        set effective_until = excluded.effective_until,
            interval_count  = excluded.interval_count,
            interval_unit   = excluded.interval_unit,
            anchor_date     = excluded.anchor_date;
    `)
  }
  for (const p of setup.pauses ?? []) {
    await db.exec(`
      insert into public.recurrence_pauses (recurrence_id, user_id, paused_from, resumed_at)
      values ('${id}', '${U_A}', '${p.paused_from}',
              ${p.resumed_at == null ? 'null' : `'${p.resumed_at}'`});
    `)
  }

  const { rows } = await db.query<{ n: number }>(
    `select public.recurrence_positions_spent('${id}'::uuid, '${setup.today}'::date) as n`,
  )
  return {
    ts: occurrencePositionsSpent({
      versions: setup.versions.map((v) => ({ ...v, effective_until: v.effective_until ?? null })),
      pauses: setup.pauses ?? [],
      endDate: setup.endDate ?? null,
      maxOccurrences: setup.maxOccurrences ?? null,
      seedOccurrenceDate: setup.seedOccurrenceDate ?? null,
      today: setup.today,
    }),
    sql: Number(rows[0].n),
  }
}

// `expected` is worked out BY HAND from the calendar, not copied from a run.
// Parity alone cannot catch the bug this replaces: two implementations fed the
// same wrong idea agree perfectly. The number has to be right, not just shared.
const spentCases: Array<{
  name: string
  expected: number
  setup: Parameters<typeof spentBothWays>[0]
}> = [
  {
    name: 'a monthly rule with three positions behind it',
    expected: 4,
    setup: {
      versions: [{ effective_from: '2026-06-10', anchor_date: '2026-06-10', interval_count: 1, interval_unit: 'month' }],
      today: '2026-09-11',
    },
  },
  {
    name: 'a version that took effect after its own anchor',
    expected: 9,
    setup: {
      versions: [{ effective_from: '2026-08-10', anchor_date: '2026-01-10', interval_count: 1, interval_unit: 'month' }],
      today: '2026-09-11',
    },
  },
  {
    name: 'a rule corrected mid-life: two versions, two anchors',
    expected: 9,
    setup: {
      versions: [
        { effective_from: '2026-01-08', effective_until: '2026-06-30', anchor_date: '2026-01-08', interval_count: 1, interval_unit: 'month' },
        { effective_from: '2026-07-10', anchor_date: '2026-07-10', interval_count: 1, interval_unit: 'month' },
      ],
      today: '2026-09-11',
    },
  },
  {
    name: 'a gap nobody rules, between the two',
    expected: 6,
    setup: {
      versions: [
        { effective_from: '2026-01-08', effective_until: '2026-06-30', anchor_date: '2026-01-08', interval_count: 1, interval_unit: 'month' },
        { effective_from: '2026-10-10', anchor_date: '2026-10-10', interval_count: 1, interval_unit: 'month' },
      ],
      today: '2026-09-11',
    },
  },
  {
    name: 'a pause that swallowed two positions',
    expected: 6,
    setup: {
      versions: [{ effective_from: '2026-01-10', anchor_date: '2026-01-10', interval_count: 1, interval_unit: 'month' }],
      pauses: [{ paused_from: '2026-04-01', resumed_at: '2026-06-15' }],
      today: '2026-09-11',
    },
  },
  {
    name: 'a pause still open',
    expected: 6,
    setup: {
      versions: [{ effective_from: '2026-01-10', anchor_date: '2026-01-10', interval_count: 1, interval_unit: 'month' }],
      pauses: [{ paused_from: '2026-07-01', resumed_at: null }],
      today: '2026-09-11',
    },
  },
  {
    name: 'the cap already spent, so the count saturates',
    expected: 3,
    setup: {
      versions: [{ effective_from: '2026-01-10', anchor_date: '2026-01-10', interval_count: 1, interval_unit: 'month' }],
      maxOccurrences: 3,
      today: '2026-09-11',
    },
  },
  {
    name: 'an end_date that stopped the calendar early',
    expected: 4,
    setup: {
      versions: [{ effective_from: '2026-01-10', anchor_date: '2026-01-10', interval_count: 1, interval_unit: 'month' }],
      endDate: '2026-04-30',
      today: '2026-09-11',
    },
  },
  {
    name: 'every three days, where no month helps',
    expected: 14,
    setup: {
      versions: [{ effective_from: '2026-08-02', anchor_date: '2026-08-02', interval_count: 3, interval_unit: 'day' }],
      today: '2026-09-11',
    },
  },
  {
    name: 'monthly on the 31st, clamped through February',
    expected: 8,
    setup: {
      versions: [{ effective_from: '2026-01-31', anchor_date: '2026-01-31', interval_count: 1, interval_unit: 'month' }],
      today: '2026-09-11',
    },
  },
  {
    name: 'weekly across half a year',
    expected: 28,
    setup: {
      versions: [{ effective_from: '2026-03-02', anchor_date: '2026-03-02', interval_count: 1, interval_unit: 'week' }],
      today: '2026-09-11',
    },
  },
  {
    // MORE THAN 750 POSITIONS. The TypeScript walker carries a step budget meant
    // as a safety net for a bounded window; counting a rule's whole life is not
    // bounded, and a daily rule running for years walks past it. Truncation is
    // silent, so the count comes back short, the cap looks unspent, and the form
    // offers cuotas that no longer exist.
    name: 'every day for three years, past the walker\'s step budget',
    expected: 1096,
    setup: {
      versions: [{ effective_from: '2023-09-12', anchor_date: '2023-09-12', interval_count: 1, interval_unit: 'day' }],
      today: '2026-09-11',
    },
  },
  {
    // The seed's own date is on the first version's calendar and BEFORE it takes
    // effect, so the arithmetic prefix already counts it. Counting it again here
    // would spend a cuota that does not exist.
    name: 'a seed inside the first version\'s prefix, counted once',
    expected: 9,
    setup: {
      versions: [{ effective_from: '2026-03-10', anchor_date: '2026-01-10', interval_count: 1, interval_unit: 'month' }],
      seedOccurrenceDate: '2026-01-10',
      today: '2026-09-11',
    },
  },
  {
    // The case the whole thing exists for: the seed's date falls between the
    // version that stopped and the one that has not started. Nothing walks it.
    // 1 (the stranded seed) + 6 from the first version (Jan–Jun on the 8th)
    // + 3 from the second (Jul–Sep on the 10th).
    name: 'a seed stranded in the gap, counted all the same',
    expected: 10,
    setup: {
      versions: [
        { effective_from: '2026-01-08', effective_until: '2026-06-30', anchor_date: '2026-01-08', interval_count: 1, interval_unit: 'month' },
        { effective_from: '2026-07-10', anchor_date: '2026-07-10', interval_count: 1, interval_unit: 'month' },
      ],
      seedOccurrenceDate: '2026-07-05',
      today: '2026-09-11',
    },
  },
  {
    // Emitted by a version's own walk. Still one position, not two.
    name: 'a seed the calendar does produce, counted once',
    expected: 9,
    setup: {
      versions: [{ effective_from: '2026-01-10', anchor_date: '2026-01-10', interval_count: 1, interval_unit: 'month' }],
      seedOccurrenceDate: '2026-03-10',
      today: '2026-09-11',
    },
  },
  {
    name: 'yearly, anchored years back',
    expected: 7,
    setup: {
      versions: [{ effective_from: '2020-02-29', anchor_date: '2020-02-29', interval_count: 1, interval_unit: 'year' }],
      today: '2026-09-11',
    },
  },
]

describe('positions spent — TypeScript and SQL over the same history', () => {
  for (const { name, expected, setup } of spentCases) {
    it(name, async () => {
      const { ts, sql } = await spentBothWays(setup)
      expect({ ts, sql }).toEqual({ ts: expected, sql: expected })
    })
  }
})
