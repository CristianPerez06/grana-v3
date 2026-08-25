import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { PGlite } from '@electric-sql/pglite'
import { createAvailableDb } from './available-sums-db'

/**
 * PGlite harness for migration 0058 (`savings_purpose`, `purpose_id`, `get_purpose_sums`).
 *
 * Same contract as the 0057 harness it builds on: the DDL and the function body
 * are loaded VERBATIM from the migration file, so what the tests exercise is the
 * shipped SQL and not a transcription of it.
 *
 * It also runs 0058's `do $check$` guard, which is the point of having a guard:
 * a self-check that never executes protects nothing.
 */

const MIGRATION_0058 = resolve(
  __dirname,
  '../../../../../../supabase/migrations/0058_savings_purpose.sql',
)

const migration = () => readFileSync(MIGRATION_0058, 'utf-8')

/** One statement, verbatim, or a failure that says which one is missing. */
function statement(pattern: RegExp, what: string): string {
  const match = migration().match(pattern)
  if (!match) throw new Error(`${what} not found in 0058`)
  return match[0]
}

/** 0058's DDL, in the order the migration applies it. */
export function purposeStatements(): string[] {
  return [
    statement(/create table public\.savings_purpose[\s\S]*?\n\);/i, 'savings_purpose create table'),
    statement(/create unique index uq_savings_purpose_user_name[\s\S]*?;/i, 'the name unique index'),
    statement(/alter table public\.availability_reserve\s+add column purpose_id[\s\S]*?;/i, 'the purpose_id column'),
    statement(/create index idx_availability_reserve_purpose[\s\S]*?;/i, 'the purpose index'),
    statement(/create or replace function public\.get_purpose_sums[\s\S]*?\$\$;/i, 'get_purpose_sums'),
  ]
}

/** 0058's `do $check$ … $check$;` guard on the FK delete rule. */
export function purposeSelfCheck(): string {
  return statement(/do \$check\$[\s\S]*?\$check\$;/i, 'the FK delete-rule self-check')
}

/** A fresh in-memory Postgres with 0051/0052, 0057 and 0058 applied. */
export async function createPurposeDb(): Promise<PGlite> {
  const db = await createAvailableDb()
  for (const ddl of purposeStatements()) await db.exec(ddl)
  await db.exec(purposeSelfCheck())
  return db
}
