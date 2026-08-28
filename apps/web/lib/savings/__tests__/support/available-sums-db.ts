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
 *
 * 0060 replaces `get_available_sums` to add the sumando that was missing — the
 * declared opening balance of each account. It is applied AFTER 0057, in the same
 * order the dashboard SQL editor would: applying the old one and then the new one
 * is what proves the replacement actually takes (a signature that did not match
 * would fail here and not in production). That also brings `account_currencies`
 * into the harness, whose DDL comes verbatim from 0007 + 0041.
 */

const M = (file: string) => resolve(__dirname, '../../../../../../supabase/migrations/', file)

const MIGRATION_0007 = M('0007_accounts.sql')
const MIGRATION_0041 = M('0041_allow_negative_initial_balance.sql')
const MIGRATION_0057 = M('0057_availability_reserve.sql')
const MIGRATION_0060 = M('0060_available_sums_initial_balance.sql')

const migration = () => readFileSync(MIGRATION_0057, 'utf-8')

/**
 * 0007's `create table public.account_currencies (…);` plus 0041's drop of the
 * non-negative CHECK. Verbatim: an account CAN open "en rojo", and a harness that
 * rejected it would not be the shipped schema.
 */
export function accountCurrenciesStatements(): string[] {
  const ddl = readFileSync(MIGRATION_0007, 'utf-8').match(
    /create table public\.account_currencies[\s\S]*?\n\);/i,
  )
  if (!ddl) throw new Error('account_currencies create table not found in 0007')

  const drop = readFileSync(MIGRATION_0041, 'utf-8').match(
    /alter table public\.account_currencies[\s\S]*?;/i,
  )
  if (!drop) throw new Error('the non-negative constraint drop was not found in 0041')

  return [ddl[0], drop[0]]
}

/** 0060's replacement of `get_available_sums`, verbatim. */
export function availableSumsFix(): string {
  const blocks =
    readFileSync(MIGRATION_0060, 'utf-8').match(/create or replace function[\s\S]*?\$\$;/gi) ?? []
  if (blocks.length !== 1) {
    throw new Error(`expected 1 function definition in 0060, found ${blocks.length}`)
  }
  return blocks[0]
}

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

/** A fresh in-memory Postgres with the schema, 0051/0052, 0057 and 0060 applied. */
export async function createAvailableDb(): Promise<PGlite> {
  const db = new PGlite()
  await db.exec(BALANCE_SCHEMA)
  await db.exec(DEPENDENCIES)
  for (const ddl of accountCurrenciesStatements()) await db.exec(ddl)
  for (const fn of balanceFunctions()) await db.exec(fn)
  await db.exec(reserveTableStatement())
  for (const fn of reserveFunctionStatements()) await db.exec(fn)
  await db.exec(availableSumsFix())
  return db
}
