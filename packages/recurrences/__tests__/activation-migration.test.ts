import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { PGlite } from '@electric-sql/pglite'
import { describe, expect, it } from 'vitest'
import {
  applyActivation,
  createRecurrenceIdentityDb,
  U_A,
} from './support/recurrence-identity-db'

/**
 * The activation migration itself (0066), as a file that can refuse to run.
 *
 * Retiring `recurrence_instances_one_pending_per_rule` is the one irreversible
 * step of this delivery — irreversible in practice, because putting the index
 * back fails as soon as any rule holds two unresolved occurrences. Applied in
 * the wrong order it produces the worst state available: a database that admits
 * several pending rows per rule with nothing telling them apart, so a generator
 * that retries writes duplicates instead of being rejected.
 *
 * So the file checks before it drops, and these are the refusals.
 */

const indexExists = async (db: PGlite, name: string): Promise<boolean> => {
  const { rows } = await db.query<{ n: number }>(
    `select count(*)::int as n from pg_class where relname = '${name}'`,
  )
  return rows[0].n > 0
}

const ONE_PENDING = 'recurrence_instances_one_pending_per_rule'
const IDENTITY = 'recurrence_instances_one_per_rule_due_date'

describe('migration 0066 — activation', () => {
  it('refuses to run before the expansion', async () => {
    // Dropping the index without `due_date` leaves a table where an occurrence
    // has no identity at all. The migration has to abort, not "succeed".
    const db = await createRecurrenceIdentityDb({ applyMigration: false })
    try {
      await expect(applyActivation(db)).rejects.toThrow(/due_date/)
      // And it left the old world exactly as it found it.
      expect(await indexExists(db, ONE_PENDING)).toBe(true)
    } finally {
      await db.close()
    }
  }, 120_000)

  it('refuses to run without the identity index', async () => {
    // With the single-pending index gone, the unique index on
    // `(recurrence_id, due_date)` is the ONLY thing stopping a concurrent run
    // from materializing the same occurrence twice.
    const db = await createRecurrenceIdentityDb()
    try {
      await db.exec(`drop index public.${IDENTITY};`)

      await expect(applyActivation(db)).rejects.toThrow(/is missing, or is not a valid UNIQUE index/)
      expect(await indexExists(db, ONE_PENDING)).toBe(true)
    } finally {
      await db.close()
    }
  }, 120_000)

  it('refuses an identity index that only has the right NAME', async () => {
    // The whole reason the check is structural. Each of these answers to
    // `recurrence_instances_one_per_rule_due_date` and none of them protects
    // anything: a name match would let the migration retire the old index and
    // report success over an unprotected table.
    const impostors: { why: string; ddl: string; expected: RegExp }[] = [
      {
        why: 'not unique',
        ddl: `create index ${IDENTITY} on public.recurrence_instances (recurrence_id, due_date) where due_date is not null;`,
        expected: /is not a valid UNIQUE index/,
      },
      {
        why: 'the wrong columns',
        ddl: `create unique index ${IDENTITY} on public.recurrence_instances (recurrence_id, scheduled_date) where due_date is not null;`,
        expected: /covers \(recurrence_id, scheduled_date\)/,
      },
      {
        why: 'not partial, so an unknown identity blocks a known one',
        ddl: `create unique index ${IDENTITY} on public.recurrence_instances (recurrence_id, due_date);`,
        expected: /not partial/,
      },
      {
        // The one a substring match cannot tell from the real thing: it CONTAINS
        // `due_date is not null` and indexes only resolved rows, so two pending
        // occurrences could hold the same vencimiento.
        why: 'a predicate that reads right and covers no unresolved occurrence',
        ddl: `create unique index ${IDENTITY} on public.recurrence_instances (recurrence_id, due_date)
                where due_date is not null and status = 'confirmed';`,
        expected: /the index predicate is/,
      },
      {
        why: 'a predicate that leaves out skipped rows, which still hold their due date',
        ddl: `create unique index ${IDENTITY} on public.recurrence_instances (recurrence_id, due_date)
                where due_date is not null and status <> 'skipped';`,
        expected: /the index predicate is/,
      },
      {
        // The one no finite probe can catch: every sample date a test picks is
        // either inside the range or outside it, and the predicate abandons
        // every occurrence on the other side.
        why: 'a predicate bounded by a date range',
        ddl: `create unique index ${IDENTITY} on public.recurrence_instances (recurrence_id, due_date)
                where due_date >= date '2026-01-01';`,
        expected: /the index predicate is/,
      },
      {
        why: 'a predicate narrowed to one rule',
        ddl: `create unique index ${IDENTITY} on public.recurrence_instances (recurrence_id, due_date)
                where due_date is not null
                  and recurrence_id = '00000000-0000-0000-0000-0000000000aa';`,
        expected: /the index predicate is/,
      },
      {
        why: 'sitting on another table',
        ddl: `create table public.decoy (recurrence_id uuid, due_date date);
              create unique index ${IDENTITY} on public.decoy (recurrence_id, due_date) where due_date is not null;`,
        expected: /is missing, or is not a valid UNIQUE index/,
      },
    ]

    for (const impostor of impostors) {
      const db = await createRecurrenceIdentityDb()
      try {
        await db.exec(`drop index public.${IDENTITY};`)
        await db.exec(impostor.ddl)

        await expect(applyActivation(db), impostor.why).rejects.toThrow(impostor.expected)
        // And the old protection is untouched, which is the thing that matters.
        expect(await indexExists(db, ONE_PENDING), impostor.why).toBe(true)
      } finally {
        await db.close()
      }
    }
  }, 300_000)

  it('refuses when the due-date CHECK is missing', async () => {
    // Without it a `pending` row can lose its vencimiento, and a row with no
    // identity is a row the unique index above does not cover.
    const db = await createRecurrenceIdentityDb()
    try {
      await db.exec(
        'alter table public.recurrence_instances drop constraint chk_recurrence_instances_unresolved_has_due_date;',
      )

      await expect(applyActivation(db)).rejects.toThrow(
        /chk_recurrence_instances_unresolved_has_due_date is missing or NOT VALID/,
      )
      expect(await indexExists(db, ONE_PENDING)).toBe(true)
    } finally {
      await db.close()
    }
  }, 120_000)

  it('refuses a due-date CHECK whose body does not enforce the rule', async () => {
    // Right name, right type, validated, and no stored row violates it — every
    // check that looks at metadata passes. `check (true)` stops nothing from
    // here on, which is precisely what the activation cannot afford.
    const bodies = [
      { why: 'always true', body: 'check (true)' },
      // Enforces something real, just not this: it accepts a pending row with
      // no vencimiento, which is the row that ends up with no identity.
      { why: 'the wrong rule', body: "check (status in ('pending', 'skipped', 'confirmed'))" },
    ]

    for (const { why, body } of bodies) {
      const db = await createRecurrenceIdentityDb()
      try {
        await db.exec(`
          alter table public.recurrence_instances
            drop constraint chk_recurrence_instances_unresolved_has_due_date;
          alter table public.recurrence_instances
            add constraint chk_recurrence_instances_unresolved_has_due_date ${body};
        `)

        await expect(applyActivation(db), why).rejects.toThrow(
          /the CHECK accepts a pending row with due_date null and must not/,
        )
        expect(await indexExists(db, ONE_PENDING), why).toBe(true)
      } finally {
        await db.close()
      }
    }
  }, 300_000)

  it('refuses a due-date CHECK that turns away legitimate occurrences', async () => {
    // Over-strict is a defect too, and it passes every test that only looks at
    // what a constraint REJECTS.
    const bodies = [
      {
        // 0064 leaves `due_date` null on everything resolved before the
        // distinction existed, on purpose.
        why: 'refuses the historical confirmed rows',
        body: 'check (due_date is not null)',
        expected: /rejects a confirmed row with due_date null/,
      },
      {
        // Rejects `pending`/null and `skipped`/null, accepts `confirmed`/null —
        // and stops any pending occurrence from being created at all.
        why: 'lets nothing but confirmed exist',
        body: "check (status = 'confirmed')",
        expected: /rejects a pending row with due_date 1999-01-01/,
      },
    ]

    for (const { why, body, expected } of bodies) {
      const db = await createRecurrenceIdentityDb()
      try {
        await db.exec(`
          alter table public.recurrence_instances
            drop constraint chk_recurrence_instances_unresolved_has_due_date;
          alter table public.recurrence_instances
            add constraint chk_recurrence_instances_unresolved_has_due_date ${body};
        `)

        await expect(applyActivation(db), why).rejects.toThrow(expected)
        expect(await indexExists(db, ONE_PENDING), why).toBe(true)
      } finally {
        await db.close()
      }
    }
  }, 300_000)

  it('refuses a due-date CHECK that behaves right but is spelled differently', async () => {
    // A false RED, and deliberately so: the rule is the same, the text is not,
    // and blessing "close enough" is how the comparison stops meaning anything.
    // It stops a deploy instead of blessing an unprotected table, and the fix is
    // one `alter table`.
    const db = await createRecurrenceIdentityDb()
    try {
      await db.exec(`
        alter table public.recurrence_instances
          drop constraint chk_recurrence_instances_unresolved_has_due_date;
        alter table public.recurrence_instances
          add constraint chk_recurrence_instances_unresolved_has_due_date
          check (due_date is not null or status = 'confirmed');
      `)

      await expect(applyActivation(db)).rejects.toThrow(/If it is an equivalent rewrite/)
      expect(await indexExists(db, ONE_PENDING)).toBe(true)
    } finally {
      await db.close()
    }
  }, 120_000)

  it('refuses a due-date CHECK that was added NOT VALID', async () => {
    // `NOT VALID` enforces new rows and leaves everything already stored
    // unexamined — so the constraint exists, reads as protection, and the rows
    // the activation is about were never looked at.
    const db = await createRecurrenceIdentityDb()
    try {
      await db.exec(`
        alter table public.recurrence_instances
          drop constraint chk_recurrence_instances_unresolved_has_due_date;
        alter table public.recurrence_instances
          add constraint chk_recurrence_instances_unresolved_has_due_date
          check (status = 'confirmed' or due_date is not null) not valid;
      `)

      await expect(applyActivation(db)).rejects.toThrow(/is missing or NOT VALID/)
      expect(await indexExists(db, ONE_PENDING)).toBe(true)
    } finally {
      await db.close()
    }
  }, 120_000)

  it('retires the single-pending index and keeps the identity one', async () => {
    const db = await createRecurrenceIdentityDb()
    try {
      expect(await indexExists(db, ONE_PENDING)).toBe(true)

      await applyActivation(db)

      expect(await indexExists(db, ONE_PENDING)).toBe(false)
      expect(await indexExists(db, IDENTITY)).toBe(true)
    } finally {
      await db.close()
    }
  }, 120_000)

  it('lets a rule hold two unresolved occurrences, which is the whole point', async () => {
    const db = await createRecurrenceIdentityDb()
    try {
      const rule = '00000000-0000-0000-0000-000000008001'
      await db.exec(`
        insert into public.recurrences
          (id, user_id, amount, interval_count, interval_unit, start_date, last_generated_date, status)
        values ('${rule}', '${U_A}', 2500, 1, 'month', '2026-06-23', '2026-06-23', 'active');
        insert into public.recurrence_instances
          (recurrence_id, user_id, scheduled_date, due_date, status)
        values ('${rule}', '${U_A}', '2026-06-23', '2026-06-23', 'pending');
      `)

      // Before: the second one is rejected. That rejection is #96.
      await expect(
        db.exec(`
          insert into public.recurrence_instances
            (recurrence_id, user_id, scheduled_date, due_date, status)
          values ('${rule}', '${U_A}', '2026-07-23', '2026-07-23', 'pending');
        `),
      ).rejects.toThrow()

      await applyActivation(db)

      await db.exec(`
        insert into public.recurrence_instances
          (recurrence_id, user_id, scheduled_date, due_date, status)
        values ('${rule}', '${U_A}', '2026-07-23', '2026-07-23', 'pending');
      `)

      const { rows } = await db.query<{ n: number }>(
        `select count(*)::int as n from public.recurrence_instances
          where recurrence_id = '${rule}' and status = 'pending'`,
      )
      expect(rows[0].n).toBe(2)
    } finally {
      await db.close()
    }
  }, 120_000)

  it('still refuses the SAME occurrence twice', async () => {
    // What the activation must NOT do is open the door to duplicates. The rule
    // that changes is "one pending per rule"; "one row per occurrence" stays.
    const db = await createRecurrenceIdentityDb()
    try {
      const rule = '00000000-0000-0000-0000-000000008002'
      await db.exec(`
        insert into public.recurrences
          (id, user_id, amount, interval_count, interval_unit, start_date, last_generated_date, status)
        values ('${rule}', '${U_A}', 2500, 1, 'month', '2026-06-23', '2026-06-23', 'active');
      `)
      await applyActivation(db)

      await db.exec(`
        insert into public.recurrence_instances
          (recurrence_id, user_id, scheduled_date, due_date, status)
        values ('${rule}', '${U_A}', '2026-06-23', '2026-06-23', 'pending');
      `)

      await expect(
        db.exec(`
          insert into public.recurrence_instances
            (recurrence_id, user_id, scheduled_date, due_date, status)
          values ('${rule}', '${U_A}', '2026-06-23', '2026-06-23', 'pending');
        `),
      ).rejects.toThrow()
    } finally {
      await db.close()
    }
  }, 120_000)

  it('is safe to re-apply', async () => {
    // Migrations get replayed. A second run must be a no-op, not an error that
    // makes an operator wonder what half-happened.
    const db = await createRecurrenceIdentityDb()
    try {
      await applyActivation(db)
      await applyActivation(db)

      expect(await indexExists(db, ONE_PENDING)).toBe(false)
      expect(await indexExists(db, IDENTITY)).toBe(true)
    } finally {
      await db.close()
    }
  }, 120_000)
})

// ── The two validation files ────────────────────────────────────────────────
// `validate_schema.sql` validates the FINAL state and must REFUSE a schema whose
// activation is still pending: while the single-pending index stands, #96 is
// live however much of the new model is installed. The transition window is a
// legitimate state, so it gets its own file — accepting both in one would mean
// signing off on the unfixed schema.

const SUPABASE = resolve(__dirname, '../../../supabase')
const readSql = (file: string) => readFileSync(resolve(SUPABASE, file), 'utf-8')

/**
 * The one branch of `validate_schema.sql` that concerns the activation, lifted
 * out and RUN. The rest of that file needs the whole production schema, which
 * this harness does not have; this block needs only `pg_indexes`, so it can be
 * executed for real instead of grepped.
 */
function activationBranchOfValidateSchema(): string {
  const sql = readSql('validate_schema.sql')
  const start = sql.indexOf('  -- (4) THE ACTIVATION IS APPLIED.')
  if (start < 0) throw new Error('the activation check moved: update this extraction')
  const end = sql.indexOf('end if;', sql.indexOf('raise exception', start))
  return `do $$\nbegin\n${sql.slice(start, end)}end if;\nend $$;`
}

describe('validate_schema.sql — final state', () => {
  it('REFUSES a schema whose activation is still pending', async () => {
    // The defect this replaces: a version that accepted either state and only
    // reported which one, so an unapplied activation passed final validation.
    const db = await createRecurrenceIdentityDb()
    try {
      await expect(db.exec(activationBranchOfValidateSchema())).rejects.toThrow(
        /still exists: the activation \(0066\) was not applied/,
      )
    } finally {
      await db.close()
    }
  }, 120_000)

  it('accepts it once the activation is applied', async () => {
    const db = await createRecurrenceIdentityDb()
    try {
      await applyActivation(db)
      await expect(db.exec(activationBranchOfValidateSchema())).resolves.toBeDefined()
    } finally {
      await db.close()
    }
  }, 120_000)
})

describe('validate_schema_transition.sql — the window', () => {
  it('passes while the expansion is applied and the activation is not', async () => {
    const db = await createRecurrenceIdentityDb()
    try {
      await expect(db.exec(readSql('validate_schema_transition.sql'))).resolves.toBeDefined()
    } finally {
      await db.close()
    }
  }, 120_000)

  it('refuses once the activation is applied — that is the signal to switch files', async () => {
    const db = await createRecurrenceIdentityDb()
    try {
      await applyActivation(db)
      await expect(db.exec(readSql('validate_schema_transition.sql'))).rejects.toThrow(
        /validate_schema\.sql instead/,
      )
    } finally {
      await db.close()
    }
  }, 120_000)

  it('refuses before the expansion: that is not the window either', async () => {
    const db = await createRecurrenceIdentityDb({ applyMigration: false })
    try {
      await expect(db.exec(readSql('validate_schema_transition.sql'))).rejects.toThrow(
        /recurrence_instances\.due_date is missing/,
      )
    } finally {
      await db.close()
    }
  }, 120_000)

  it('does not depend on the real table being convenient to insert into', async () => {
    // THE BUG THIS PINS, found by applying the file to the real database. The
    // probe copies `recurrence_instances` and inserts one row into the copy; in
    // production `amount` is NOT NULL with no default, so the insert died on a
    // column that has nothing to do with the guards under test. The harness
    // missed it because its fixture gives `amount` a default, which the copy
    // inherited.
    //
    // Reproduced by making the fixture match production, and the fix is generic:
    // the block drops every NOT NULL from the copy instead of naming columns.
    const db = await createRecurrenceIdentityDb()
    try {
      await db.exec(`
        alter table public.recurrence_instances alter column amount        drop default;
        alter table public.recurrence_instances alter column currency_code drop default;
        alter table public.recurrence_instances add column extra_required  text not null default 'x';
        alter table public.recurrence_instances alter column extra_required drop default;
      `)

      await expect(db.exec(readSql('validate_schema_transition.sql'))).resolves.toBeDefined()
    } finally {
      await db.close()
    }
  }, 120_000)

  it('is a GATE: an incomplete expansion does not pass it', async () => {
    // What it used to miss. Each of these leaves the phase intact — the old
    // index is there, no rule holds two pending rows — while removing something
    // the activation is about to depend on. Green here would be a green light
    // to run QA against a schema that cannot work.
    const damage = [
      {
        why: 'the identity index deleted',
        sql: 'drop index public.recurrence_instances_one_per_rule_due_date;',
        expected: /recurrence_instances_one_per_rule_due_date does not exist/,
      },
      {
        why: 'the schedule versions gone',
        sql: 'drop table public.recurrence_schedule_versions cascade;',
        expected: /recurrence_schedule_versions/,
      },
      {
        why: 'the pauses gone',
        sql: 'drop table public.recurrence_pauses cascade;',
        expected: /recurrence_pauses/,
      },
      {
        why: 'the compatibility trigger gone',
        sql: 'drop trigger trg_recurrence_instance_compat on public.recurrence_instances;',
        expected: /trg_recurrence_instance_compat is missing/,
      },
      {
        why: 'the reconstruction floor guard gone',
        sql: 'drop trigger trg_recurrence_reconstruct_from_guard on public.recurrences;',
        expected: /trg_recurrence_reconstruct_from_guard is missing/,
      },
      {
        why: "0065's atomic repair gone",
        sql: 'drop function public.delete_movement_unlinking_seed(uuid);',
        expected: /delete_movement_unlinking_seed\(p_transaction_id uuid\) is missing/,
      },
      {
        // The reviewer's case for name-only checks: everything about the
        // trigger is intact except that it does not run.
        why: 'the compatibility trigger disabled rather than dropped',
        sql: 'alter table public.recurrence_instances disable trigger trg_recurrence_instance_compat;',
        expected: /trg_recurrence_instance_compat is missing/,
      },
      {
        why: 'a homonym trigger moved onto another table',
        sql: `drop trigger trg_recurrence_reconstruct_from_guard on public.recurrences;
              create trigger trg_recurrence_reconstruct_from_guard
                before insert or update on public.recurrence_instances
                for each row execute function public.recurrence_reconstruct_from_guard();`,
        expected: /trg_recurrence_reconstruct_from_guard is missing/,
      },
      {
        why: 'the due-date CHECK reduced to `true`',
        sql: `alter table public.recurrence_instances
                drop constraint chk_recurrence_instances_unresolved_has_due_date;
              alter table public.recurrence_instances
                add constraint chk_recurrence_instances_unresolved_has_due_date check (true);`,
        expected: /the CHECK accepts a pending row with due_date null/,
      },
    ]

    for (const { why, sql, expected } of damage) {
      const db = await createRecurrenceIdentityDb()
      try {
        await db.exec(sql)
        await expect(db.exec(readSql('validate_schema_transition.sql')), why).rejects.toThrow(
          expected,
        )
      } finally {
        await db.close()
      }
    }
  }, 300_000)
})

// ── The three copies of the shared contract ─────────────────────────────────
// SQL applied by hand has no include, so the block is duplicated on purpose in
// migration 0066, `validate_schema.sql` and `validate_schema_transition.sql`.
// Duplication drifts unless something compares it; this is that something.

describe('the shared occurrence-identity contract', () => {
  const OPEN = '-- ┌── SHARED CONTRACT · occurrence identity'
  const CLOSE = '-- └── END SHARED CONTRACT'

  const extract = (file: string, open: string, close: string): string => {
    const sql = readSql(file)
    const start = sql.indexOf(open)
    const end = sql.indexOf(close)
    if (start < 0 || end < 0) throw new Error(`${file} no longer carries ${open.slice(7)}`)
    return sql.slice(start, end)
  }

  it('is byte-identical in the three files that rely on it', () => {
    const fromMigration = extract(
      'migrations/0066_recurrence_backlog_activate.sql',
      OPEN,
      CLOSE,
    )

    // The contract cannot be weaker where it is only inspected than where it is
    // acted upon, and it cannot be weaker before QA than at the moment the old
    // protection is retired.
    expect(extract('validate_schema.sql', OPEN, CLOSE)).toBe(fromMigration)
    expect(extract('validate_schema_transition.sql', OPEN, CLOSE)).toBe(fromMigration)
  })

  it('carries the same expansion inventory into the transition window', () => {
    // The other shared block. The window is when the QA that decides the
    // activation happens, so checking the expansion shallower there than in the
    // final validation is checking it where it matters least.
    const INV_OPEN = '-- ┌── SHARED BLOCK · expansion inventory'
    const INV_CLOSE = '-- └── END SHARED BLOCK · expansion inventory'

    expect(extract('validate_schema_transition.sql', INV_OPEN, INV_CLOSE)).toBe(
      extract('validate_schema.sql', INV_OPEN, INV_CLOSE),
    )
  })
})
