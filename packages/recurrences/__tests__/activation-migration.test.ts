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
        /the expansion \(0064\) is not applied/,
      )
    } finally {
      await db.close()
    }
  }, 120_000)
})
