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

      await expect(applyActivation(db)).rejects.toThrow(/identidad/)
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
