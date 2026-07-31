import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { PGlite } from '@electric-sql/pglite'

/**
 * PGlite harness for migrations 0051 + 0052 (`get_account_balance_sums`).
 *
 * The repo is online-only (AGENTS.md: no local Supabase), so the shipped SQL is
 * exercised on a real Postgres compiled to WASM, over a MINIMAL schema carrying
 * only the columns the function reads. The function bodies are loaded verbatim
 * from the migration files — what runs is what ships, not a transcription.
 * 0052 replaces the balance function (drop + create with the `p_today` temporal
 * cut), applied here in the same order the dashboard SQL editor would.
 */

const MIGRATION_0051 = resolve(
  __dirname,
  '../../../../../../supabase/migrations/0051_account_balance_sums.sql',
)
const MIGRATION_0052 = resolve(
  __dirname,
  '../../../../../../supabase/migrations/0052_balance_temporal_cut.sql',
)

/**
 * The function-defining statements of both migrations, in application order:
 * 0051's two `create or replace function … $$;` blocks, then 0052's
 * `drop function …;` + `create function … $$;`. The rest (grants to Supabase
 * roles, the DO self-checks, comments) is environment-bound and not what these
 * tests are about.
 */
export function functionStatements(): string[] {
  const sql51 = readFileSync(MIGRATION_0051, 'utf-8')
  const blocks51 = sql51.match(/create or replace function[\s\S]*?\$\$;/gi) ?? []
  if (blocks51.length !== 2) {
    throw new Error(`expected 2 function definitions in 0051, found ${blocks51.length}`)
  }

  const sql52 = readFileSync(MIGRATION_0052, 'utf-8')
  const drop52 = sql52.match(/drop function if exists[\s\S]*?;/i)
  const blocks52 = sql52.match(/\ncreate function[\s\S]*?\$\$;/gi) ?? []
  if (!drop52 || blocks52.length !== 1) {
    throw new Error(
      `expected 1 drop + 1 create function in 0052, found ${blocks52.length} creates`,
    )
  }

  return [...blocks51, drop52[0], ...blocks52]
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
