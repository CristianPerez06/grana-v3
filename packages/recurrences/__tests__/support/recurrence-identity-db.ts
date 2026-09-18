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
// Normalizado a LF: en Windows con autocrlf el archivo llega con \r\n, y todo
// regex de acá abajo que busque un salto de línea literal deja de encontrarlo.
// Once tests rojos en Windows y verdes en Linux sobre el mismo commit.
const read = (file: string) =>
  readFileSync(resolve(MIGRATIONS, file), 'utf-8').replace(/\r\n/g, '\n')

export const MIGRATION_0064 = read('0064_recurrence_identity_expand.sql')
export const MIGRATION_0065 = read('0065_delete_seeded_movement_atomically.sql')
export const MIGRATION_ACTIVATE = read('0066_recurrence_backlog_activate.sql')
export const MIGRATION_0068 = read('0068_schedule_version_effective_until.sql')
export const MIGRATION_0069 = read('0069_repair_seed_occurrence_identity.sql')
export const MIGRATION_0070 = read('0070_recurrence_positions_spent_batch.sql')
export const MIGRATION_0071 = read('0071_pause_looks_forward.sql')
export const MIGRATION_0072 = read('0072_recurrence_link_movement.sql')

export const U_A = '00000000-0000-0000-0000-0000000000a1'
export const U_B = '00000000-0000-0000-0000-0000000000b2'

const SCHEMA = `
  create schema auth;
  create table auth.users (id uuid primary key, email text);
  create function auth.uid() returns uuid language sql stable as $$
    select (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')::uuid
  $$;
  create role authenticated;
  -- PostgREST's anonymous role. Present because the migrations revoke privileges
  -- from it by name, and a revoke against a role that does not exist is an error
  -- — the harness has to look like the database the SQL is written for.
  create role anon;
  grant usage on schema public to authenticated;
  grant usage on schema auth to authenticated;

  -- LOS TIPOS ENUMERADOS REALES, no \`text\`. \`transactions.type\` es el enum
  -- \`transaction_type\` desde 0008 (0009/0014/0017/0022 le fueron agregando
  -- valores) y \`accounts.type\` es \`account_type\` desde 0007/0010. El arnés los
  -- declaraba como texto, y eso no es un detalle: Postgres NO tiene un operador
  -- \`enum = text\`, así que una comparación contra una columna de texto —como
  -- \`recurrences.movement_type\`, que sí lo es— falla en la base real y pasaba
  -- verde acá. 0072 se cayó al aplicarse por exactamente eso.
  create type transaction_type as enum (
    'income', 'expense', 'transfer', 'adjustment', 'exchange', 'reimbursement', 'settlement'
  );
  create type account_type as enum ('cash', 'bank', 'credit');

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
    created_from_transaction_id uuid,
    -- Read by the hub's mapper. Present because the shipped read selects every
    -- column, and a harness table missing one the app reads is a harness that can
    -- only test the functions, never the path that feeds them.
    created_at          timestamptz not null default now()
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
    type account_type not null default 'bank',
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
    amount numeric(18,2) not null default 1,
    -- Columnas que leen los RPC de vinculación (0072). Nullable y con default:
    -- los tests del seed link no las nombran y siguen viendo la misma tabla.
    type transaction_type not null default 'expense',
    currency_code text not null default 'ARS',
    account_id uuid,
    category_id uuid,
    subcategory_id uuid,
    description text,
    is_shared boolean not null default false,
    household_id uuid,
    is_parent boolean not null default false,
    due_date date
  );

  -- El reparto por miembro, y la liquidación: lo que la rama compartida de
  -- vincular escribe y lo que la guarda de 0049/0072 protege.
  create table public.shared_expense_split (
    transaction_id uuid not null references public.transactions(id) on delete cascade,
    household_id   uuid not null,
    user_id        uuid not null,
    percentage     numeric(5,2) not null,
    amount_assigned numeric(18,2) not null,
    primary key (transaction_id, user_id)
  );

  create table public.settlement (
    id                     uuid primary key default gen_random_uuid(),
    household_id           uuid not null,
    payer_id               uuid not null,
    receiver_id            uuid not null,
    payer_movement_id      uuid references public.transactions(id) on delete set null,
    receiver_movement_id   uuid references public.transactions(id) on delete set null,
    amount                 numeric(18,2) not null default 1000,
    currency_code          text not null default 'ARS',
    status                 text not null default 'pending_receipt',
    reversed_at            timestamptz,
    reverses_settlement_id uuid references public.settlement(id) on delete set null,
    constraint chk_settlement_status
      check (status in ('pending_receipt', 'completed', 'reversed', 'contra'))
  );

  alter table public.shared_expense_split enable row level security;
  create policy "own splits" on public.shared_expense_split for all to authenticated
    using (true) with check (true);
  alter table public.settlement enable row level security;
  create policy "own settlements" on public.settlement for all to authenticated
    using (true) with check (true);
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

  -- unshare_movement reducido a lo que el RPC de desvincular le pide: bajar la
  -- bandera y borrar los repartos. Lo que NO se estira es la guarda: los triggers
  -- reales de 0049/0072 se cuelgan abajo, así que el camino GRN01 —el que decide
  -- si desvincular se completa o no cambia nada— se ejercita de verdad.
  create or replace function public.unshare_movement(p_root_id uuid)
  returns void language plpgsql security invoker as $unshare$
  begin
    update public.transactions set is_shared = false, household_id = null
     where id = p_root_id;
    delete from public.shared_expense_split where transaction_id = p_root_id;
  end $unshare$;

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
/**
 * The schema as production has it — which after #121 includes 0068, because the
 * code SELECTS `effective_until` and would fail against a database without it.
 * That is not an accident of the harness: it is the deployment order, and a test
 * building the pre-0068 world is testing a state the app is never deployed into.
 *
 * `scheduleGap: false` is for the tests that assert on an EARLIER state on
 * purpose — 0064's own behaviour, or what 0066 refuses to run against.
 */
export async function createRecurrenceIdentityDb(
  options: { applyMigration?: boolean; scheduleGap?: boolean; seedRepair?: boolean } = {},
): Promise<PGlite> {
  const db = new PGlite()
  await db.exec('create schema if not exists public;')
  await db.exec(SCHEMA)
  await db.exec(SEED)
  if (options.applyMigration !== false) {
    await applyMigration(db)
    if (options.scheduleGap !== false) {
      await applyEffectiveUntil(db)
      // 0069 rides along by default, as 0065 does with 0064: the schema every
      // test should see is the one production is going to have.
      if (options.seedRepair !== false) await applySeedRepair(db)
      // And 0070, for the same reason: the hub's read calls it, so a harness
      // without it tests a path production does not have.
      await applyPositionsBatch(db)
      // 0071 too: a pause that swallows its own opening day is not the schema
      // production is going to have.
      await applyPauseLooksForward(db)
      // And 0072, for the same reason: the count that decides whether a rule
      // still owes money is the one production runs.
      await applyLinkMovement(db)
    }
  }
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

/**
 * 0068: a schedule version can stop before the next one starts, and moving an
 * anchor has to say from when. Separate from `applyMigration` because the tests
 * of the expansion itself assert on the world BEFORE this one — the trigger it
 * replaces is 0064's, and a test that pinned 0064's behaviour has to keep
 * pinning it.
 */
export async function applyEffectiveUntil(db: PGlite): Promise<void> {
  try {
    await db.exec(MIGRATION_0068)
  } catch (error) {
    await db.exec('rollback;').catch(() => undefined)
    throw error
  }
}

/**
 * The ACTIVATION (0066): retires `recurrence_instances_one_pending_per_rule`.
 *
 * Applied from the shipped file, never as a hand-written `drop index`. The
 * migration refuses to run unless the new model is in place, and a test that
 * dropped the index itself would prove the generator works in a state the
 * migration would not have produced.
 */
/**
 * 0069: the seed occurrence, repaired where 0068's backfill guessed it from an
 * anchor that had already moved.
 */
export async function applySeedRepair(db: PGlite): Promise<void> {
  try {
    await db.exec(MIGRATION_0069)
  } catch (error) {
    await db.exec('rollback;').catch(() => undefined)
    throw error
  }
}

/**
 * 0070: the same spent-positions count, asked for many rules at once.
 *
 * Exported as well as applied by default, so the frontier tests can build a
 * database WITHOUT it and watch the validator refuse.
 */
export async function applyPositionsBatch(db: PGlite): Promise<void> {
  try {
    await db.exec(MIGRATION_0070)
  } catch (error) {
    await db.exec('rollback;').catch(() => undefined)
    throw error
  }
}

/**
 * 0071: a pause looks forward — the day it is opened still belongs to the
 * calendar. Exported as well as applied by default, so a test can build the
 * database WITHOUT it and watch the old behaviour lose a spent position.
 */
export async function applyPauseLooksForward(db: PGlite): Promise<void> {
  try {
    await db.exec(MIGRATION_0071)
  } catch (error) {
    await db.exec('rollback;').catch(() => undefined)
    throw error
  }
}

/**
 * 0072: registrar un pago antes del vencimiento, vincular y desvincular. Se
 * exporta además de aplicarse por defecto, para que un test pueda construir la
 * base SIN ella y ver el conteo viejo perder una posición resuelta por
 * anticipado.
 */
export async function applyLinkMovement(db: PGlite): Promise<void> {
  try {
    await db.exec(MIGRATION_0072)
  } catch (error) {
    await db.exec('rollback;').catch(() => undefined)
    throw error
  }
  // 0072 crea funciones nuevas, así que necesitan el grant que el harness inicial
  // no pudo darles.
  await grantAll(db)
  // Las guardas de liquidación viven en 0043/0048, que arrastran medio módulo
  // Compartido. Se cuelgan acá los triggers sobre las funciones que 0072 acaba de
  // definir: lo que se está probando es el predicado, no el alta del trigger.
  await db.exec(`
    drop trigger if exists trg_block_unshare_with_settlement on public.transactions;
    create trigger trg_block_unshare_with_settlement
      before update on public.transactions
      for each row
      when (OLD.is_shared is true and NEW.is_shared is false)
      execute function public.trg_fn_block_unshare_with_settlement();
  `)
}

export async function applyActivation(db: PGlite): Promise<void> {
  try {
    await db.exec(MIGRATION_ACTIVATE)
  } catch (error) {
    // Same reason as `applyMigration`: the file is one transaction whose
    // `commit` is the last statement, so an abort inside it leaves the session
    // in a failed transaction and every later question answers "current
    // transaction is aborted" instead of the truth.
    await db.exec('rollback;').catch(() => undefined)
    throw error
  }
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
