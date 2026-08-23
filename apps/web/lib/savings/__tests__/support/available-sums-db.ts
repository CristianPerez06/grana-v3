import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { PGlite } from '@electric-sql/pglite'
import { SCHEMA as BALANCE_SCHEMA, functionStatements as balanceFunctions } from '../../../accounts/__tests__/support/balance-sums-db'

/**
 * PGlite harness for migration 0057 (`get_available_sums`, `get_reserve_flow_sums`).
 *
 * Same contract as the balance harness it builds on: the repo is online-only, so
 * the shipped SQL runs on a real Postgres compiled to WASM over a minimal schema.
 * The function bodies and the `create table` are loaded VERBATIM from the
 * migration — what runs is what ships, not a transcription.
 *
 * 0057 composes on 0051/0052 (`get_account_balance_sums`), so those load first.
 */

const MIGRATION_0057 = resolve(
  __dirname,
  '../../../../../../supabase/migrations/0057_availability_reserve.sql',
)

const migration = () => readFileSync(MIGRATION_0057, 'utf-8')

/** 0057's `create table public.availability_reserve (…);`, verbatim. */
export function reserveTableStatement(): string {
  const match = migration().match(/create table public\.availability_reserve[\s\S]*?\n\);/i)
  if (!match) throw new Error('availability_reserve create table not found in 0057')
  return match[0]
}

/** 0057's two `create or replace function … $$;` blocks, in order. */
export function reserveFunctionStatements(): string[] {
  const blocks = migration().match(/create or replace function[\s\S]*?\$\$;/gi) ?? []
  if (blocks.length !== 2) {
    throw new Error(`expected 2 function definitions in 0057, found ${blocks.length}`)
  }
  return blocks
}

/**
 * The FK targets the migration's DDL needs. `auth.users` and `currencies` are
 * outside this harness's subject but the real `create table` references them, and
 * running the real DDL is the point.
 */
const DEPENDENCIES = `
  create schema if not exists auth;
  create table auth.users (id uuid primary key);
  create table public.currencies (code text primary key);
  insert into public.currencies (code) values ('ARS'), ('USD'), ('EUR');
`

/** A fresh in-memory Postgres with the schema, 0051/0052 and 0057 applied. */
export async function createAvailableDb(): Promise<PGlite> {
  const db = new PGlite()
  await db.exec(BALANCE_SCHEMA)
  await db.exec(DEPENDENCIES)
  for (const fn of balanceFunctions()) await db.exec(fn)
  await db.exec(reserveTableStatement())
  for (const fn of reserveFunctionStatements()) await db.exec(fn)
  return db
}
