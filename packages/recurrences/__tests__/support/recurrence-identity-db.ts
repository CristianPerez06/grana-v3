import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { PGlite } from '@electric-sql/pglite'

/**
 * PGlite harness for migration 0064 (recurrence occurrence identity).
 *
 * The repo is online-only, so the shipped SQL runs on a real Postgres compiled to
 * WASM. Like the household-categories harness, this one exercises RLS and the
 * `authenticated` role at runtime: several of 0064's guarantees are about what a
 * client CANNOT do — move an occurrence's identity, move a rule's reconstruction
 * floor, write the schedule history — and asserting those as the superuser would
 * prove nothing.
 *
 * What loads verbatim: 0064 in full, `begin` … `commit` included. What is
 * stubbed: `auth.uid()` (reads the claims the tests set) and the two recurrence
 * tables, reduced to the columns 0064 reads or writes, with 0011's real
 * single-pending index and its status/resolution CHECK — the invariant the
 * expansion must leave standing.
 */

const MIGRATIONS = resolve(__dirname, '../../../../supabase/migrations')
const read = (file: string) => readFileSync(resolve(MIGRATIONS, file), 'utf-8')

export const MIGRATION_0064 = read('0064_recurrence_identity_expand.sql')

export const U_A = '00000000-0000-0000-0000-0000000000a1'
export const U_B = '00000000-0000-0000-0000-0000000000b2'

const SCHEMA = `
  create schema auth;
  create table auth.users (id uuid primary key, email text);
  create function auth.uid() returns uuid language sql stable as $$
    select (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')::uuid
  $$;
  create role authenticated;
  grant usage on schema public to authenticated;
  grant usage on schema auth to authenticated;

  create table public.recurrences (
    id                  uuid primary key default gen_random_uuid(),
    user_id             uuid not null references auth.users(id) on delete cascade,
    amount              numeric(18,2) not null default 1,
    description         text,
    interval_count      int  not null default 1,
    interval_unit       text not null default 'month',
    start_date          date not null,
    end_date            date,
    last_generated_date date,
    max_occurrences     int,
    status              text not null default 'active'
  );

  create table public.recurrence_instances (
    id                       uuid primary key default gen_random_uuid(),
    recurrence_id            uuid not null references public.recurrences(id) on delete cascade,
    user_id                  uuid not null references auth.users(id) on delete cascade,
    scheduled_date           date not null,
    status                   text not null default 'pending',
    amount                   numeric(18,2) not null default 1,
    confirmed_transaction_id uuid,
    created_at               timestamptz not null default now(),
    resolved_at              timestamptz,

    constraint chk_recurrence_instances_status
      check (status in ('pending', 'skipped', 'confirmed')),
    -- 0011 verbatim. 0064 adds resolution_kind on top of these three states.
    constraint chk_recurrence_instances_pending_unresolved
      check (
        (status = 'pending'   and resolved_at is null     and confirmed_transaction_id is null) or
        (status = 'skipped'   and resolved_at is not null and confirmed_transaction_id is null) or
        (status = 'confirmed' and resolved_at is not null and confirmed_transaction_id is not null)
      )
  );

  -- 0011's invariant, and the one the EXPANSION must leave standing: the app
  -- still sees exactly one pending occurrence per rule until the activation.
  create unique index recurrence_instances_one_pending_per_rule
    on public.recurrence_instances (recurrence_id)
    where status = 'pending';

  alter table public.recurrences enable row level security;
  create policy "users select own recurrences" on public.recurrences for select to authenticated
    using (user_id = auth.uid());
  -- 0011's policy, unchanged: the user updates their own rules. It is what makes
  -- the reconstruct_from guard necessary — RLS grants the whole row, so freezing
  -- one column is a trigger's job.
  create policy "users update own recurrences" on public.recurrences for update to authenticated
    using (user_id = auth.uid()) with check (user_id = auth.uid());
  create policy "users insert own recurrences" on public.recurrences for insert to authenticated
    with check (user_id = auth.uid());
  create policy "users delete own recurrences" on public.recurrences for delete to authenticated
    using (user_id = auth.uid());

  alter table public.recurrence_instances enable row level security;
  create policy "own instances" on public.recurrence_instances for all to authenticated
    using (user_id = auth.uid()) with check (user_id = auth.uid());

  grant select, insert, update, delete on all tables in schema public to authenticated;
`

const SEED = `
  insert into auth.users (id) values ('${U_A}'), ('${U_B}');
`

/**
 * A fresh Postgres with the two recurrence tables, 0011's index and policies,
 * two users, and — unless `applyMigration` is false — 0064 applied on top.
 */
export async function createRecurrenceIdentityDb(
  options: { applyMigration?: boolean } = {},
): Promise<PGlite> {
  const db = new PGlite()
  await db.exec('create schema if not exists public;')
  await db.exec(SCHEMA)
  await db.exec(SEED)
  if (options.applyMigration !== false) await applyMigration(db)
  // 0064 creates two tables AFTER the blanket grant above, so they need their own.
  await db.exec(
    'grant select, insert, update, delete on all tables in schema public to authenticated;',
  )
  return db
}

export async function applyMigration(db: PGlite): Promise<void> {
  await db.exec(MIGRATION_0064)
}

/** Insert a rule as the superuser and return its id. */
export async function seedRule(
  db: PGlite,
  rule: {
    id: string
    user_id?: string
    start_date?: string
    last_generated_date?: string | null
    interval_count?: number
    interval_unit?: string
    status?: string
  },
): Promise<void> {
  await db.exec(`
    insert into public.recurrences
      (id, user_id, start_date, last_generated_date, interval_count, interval_unit, status)
    values (
      '${rule.id}', '${rule.user_id ?? U_A}', '${rule.start_date ?? '2026-05-01'}',
      ${rule.last_generated_date == null ? 'null' : `'${rule.last_generated_date}'`},
      ${rule.interval_count ?? 1}, '${rule.interval_unit ?? 'month'}', '${rule.status ?? 'active'}'
    );
  `)
}

/** Run the following statements as `userId`, the way PostgREST would. */
export async function actAs(db: PGlite, userId: string): Promise<void> {
  await db.exec(
    `select set_config('request.jwt.claims', '{"sub":"${userId}","role":"authenticated"}', false); set role authenticated;`,
  )
}

/** Back to the superuser: RLS off, for seeding and for asserting on raw rows. */
export async function actAsAdmin(db: PGlite): Promise<void> {
  await db.exec(`reset role; select set_config('request.jwt.claims', '', false);`)
}

/** The SQLSTATE a rejected write came back with, or null if it succeeded. */
export async function sqlstateOf(db: PGlite, sql: string): Promise<string | null> {
  try {
    await db.exec(sql)
    return null
  } catch (error) {
    return (error as { code?: string }).code ?? 'UNKNOWN'
  }
}
