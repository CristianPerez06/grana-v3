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

const dir = resolve(__dirname, '../../../../../../supabase/migrations')

const read = (file: string) => readFileSync(resolve(dir, file), 'utf-8')

/** One statement, verbatim, or a failure that says which one is missing. */
function statement(sql: string, pattern: RegExp, what: string, where: string): string {
  const match = sql.match(pattern)
  if (!match) throw new Error(`${what} not found in ${where}`)
  return match[0]
}

/**
 * 0058's DDL, in the order the migration applies it.
 *
 * 0058 still runs even though 0059 undoes half of it: on a clean database the
 * migrations replay from zero, so the harness has to replay them too. Testing
 * only the end state would let a broken intermediate migration ship.
 */
export function purposeStatements(): string[] {
  const sql = read('0058_savings_purpose.sql')
  const at = (re: RegExp, what: string) => statement(sql, re, what, '0058')
  return [
    at(/create table public\.savings_purpose[\s\S]*?\n\);/i, 'savings_purpose create table'),
    at(/create unique index uq_savings_purpose_user_name[\s\S]*?;/i, 'the name unique index'),
    at(/alter table public\.availability_reserve\s+add column purpose_id[\s\S]*?;/i, 'the purpose_id column'),
    at(/create index idx_availability_reserve_purpose[\s\S]*?;/i, 'the purpose index'),
    at(/create or replace function public\.get_purpose_sums[\s\S]*?\$\$;/i, 'get_purpose_sums'),
    statement(sql, /do \$check\$[\s\S]*?\$check\$;/i, 'the FK delete-rule self-check', '0058'),
  ]
}

/**
 * 0059's DDL: the allocation table, the drop of `purpose_id`, the invariant
 * trigger and the rewritten `get_purpose_sums`.
 *
 * The `do $check$` guard runs here too — a self-check that never executes
 * protects nothing.
 */
export function allocationStatements(): string[] {
  const sql = read('0059_purpose_allocation.sql')
  const at = (re: RegExp, what: string) => statement(sql, re, what, '0059')
  return [
    at(/create table public\.savings_purpose_allocation[\s\S]*?\n\);/i, 'the allocation table'),
    at(/create index idx_purpose_allocation_user_currency[\s\S]*?;/i, 'the currency index'),
    at(/create index idx_purpose_allocation_purpose[\s\S]*?;/i, 'the purpose index'),
    at(/drop index if exists public\.idx_availability_reserve_purpose;/i, 'the dropped index'),
    at(/alter table public\.availability_reserve\s+drop column if exists purpose_id;/i, 'the dropped column'),
    at(/create or replace function public\.assert_purpose_allocation_fits[\s\S]*?\$\$;/i, 'the invariant function'),
    at(/create trigger trg_purpose_allocation_fits[\s\S]*?;/i, 'the allocation trigger'),
    at(/create trigger trg_reserve_keeps_allocation_valid[\s\S]*?;/i, 'the reserve trigger'),
    at(/create or replace function public\.get_purpose_sums[\s\S]*?\$\$;/i, 'the rewritten get_purpose_sums'),
    at(/create or replace function public\.write_reserve[\s\S]*?\$\$;/i, 'write_reserve'),
    at(/do \$check\$[\s\S]*?\$check\$;/i, 'the fungibility self-check'),
  ]
}

/** A fresh in-memory Postgres with 0051/0052, 0057, 0058 and 0059 applied. */
export async function createPurposeDb(): Promise<PGlite> {
  const db = await createAvailableDb()
  for (const ddl of purposeStatements()) await db.exec(ddl)
  for (const ddl of allocationStatements()) await db.exec(ddl)
  return db
}
