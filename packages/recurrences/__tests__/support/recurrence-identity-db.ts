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
export const MIGRATION_0065 = read('0065_delete_seeded_movement_atomically.sql')

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
    status              text not null default 'active',
    -- Snapshot columns the generator copies onto each occurrence. Nullable and
    -- defaulted: these tests are about WHICH dates get materialized, not about
    -- the row payload, which buildPendingInstanceInsert covers as a unit test.
    frequency           text not null default 'monthly',
    movement_type       text not null default 'expense',
    account_id          uuid,
    transfer_destination_account_id uuid,
    currency_code       text not null default 'ARS',
    category_id         uuid,
    subcategory_id      uuid,
    household_id        uuid,
    default_split       jsonb,
    -- The seed link. A rule created from a movement covers its own start_date
    -- with that movement, which is why the generator must not materialize it.
    created_from_transaction_id uuid
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
    account_id               uuid,
    transfer_destination_account_id uuid,
    currency_code            text not null default 'ARS',
    category_id              uuid,
    subcategory_id           uuid,
    description              text,
    household_id             uuid,
    split                    jsonb,

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

  -- Related tables the recurrence reads embed. Reduced to the columns those
  -- selects name; the tests are about which rows come back and in what order,
  -- not about the payload of an account or a category.
  create table public.accounts (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references auth.users(id) on delete cascade,
    name text not null default 'Cuenta',
    type text not null default 'bank',
    is_active boolean not null default true
  );
  create table public.categories (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references auth.users(id) on delete cascade,
    name text not null default 'Categoría',
    canonical_name text not null default 'categoria',
    color text,
    icon text
  );
  create table public.subcategories (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references auth.users(id) on delete cascade,
    category_id uuid references public.categories(id) on delete cascade,
    name text not null default 'Subcategoría',
    canonical_name text not null default 'subcategoria'
  );

  -- Reduced to what the seed link needs. The FK is RESTRICT since 0053: that is
  -- what forces the unlink before the movement can go, and therefore what makes
  -- the two writes inseparable.
  create table public.transactions (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    date date not null default current_date,
    amount numeric(18,2) not null default 1
  );
  alter table public.recurrences
    add constraint recurrences_created_from_transaction_fk
    foreign key (created_from_transaction_id)
    references public.transactions(id) on delete restrict;

  alter table public.transactions enable row level security;
  create policy "own transactions" on public.transactions for all to authenticated
    using (user_id = auth.uid()) with check (user_id = auth.uid());

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
  return db
}

export async function applyMigration(db: PGlite): Promise<void> {
  try {
    await db.exec(MIGRATION_0064)
  } catch (error) {
    // 0064 runs as one transaction and its `commit` is the last statement, so an
    // abort inside it leaves the SESSION in a failed transaction: every later
    // statement comes back "current transaction is aborted" instead of the real
    // answer. Closing it here means a caller that asserts on what the failed
    // migration left behind gets to ask the question at all.
    await db.exec('rollback;').catch(() => undefined)
    throw error
  }
  // 0064 creates two tables, so they need the grant the initial one could not give.
  await grantAll(db)
  // 0065 rides along: it is the atomic delete the seeded-rule repair runs, and
  // every test that applies the expansion wants it available.
  await db.exec(MIGRATION_0065)
}

/** What Supabase grants `authenticated` on every table of `public`. */
export async function grantAll(db: PGlite): Promise<void> {
  await db.exec(
    'grant select, insert, update, delete on all tables in schema public to authenticated;',
  )
}

/**
 * Insert an occurrence as the superuser, in its PRE-migration shape: only
 * `scheduled_date`, with no `due_date`. `confirmed` and `skipped` need
 * `resolved_at`, and `confirmed` a transaction too — 0011's CHECK, which 0064
 * leaves standing.
 */
export async function seedInstance(
  db: PGlite,
  instance: {
    id: string
    recurrence_id: string
    user_id?: string
    scheduled_date: string
    status?: 'pending' | 'skipped' | 'confirmed'
  },
): Promise<void> {
  const status = instance.status ?? 'pending'
  const resolved = status === 'pending' ? 'null' : 'now()'
  const tx = status === 'confirmed' ? `'${instance.id.replace(/^.{8}/, 'ffffffff')}'` : 'null'
  await db.exec(`
    insert into public.recurrence_instances
      (id, recurrence_id, user_id, scheduled_date, status, resolved_at, confirmed_transaction_id)
    values (
      '${instance.id}', '${instance.recurrence_id}', '${instance.user_id ?? U_A}',
      '${instance.scheduled_date}', '${status}', ${resolved}, ${tx}
    );
  `)
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
