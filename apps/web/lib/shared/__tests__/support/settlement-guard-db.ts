import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { PGlite } from '@electric-sql/pglite'

/**
 * Harness de PGlite para las guardas de liquidación (0049 → 0072).
 *
 * Hasta ahora estas guardas se verificaban con aserciones ESTÁTICAS sobre el
 * texto del SQL. Alcanzaba mientras el cambio fuera de forma; acá el cambio es de
 * CRITERIO —qué liquidación protege algo— y un regex no distingue un predicado
 * correcto de uno que bloquea de más. Como lo que está en juego es la deuda entre
 * dos personas, el SQL que se despacha corre contra un Postgres real.
 *
 * Qué carga verbatim: las dos funciones de guarda de 0049, su reemplazo en 0072
 * y el de 0073. Qué está reducido: las tablas, a las columnas que los predicados
 * leen. Los triggers se cuelgan acá porque los originales viven en 0043 y 0048,
 * que arrastran medio módulo Compartido y no cambian nada de lo que se está
 * probando.
 *
 * Y MODELA RLS, porque sin eso el harness no se parecía a la base contra la que
 * el SQL corre. Todo esto pasaba como dueño de las tablas, que no tiene RLS
 * encima, y así un predicado que en producción no ve la mitad de las filas acá
 * las veía todas: el agujero de 0073 —la guarda no se disparaba cuando la
 * liquidación la había registrado el otro miembro— era verde en los tests y
 * falso en la app. `actAs` corre la operación como un rol sin privilegios, con
 * su `auth.uid()`, igual que un usuario de la app.
 */

const MIGRATIONS = resolve(__dirname, '../../../../../../supabase/migrations')
// Normalizado a LF: en Windows con autocrlf el archivo llega con \r\n, y todo
// regex de acá abajo que busque un salto de línea literal deja de encontrarlo.
// Once tests rojos en Windows y verdes en Linux sobre el mismo commit.
const read = (file: string) =>
  readFileSync(resolve(MIGRATIONS, file), 'utf-8').replace(/\r\n/g, '\n')

export const MIGRATION_0049 = read('0049_shared_settlement_guard_temporal.sql')
export const MIGRATION_0072 = read('0072_recurrence_link_movement.sql')
export const MIGRATION_0073 = read('0073_settlement_guards_see_the_whole_truth.sql')

export const HOUSEHOLD = '00000000-0000-0000-0000-00000000h001'.replace('h', 'a')
export const U_PAYER = '00000000-0000-0000-0000-0000000000a1'
export const U_OTHER = '00000000-0000-0000-0000-0000000000b2'

const SCHEMA = `
  create schema if not exists auth;

  -- Lo que hace Supabase: el id del usuario sale del token de la request.
  create or replace function auth.uid() returns uuid language sql stable as $fn$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  $fn$;

  -- El enum real, no \`text\`: \`transactions.type\` es \`transaction_type\` desde
  -- 0008. Declararlo como texto esconde una familia entera de fallos —Postgres
  -- no tiene operador \`enum = text\`— y ya escondió uno: 0072 comparaba contra
  -- \`recurrences.movement_type\`, que sí es texto, y se cayó al aplicarse.
  create type transaction_type as enum (
    'income', 'expense', 'transfer', 'adjustment', 'exchange', 'reimbursement', 'settlement'
  );

  create table public.transactions (
    id           uuid primary key default gen_random_uuid(),
    user_id      uuid not null,
    household_id uuid,
    is_shared    boolean not null default false,
    type         transaction_type not null default 'expense',
    amount       numeric(18,2) not null default 1000,
    currency_code text not null default 'ARS',
    date         date not null,
    due_date     date
  );

  create table public.shared_expense_split (
    transaction_id uuid not null references public.transactions(id) on delete cascade,
    household_id   uuid not null,
    user_id        uuid not null,
    percentage     numeric(5,2) not null default 50,
    amount_assigned numeric(18,2) not null default 500,
    primary key (transaction_id, user_id)
  );

  create table public.household_member (
    household_id uuid not null,
    user_id      uuid not null,
    primary key (household_id, user_id)
  );

  -- 0023, tal cual: SECURITY DEFINER para que consultarla no dependa de RLS.
  create or replace function public.is_household_member(p_household_id uuid)
  returns boolean language sql stable security definer set search_path = public as $fn$
    select exists (
      select 1 from public.household_member
       where household_id = p_household_id and user_id = auth.uid()
    );
  $fn$;

  -- 0044's shape: the reversal preserves the original and adds a counter-entry.
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
`

/**
 * Las políticas de 0023 que estos predicados atraviesan, en su forma mínima. La
 * clave es la asimetría que el defecto explotaba: la FILA `settlement` la ven
 * los dos miembros, pero su FECHA vive en el movimiento del pagador, que es
 * personal y ve sólo su dueño.
 */
const RLS = `
  create role app_user;
  grant usage on schema public to app_user;
  grant select, insert, update, delete
    on public.transactions, public.shared_expense_split, public.settlement,
       public.household_member
    to app_user;

  alter table public.transactions enable row level security;
  create policy tx_select on public.transactions for select using (
    user_id = auth.uid()
    or (is_shared and household_id is not null and public.is_household_member(household_id))
  );
  create policy tx_insert on public.transactions for insert with check (user_id = auth.uid());
  create policy tx_update on public.transactions for update using (user_id = auth.uid());
  create policy tx_delete on public.transactions for delete using (user_id = auth.uid());

  alter table public.shared_expense_split enable row level security;
  create policy split_select on public.shared_expense_split for select
    using (public.is_household_member(household_id));
  create policy split_write on public.shared_expense_split for all
    using (exists (
      select 1 from public.transactions t
       where t.id = shared_expense_split.transaction_id and t.user_id = auth.uid()
    ));

  alter table public.settlement enable row level security;
  create policy settlement_select on public.settlement for select
    using (public.is_household_member(household_id));

  alter table public.household_member enable row level security;
  create policy member_select on public.household_member for select using (true);
`

const TRIGGERS = `
  drop trigger if exists trg_block_shared_delete_with_settlement on public.transactions;
  create trigger trg_block_shared_delete_with_settlement
    before delete on public.transactions
    for each row
    execute function public.trg_fn_block_shared_delete_with_settlement();

  drop trigger if exists trg_block_unshare_with_settlement on public.transactions;
  create trigger trg_block_unshare_with_settlement
    before update on public.transactions
    for each row
    when (OLD.is_shared is true and NEW.is_shared is false)
    execute function public.trg_fn_block_unshare_with_settlement();
`

/**
 * Extrae de una migración sólo las dos funciones de guarda. El resto de 0049 y
 * de 0072 toca objetos que este harness no tiene, y cargarlos completos sería
 * reconstruir dos módulos para probar un predicado.
 */
function guardFunctions(sql: string): string {
  const out: string[] = []
  for (const name of [
    'trg_fn_block_shared_delete_with_settlement',
    'trg_fn_block_unshare_with_settlement',
  ]) {
    // El encabezado cambia entre migraciones (0073 las hace `security definer`),
    // así que se corta por el cuerpo y no por una firma exacta.
    const re = new RegExp(
      `create or replace function public\\.${name}\\(\\)[\\s\\S]*?\\n\\$trg\\$;`,
    )
    const m = sql.match(re)
    if (!m) throw new Error(`no se encontró ${name} en la migración`)
    out.push(m[0])
  }
  return out.join('\n')
}

/** La función de vigencia que 0072 agrega, tal cual se despacha. */
function settlementIsLive(sql: string): string {
  const m = sql.match(
    /create or replace function public\.settlement_is_live\(s public\.settlement\)[\s\S]*?\n\$\$;/,
  )
  if (!m) throw new Error('no se encontró settlement_is_live en 0072')
  return m[0]
}

/** Lo que 0073 agrega alrededor de las guardas: la cobertura y el RPC del mensaje. */
function visibilityFunctions(sql: string): string {
  const out: string[] = []
  for (const [name, tag] of [
    ['settlements_covering', '\\$\\$'],
    ['settlements_blocking_movement', '\\$fn\\$'],
  ]) {
    const re = new RegExp(
      `create or replace function public\\.${name}\\([\\s\\S]*?\\n${tag};`,
    )
    const m = sql.match(re)
    if (!m) throw new Error(`no se encontró ${name} en 0073`)
    out.push(m[0])
  }
  return out.join('\n')
}

/**
 * Hasta qué migración se carga el harness. Tres estados, no un booleano: 0049 es
 * el predicado sin vigencia, 0072 le agrega la vigencia, 0073 le da la visión
 * completa.
 */
export type GuardVintage = '0049' | '0072' | '0073'

export async function createSettlementGuardDb(
  options: { upTo?: GuardVintage } = {},
): Promise<PGlite> {
  const upTo = options.upTo ?? '0073'
  const db = new PGlite()
  await db.exec('create schema if not exists public;')
  await db.exec(SCHEMA)
  await db.exec(guardFunctions(MIGRATION_0049))
  if (upTo !== '0049') {
    await db.exec(settlementIsLive(MIGRATION_0072))
    await db.exec(guardFunctions(MIGRATION_0072))
  }
  if (upTo === '0073') {
    await db.exec(visibilityFunctions(MIGRATION_0073))
    await db.exec(guardFunctions(MIGRATION_0073))
  }
  await db.exec(TRIGGERS)
  await db.exec(RLS)
  for (const u of [U_PAYER, U_OTHER]) {
    await db.exec(
      `insert into public.household_member (household_id, user_id) values ('${HOUSEHOLD}', '${u}');`,
    )
  }
  return db
}

/**
 * Corre lo que sigue como un usuario de la app: rol sin privilegios especiales,
 * con su `auth.uid()`. Sin esto el test es dueño de las tablas y RLS no existe.
 */
export async function actAs(db: PGlite, userId: string): Promise<void> {
  await db.exec(
    `set role app_user; select set_config('request.jwt.claim.sub', '${userId}', false);`,
  )
}

/** Vuelve a ser dueño: para sembrar, y para leer lo que el usuario no ve. */
export async function actAsAdmin(db: PGlite): Promise<void> {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`)
}

/** Un gasto compartido con sus dos splits, que es lo que las guardas protegen. */
export async function seedSharedExpense(
  db: PGlite,
  args: { date: string; currency?: string },
): Promise<string> {
  const { rows } = await db.query<{ id: string }>(
    `insert into public.transactions (user_id, household_id, is_shared, date, currency_code)
     values ('${U_PAYER}', '${HOUSEHOLD}', true, '${args.date}', '${args.currency ?? 'ARS'}')
     returning id`,
  )
  const id = rows[0].id
  for (const u of [U_PAYER, U_OTHER]) {
    await db.exec(`
      insert into public.shared_expense_split (transaction_id, household_id, user_id)
      values ('${id}', '${HOUSEHOLD}', '${u}');
    `)
  }
  return id
}

/** Una liquidación con su pata de pagador, fechada. */
export async function seedSettlement(
  db: PGlite,
  args: {
    date: string
    status: 'pending_receipt' | 'completed'
    currency?: string
    /** Quién la registró. Su pata es un movimiento PERSONAL suyo: el otro no la ve. */
    payer?: string
  },
): Promise<string> {
  const currency = args.currency ?? 'ARS'
  const payer = args.payer ?? U_PAYER
  const receiver = payer === U_PAYER ? U_OTHER : U_PAYER
  const { rows: legs } = await db.query<{ id: string }>(
    `insert into public.transactions (user_id, type, date, currency_code)
     values ('${payer}', 'settlement', '${args.date}', '${currency}') returning id`,
  )
  const { rows } = await db.query<{ id: string }>(
    `insert into public.settlement
       (household_id, payer_id, receiver_id, payer_movement_id, status, currency_code)
     values ('${HOUSEHOLD}', '${payer}', '${receiver}', '${legs[0].id}', '${args.status}',
             '${currency}')
     returning id`,
  )
  return rows[0].id
}

/**
 * Lo que hace `reverse_settlement` (0044) y que importa para las guardas: marca
 * la original `reversed` y agrega el contraasiento, con su pata fechada HOY —
 * posterior a cualquier gasto del pasado, que es de donde venía el bloqueo
 * permanente.
 */
export async function reverseSettlement(
  db: PGlite,
  settlementId: string,
  today: string,
): Promise<void> {
  const { rows: legs } = await db.query<{ id: string }>(
    `insert into public.transactions (user_id, type, date)
     values ('${U_OTHER}', 'settlement', '${today}') returning id`,
  )
  await db.exec(`
    update public.settlement set status = 'reversed', reversed_at = now()
     where id = '${settlementId}';
    insert into public.settlement
      (household_id, payer_id, receiver_id, payer_movement_id, status, reverses_settlement_id)
    values ('${HOUSEHOLD}', '${U_OTHER}', '${U_PAYER}', '${legs[0].id}', 'contra',
            '${settlementId}');
  `)
}

/** Cancelar una pendiente: se borra la pata del pagador y la fila se va con ella. */
export async function cancelPendingSettlement(
  db: PGlite,
  settlementId: string,
): Promise<void> {
  await db.exec(`delete from public.settlement where id = '${settlementId}';`)
}

/** El SQLSTATE que dejó una operación, o null si no falló. */
export async function sqlstateOf(db: PGlite, sql: string): Promise<string | null> {
  try {
    await db.exec(sql)
    return null
  } catch (error) {
    return (error as { code?: string }).code ?? 'unknown'
  }
}
