import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { PGlite } from '@electric-sql/pglite'

/**
 * PGlite harness for migration 0063 (household categories).
 *
 * The repo is online-only, so the shipped SQL runs on a real Postgres compiled to
 * WASM. Unlike the balance harnesses, this one exercises RLS at runtime: the
 * migration's whole point is who can read, use and edit a category, so the tests
 * run statements AS a given user (`authenticated` role + JWT claims, the way
 * PostgREST does) and assert on what each one sees.
 *
 * What loads verbatim: 0005's `categories` / `subcategories` DDL and their four
 * original policies (the ones 0063 drops and replaces), 0023's
 * `is_household_member`, and 0063 in full — `begin` … `commit`, self-check
 * included. What is stubbed: `auth.uid()` (reads the claims the tests set) and the
 * three movement tables (`transactions`, `recurrences`, `recurrence_instances`),
 * reduced to the columns the triggers and the leave RPC touch.
 */

const MIGRATIONS = resolve(__dirname, '../../../../../../supabase/migrations')
const read = (file: string) => readFileSync(resolve(MIGRATIONS, file), 'utf-8')

export const MIGRATION_0063 = read('0063_household_categories.sql')

function isHouseholdMemberFn(): string {
  const m = read('0023_shared.sql').match(
    /create or replace function public\.is_household_member[\s\S]*?\$\$;/i,
  )
  if (!m) throw new Error('is_household_member not found in 0023')
  return m[0]
}

const SCHEMA = `
  create schema auth;
  create table auth.users (id uuid primary key, email text);
  create function auth.uid() returns uuid language sql stable as $$
    select (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')::uuid
  $$;
  create role authenticated;
  grant usage on schema public to authenticated;
  -- Supabase grants this too: a SECURITY INVOKER function calls auth.uid() as the caller.
  grant usage on schema auth to authenticated;

  create table public.household (
    id        uuid primary key default gen_random_uuid(),
    name      text not null default 'Casa',
    is_active boolean not null default true
  );
  create table public.household_member (
    id           uuid primary key default gen_random_uuid(),
    household_id uuid not null references public.household(id) on delete cascade,
    user_id      uuid not null references auth.users(id) on delete cascade,
    unique (household_id, user_id)
  );

  create table public.transactions (
    id             uuid primary key default gen_random_uuid(),
    user_id        uuid not null,
    household_id   uuid references public.household(id) on delete set null,
    is_shared      boolean not null default false,
    category_id    uuid references public.categories(id) on delete restrict,
    subcategory_id uuid references public.subcategories(id) on delete restrict,
    amount         numeric(18,2) not null default 1,
    date           date not null default current_date
  );
  create table public.recurrences (
    id             uuid primary key default gen_random_uuid(),
    user_id        uuid not null,
    household_id   uuid references public.household(id) on delete set null,
    category_id    uuid references public.categories(id) on delete restrict,
    subcategory_id uuid references public.subcategories(id) on delete restrict,
    status         text not null default 'active'
  );

  create table public.recurrence_instances (
    id             uuid primary key default gen_random_uuid(),
    recurrence_id  uuid not null references public.recurrences(id) on delete cascade,
    user_id        uuid not null,
    category_id    uuid references public.categories(id) on delete set null,
    subcategory_id uuid references public.subcategories(id) on delete set null,
    status         text not null default 'pending'
  );

  alter table public.transactions enable row level security;
  create policy "own or shared" on public.transactions for all to authenticated
    using (user_id = auth.uid() or (is_shared and household_id is not null and public.is_household_member(household_id)))
    with check (user_id = auth.uid());
  alter table public.recurrences enable row level security;
  create policy "own" on public.recurrences for all to authenticated
    using (user_id = auth.uid()) with check (user_id = auth.uid());
  alter table public.recurrence_instances enable row level security;
  create policy "own" on public.recurrence_instances for all to authenticated
    using (user_id = auth.uid()) with check (user_id = auth.uid());

  grant select, insert, update, delete on all tables in schema public to authenticated;
`

export const U_A = '00000000-0000-0000-0000-0000000000a1'
export const U_B = '00000000-0000-0000-0000-0000000000b2'
export const U_C = '00000000-0000-0000-0000-0000000000c3'
export const HH = '00000000-0000-0000-0000-00000000aa01'

const SEED = `
  insert into auth.users (id) values ('${U_A}'), ('${U_B}'), ('${U_C}');
  insert into public.household (id) values ('${HH}');
  insert into public.household_member (household_id, user_id) values ('${HH}', '${U_A}'), ('${HH}', '${U_B}');
`

/**
 * A fresh Postgres with 0005's tables and policies, 0023's membership helper,
 * three users (A and B share a household; C is outside), and — unless
 * `applyMigration` is false — 0063 applied on top.
 */
export async function createHouseholdCategoriesDb(
  options: { applyMigration?: boolean } = {},
): Promise<PGlite> {
  const db = new PGlite()
  await db.exec('create schema if not exists public;')
  await db.exec(SCHEMA.replace(/create table public\.transactions[\s\S]*$/, ''))
  // 0005 verbatim: tables, unique indexes and the four policies per table.
  await db.exec(read('0005_categories.sql'))
  await db.exec(isHouseholdMemberFn())
  // The movement tables reference categories, so they come after 0005.
  await db.exec(SCHEMA.match(/create table public\.transactions[\s\S]*$/)![0])
  await db.exec(SEED)
  if (options.applyMigration !== false) await applyMigration(db)
  return db
}

export async function applyMigration(db: PGlite): Promise<void> {
  await db.exec(MIGRATION_0063)
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

export const lit = (v: unknown) => (v == null ? 'null' : `'${String(v).replace(/'/g, "''")}'`)
