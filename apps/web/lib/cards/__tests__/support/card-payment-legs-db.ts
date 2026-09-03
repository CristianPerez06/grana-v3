import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { PGlite } from '@electric-sql/pglite'

/**
 * PGlite harness for migration 0061 (patas de pago).
 *
 * Same contract as the savings harnesses: the DDL, the function bodies and the
 * triggers are loaded VERBATIM from the migration file, so what the tests exercise
 * is the shipped SQL and not a transcription of it. `period_payments` also comes
 * from its real migrations (0010 + 0050), because 0061 alters it and testing an
 * invented shape would prove nothing.
 *
 * Stubbed, because they are outside the subject and the real DDL for them drags in
 * half the schema: `auth.users`, `currencies`, `accounts`, `transactions`. They
 * carry the columns 0061 actually reads — the transaction's currency, amount and
 * fx, and the period's charges — and nothing else.
 */

const dir = resolve(__dirname, '../../../../../../supabase/migrations')
const read = (file: string) => readFileSync(resolve(dir, file), 'utf-8')

function statement(sql: string, pattern: RegExp, what: string, where: string): string {
  const match = sql.match(pattern)
  if (!match) throw new Error(`${what} not found in ${where}`)
  return match[0]
}

/** Everything 0061 applies, in the order it applies it. */
export function legStatements(): string[] {
  const sql = read('0061_card_payment_legs.sql')
  const at = (re: RegExp, what: string) => statement(sql, re, what, '0061')
  return [
    at(/alter table public\.period_payments\s+drop constraint if exists period_payments_period_id_key;/i, 'the UNIQUE drop'),
    at(/alter table public\.period_payments\s+--[\s\S]*?add column if not exists settlement_known[\s\S]*?;/i, 'the new columns'),
    at(/DO \$backfill\$[\s\S]*?\$backfill\$;/i, 'the backfill'),
    at(/alter table public\.period_payments\s+alter column payment_group_id set not null[\s\S]*?;/i, 'the NOT NULL on payment_group_id'),
    at(/alter table public\.period_payments\s+drop constraint if exists chk_period_payment_settlement[\s\S]*?\);\n/i, 'the local CHECKs'),
    at(/create index if not exists idx_period_payments_period_group[\s\S]*?;/i, 'the group index'),
    at(/create index if not exists idx_period_payments_period_created[\s\S]*?;/i, 'the ordering index'),
    at(/alter table public\.card_periods\s+add column if not exists minimum_payment_ars[\s\S]*?;/i, 'the minimum payment columns'),
    at(/alter table public\.card_periods\s+drop constraint if exists chk_card_period_minimums[\s\S]*?\);\n/i, 'the minimum payment CHECK'),
    at(/create or replace function public\.card_period_pending[\s\S]*?\$pending\$;/i, 'card_period_pending'),
    at(/create or replace function public\.trg_fn_period_payment_row_invariants[\s\S]*?\$row_inv\$;/i, 'the row invariants function'),
    at(/drop trigger if exists trg_period_payment_row_invariants[\s\S]*?row_invariants\(\);/i, 'the row invariants trigger'),
    at(/create or replace function public\.trg_fn_period_payment_amount_matches[\s\S]*?\$amount_inv\$;/i, 'the amount identity function'),
    at(/drop trigger if exists trg_period_payment_amount_matches[\s\S]*?amount_matches\(\);/i, 'the amount identity trigger'),
    at(/create or replace function public\.pay_card_period_legs[\s\S]*?\$pay\$;/i, 'pay_card_period_legs'),
    at(/create or replace function public\.confirm_running_cycle[\s\S]*?\$confirm\$;/i, 'confirm_running_cycle'),
    at(/drop function if exists public\.revert_card_period_payment\(uuid\);/i, 'the old revert drop'),
    at(/create or replace function public\.revert_card_period_payment[\s\S]*?\$revert\$;/i, 'revert_card_period_payment'),
    at(/drop policy if exists "users insert own period_payments"[\s\S]*?"users delete own period_payments" on public\.period_payments;/i, 'the write policy drops'),
    // El self-check corre acá: una guarda que nunca se ejecuta no protege nada.
    statement(sql, /DO \$check\$[\s\S]*?\$check\$;/i, 'the self-check', '0061'),
  ]
}

/** `period_payments` as it stands before 0061: 0010's table + 0050's stamp-tax link. */
function periodPaymentsStatements(): string[] {
  const base = read('0010_credit_cards.sql')
  const revert = read('0050_revert_card_period_payment.sql')
  return [
    // card_periods primero: period_payments lo referencia.
    statement(base, /CREATE TABLE public\.card_periods[\s\S]*?\n\);/i, 'card_periods', '0010'),
    statement(base, /CREATE TABLE public\.period_payments[\s\S]*?\n\);/i, 'period_payments', '0010'),
    statement(revert, /alter table public\.period_payments\s+add column if not exists stamp_tax_transaction_id[\s\S]*?;/i, 'the stamp tax link', '0050'),
    statement(revert, /alter table public\.period_payments\s+add column if not exists stamp_tax_link_known[\s\S]*?;/i, 'the stamp tax link flag', '0050'),
    // Las policies de escritura que 0061 quita: sin ellas el drop y el self-check de la
    // sección 7 no probarían nada.
    'alter table public.period_payments enable row level security;',
    statement(base, /CREATE POLICY "users select own period_payments"[\s\S]*?\n  \);/i, 'the select policy', '0010'),
    statement(base, /CREATE POLICY "users insert own period_payments"[\s\S]*?\n  \);/i, 'the insert policy', '0010'),
    statement(base, /CREATE POLICY "users update own period_payments"[\s\S]*?\n  \);/i, 'the update policy', '0010'),
    statement(base, /CREATE POLICY "users delete own period_payments"[\s\S]*?\n  \);/i, 'the delete policy', '0010'),
  ]
}

const STUBS = `
  create schema if not exists auth;
  create table auth.users (id uuid primary key);
  create table public.currencies (code text primary key);
  insert into public.currencies (code) values ('ARS'), ('USD');
  create table public.accounts (
    id uuid primary key,
    user_id uuid not null,
    name text not null default 'Cuenta',
    type text not null default 'bank',
    stamp_tax_rate numeric(10,6)
  );
  create type transaction_type as enum ('income', 'expense', 'reimbursement', 'transfer', 'adjustment', 'settlement');
  create table public.account_currencies (
    account_id uuid not null references public.accounts(id) on delete cascade,
    currency_code text not null references public.currencies(code),
    is_active boolean not null default true,
    primary key (account_id, currency_code)
  );
  create table public.categories (
    id uuid primary key, user_id uuid, canonical_name text not null
  );
  create table public.subcategories (
    id uuid primary key, user_id uuid, canonical_name text not null
  );
  -- auth.uid() en PGlite: lee el mismo GUC que PostgREST setea por request, así que
  -- los tests pueden cambiar de usuario con: set request.jwt.claim.sub.
  create or replace function auth.uid() returns uuid
    language sql stable
    as $uid$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $uid$;
  create table public.transactions (
    -- El default va acá porque la tabla real lo tiene: los RPC insertan sin id.
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null,
    account_id uuid,
    type transaction_type not null,
    amount numeric(18,2) not null,
    currency_code text not null references public.currencies(code),
    date date not null default '2026-09-01',
    status text,
    card_period_id uuid,
    due_date date,
    category_id uuid,
    subcategory_id uuid,
    description text,
    fx_rate_to_ars numeric(18,6),
    received_at timestamptz,
    cancelled_at timestamptz,
    is_parent boolean not null default false
  );
`

export async function createLegsDb(): Promise<PGlite> {
  const db = new PGlite()
  await db.exec(STUBS)
  for (const sql of periodPaymentsStatements()) await db.exec(sql)
  for (const sql of legStatements()) await db.exec(sql)
  return db
}
