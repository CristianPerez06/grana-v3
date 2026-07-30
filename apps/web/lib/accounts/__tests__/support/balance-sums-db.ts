import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { PGlite } from '@electric-sql/pglite'

/**
 * PGlite harness for migration 0051 (`get_account_balance_sums`).
 *
 * The repo is online-only (AGENTS.md: no local Supabase), so the shipped SQL is
 * exercised on a real Postgres compiled to WASM, over a MINIMAL schema carrying
 * only the columns the function reads. The function bodies are loaded verbatim
 * from the migration file — what runs is what ships, not a transcription.
 */

const MIGRATION = resolve(
  __dirname,
  '../../../../../../supabase/migrations/0051_account_balance_sums.sql',
)

/**
 * The two `create or replace function … $$;` blocks of the migration. The rest
 * (grants to Supabase roles, the DO self-check, comments) is environment-bound
 * and not what these tests are about.
 */
export function functionStatements(): string[] {
  const sql = readFileSync(MIGRATION, 'utf-8')
  const blocks = sql.match(/create or replace function[\s\S]*?\$\$;/gi) ?? []
  if (blocks.length !== 2) {
    throw new Error(`expected 2 function definitions in 0051, found ${blocks.length}`)
  }
  return blocks
}

export const SCHEMA = `
  create type account_type as enum ('cash', 'bank', 'credit');
  create type transaction_type as enum (
    'income', 'expense', 'transfer', 'adjustment', 'exchange', 'reimbursement', 'settlement'
  );

  create table public.accounts (
    id        uuid primary key,
    user_id   uuid not null,
    type      account_type not null,
    is_active boolean not null default true
  );

  create table public.transactions (
    id                              uuid primary key default gen_random_uuid(),
    user_id                         uuid not null,
    account_id                      uuid,
    transfer_destination_account_id uuid,
    currency_code                   text not null,
    amount                          numeric(18,2) not null,
    type                            transaction_type not null,
    date                            date not null default current_date,
    destination_amount              numeric(18,2),
    destination_currency            text,
    reimbursement_target            text,
    received_at                     timestamptz,
    cancelled_at                    timestamptz,
    settlement_direction            text,
    status                          text,
    is_parent                       boolean not null default false
  );
`

/** A fresh in-memory Postgres with the minimal schema and the 0051 functions. */
export async function createBalanceDb(): Promise<PGlite> {
  const db = new PGlite()
  await db.exec(SCHEMA)
  for (const fn of functionStatements()) await db.exec(fn)
  return db
}

/** SQL literal for a value that may be null. */
export const lit = (v: unknown) => (v == null ? 'null' : `'${String(v).replace(/'/g, "''")}'`)
