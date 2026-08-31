-- Guardar — reserva de disponibilidad, y el disponible real como lectura única.
--
-- Run AFTER 0056_reactivate_verduleria.sql.
--
-- ===================================================================
-- OJO: la definición de `get_available_sums` que está acá abajo quedó
-- OBSOLETA. Omite el saldo inicial de las cuentas, que es el bug crítico
-- que la 0060_available_sums_initial_balance.sql corrigió.
--
-- Aplicar las migraciones EN ORDEN queda bien: la 0060 va después y la
-- redefine. Re-ejecutar ESTA SOLA reintroduce el bug — «Para gastar»
-- vuelve a mostrar un número más chico que el real, y como «Tenías» se
-- deriva de él, se corren todos los términos de la card sin dejar de
-- cerrar. Si hay que reaplicar esta, correr la 0060 inmediatamente
-- después.
-- ===================================================================
--
-- Hasta acá Grana no tenía forma de expresar la decisión más básica del ahorro:
-- "esto que tengo, decidí que no lo voy a gastar". El usuario que aparta plata
-- mentalmente seguía viendo ese dinero contado como disponible.
--
-- Lo que esta migración agrega NO es un movimiento. Guardar no mueve plata: la
-- plata sigue en las mismas cuentas, y lo único que cambia es su FUNCIÓN. Por eso
-- vive en una tabla propia y no en `transactions` — meterla ahí obligaría a
-- inventar un hecho financiero que el banco nunca vio, y rompería el invariante
-- que sostiene todo el ledger: las transacciones son hechos.
--
-- El nombre `availability_reserve` es deliberado y NO es "savings": lo que la
-- tabla registra es una **reserva de disponibilidad** ("de la plata que hoy podría
-- gastar, decidí no tocar este monto"), no un concepto patrimonial. Un plazo fijo
-- o una tenencia en dólares NO van acá — esos son posiciones, y son de otra fase.
-- La capability de producto sí se llama `savings` y la UI dice "Guardar": el repo
-- ya nombra en técnico preciso lo que el producto llama distinto (`card_periods`
-- es "el resumen").
--
-- Agrega dos funciones, y las dos son NORMATIVAS:
--
--   · get_available_sums(date)              — STOCK. Por moneda: el neto de las
--     cuentas propias cortado a la fecha, lo reservado vigente, y el disponible
--     real ya restado. Tiene TRES consumidores (el Hero, el tope del drawer y la
--     validación del write path).
--   · get_reserve_flow_sums(date,date,date) — FLUJO. Por moneda, el neto
--     reservado en un rango, para la fila "Guardaste este mes".
--
-- Las dos existen por la lección que el repo ya aprendió en 0051: el criterio de
-- "cuenta propia" estaba replicado a mano en cada call site **y ya había
-- divergido** (una lectura omitía `is_active` mientras el Hero lo aplicaba). Si la
-- resta del guardado viviera en tres composiciones de TS (web, mobile, dashboard),
-- el próximo read que se olvide de restarla produce un segundo "disponible" en la
-- misma pantalla. Un concepto de plata, una definición, en SQL.
--
-- No tocan `get_owned_account_ids` ni `get_account_balance_sums`: componen sobre
-- ellas. SECURITY INVOKER como todo el resto: RLS aplica con los permisos del que
-- llama.
--
-- Aditiva: tabla nueva, dos funciones nuevas, cero cambios a lo existente.

begin;

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. availability_reserve — la decisión, con signo
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Una fila por acto: guardar es positivo, liberar es negativo. El total guardado
-- se DERIVA de la suma de las filas y no se persiste en ninguna columna, igual
-- que todo saldo en Grana.
--
-- Sin `account_id`, y no es un olvido: una reserva NO se ancla a una cuenta.
-- Anclarla afirmaría que ese dinero está en un lugar puntual cuando en realidad
-- está repartido en todas las cuentas del usuario — sería simular un movimiento
-- que no ocurrió, y reintroduciría la imputación de los retiros parciales
-- (¿esos $50.000 que sacaste salieron del guardado o de lo libre?).
--
-- Sin CHECK de signo: la tabla acepta las dos direcciones. El tope de guardar
-- (no más que el disponible) y el piso de liberar (no más que lo reservado)
-- dependen del estado del servidor al momento de la operación, así que viven en
-- el write path, no en un constraint.

create table public.availability_reserve (
  id            uuid          primary key default gen_random_uuid(),
  user_id       uuid          not null references auth.users(id) on delete cascade,
  currency_code text          not null references public.currencies(code),
  amount        numeric(18,2) not null,
  date          date          not null,
  created_at    timestamptz   not null default now(),

  constraint chk_availability_reserve_amount_nonzero check (amount <> 0)
);

comment on table public.availability_reserve is
  'Reserva de disponibilidad: "de la plata que podría gastar, decidí no tocar este monto". NO es un movimiento — no toca ningún saldo de cuenta y no aparece en Movimientos. Monto con signo: guardar positivo, liberar negativo. El total se deriva, nunca se persiste.';

comment on column public.availability_reserve.amount is
  'Con signo: positivo = guardar, negativo = liberar. El stock de una moneda es la suma de sus filas.';

comment on column public.availability_reserve.date is
  'Fecha contable de la decisión. Sujeta al mismo corte temporal que el resto: una reserva futura existe pero no descuenta el disponible hasta que su fecha llegue.';

-- ─── Indexes ─────────────────────────────────────────────────────────────────
--
-- Es el predicado exacto de las dos funciones: filtrar por usuario y moneda,
-- acotado por fecha.

create index idx_availability_reserve_user_currency_date
  on public.availability_reserve (user_id, currency_code, date);

-- ─── RLS ─────────────────────────────────────────────────────────────────────

alter table public.availability_reserve enable row level security;

create policy "users select own availability reserves"
  on public.availability_reserve for select
  using (user_id = auth.uid());

create policy "users insert own availability reserves"
  on public.availability_reserve for insert
  with check (user_id = auth.uid());

create policy "users update own availability reserves"
  on public.availability_reserve for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "users delete own availability reserves"
  on public.availability_reserve for delete
  using (user_id = auth.uid());

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. get_available_sums — STOCK: cuánto hay y cuánto se puede gastar, a una fecha
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Devuelve, por moneda:
--   accounts_net  el neto de las cuentas propias a la fecha de corte
--   reserved      lo guardado vigente a esa fecha (suma con signo)
--   available     accounts_net − reserved, YA RESTADO
--
-- `available` viene calculado a propósito. Si la función devolviera solo las dos
-- primeras columnas, cada consumidor haría la resta por su cuenta y volveríamos
-- al problema de 0051 con otro nombre.
--
-- El corte temporal es el mismo del resto: `date <= hoy`, donde "hoy" es la fecha
-- calendario en el timezone financiero AR. NUNCA `current_date` a secas — el
-- servidor corre en UTC y adelantaría el corte hasta 3 horas.
--
-- Devuelve fila para toda moneda que aparezca en CUALQUIERA de los dos lados, con
-- cero del lado que falte: un usuario con saldo en pesos y sin reservas en pesos
-- tiene que recibir `reserved = 0`, no la ausencia de la fila, o cada consumidor
-- tendría que inventar el default.
--
-- El disponible puede quedar NEGATIVO y se devuelve tal cual. Si el usuario gastó
-- por encima de lo que había apartado, ese es el hecho; reducir la reserva para
-- que el número cierre sería revocarle en silencio una decisión que no revocó.

create or replace function public.get_available_sums(
  p_today date default null
)
returns table (
  currency_code text,
  accounts_net  numeric,
  reserved      numeric,
  available     numeric
)
language sql
stable
security invoker
set search_path = public
as $$
with cut as (
  select coalesce(
    p_today,
    (now() at time zone 'America/Argentina/Buenos_Aires')::date
  ) as d
),
accounts as (
  select b.currency_code as code, sum(b.net)::numeric as net
  from public.get_account_balance_sums(null, (select d from cut)) b
  group by b.currency_code
),
reserves as (
  select r.currency_code as code, sum(r.amount)::numeric as reserved
  from public.availability_reserve r
  where r.date <= (select d from cut)
    and r.currency_code in ('ARS', 'USD')
  group by r.currency_code
),
codes as (
  select a.code from accounts a
  union
  select r.code from reserves r
)
-- Los ceros se escriben `0.00` y no `0`: los montos de plata son numeric(18,2) y
-- una columna que a veces vuelve con escala y a veces sin ella es una fuente de
-- comparaciones sorpresa aguas abajo.
select
  c.code                                                              as currency_code,
  coalesce(a.net, 0.00)::numeric                                      as accounts_net,
  coalesce(r.reserved, 0.00)::numeric                                 as reserved,
  (coalesce(a.net, 0.00) - coalesce(r.reserved, 0.00))::numeric       as available
from codes c
left join accounts a on a.code = c.code
left join reserves r on r.code = c.code
$$;

comment on function public.get_available_sums(date) is
  'Definición normativa del disponible real, por moneda: neto de cuentas propias menos lo reservado, cortado a hoy (timezone financiero AR, o p_today). Devuelve la resta YA HECHA — el Hero, el tope del drawer y la validación del write path la consumen, ninguno la recompone.';

revoke execute on function public.get_available_sums(date) from public;
grant  execute on function public.get_available_sums(date) to authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. get_reserve_flow_sums — FLUJO: cuánto se reservó neto en un rango
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Alimenta la fila "Guardaste este mes" del dashboard, que es un FLUJO y no el
-- stock acumulado: poner el acumulado rompe la identidad de la card
-- (`Tenías + Entró − Se fué − Guardaste = Disponible`).
--
-- El neto puede ser negativo — un mes en que se liberó más de lo que se guardó —
-- y se devuelve con su signo. La UI gira el verbo con él ("Liberaste este mes").
--
-- El rango se acota además a la fecha de corte: una reserva fechada mañana no
-- participa del flujo de este mes aunque `p_to` sea el último día del mes. Para
-- un mes pasado el clamp es un no-op.

create or replace function public.get_reserve_flow_sums(
  p_from  date,
  p_to    date,
  p_today date default null
)
returns table (
  currency_code text,
  reserved_net  numeric
)
language sql
stable
security invoker
set search_path = public
as $$
with cut as (
  select least(
    p_to,
    coalesce(
      p_today,
      (now() at time zone 'America/Argentina/Buenos_Aires')::date
    )
  ) as d
)
select
  r.currency_code,
  sum(r.amount)::numeric as reserved_net
from public.availability_reserve r
where r.date >= p_from
  and r.date <= (select d from cut)
  and r.currency_code in ('ARS', 'USD')
group by r.currency_code
$$;

comment on function public.get_reserve_flow_sums(date, date, date) is
  'Neto reservado (guardado menos liberado) en un rango, por moneda, acotado al corte temporal. Es el FLUJO del período, nunca el stock acumulado: la fila del dashboard lo consume tal cual.';

revoke execute on function public.get_reserve_flow_sums(date, date, date) from public;
grant  execute on function public.get_reserve_flow_sums(date, date, date) to authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- 4. Self-check
-- ═══════════════════════════════════════════════════════════════════════════

do $check$
declare
  v_rls_enabled boolean;
  v_policies    int;
  v_secdef      boolean;
begin
  -- La tabla existe y no tiene account_id: una reserva es por moneda, no por cuenta.
  if not exists (
    select 1 from information_schema.tables
     where table_schema = 'public' and table_name = 'availability_reserve'
  ) then
    raise exception 'SELF-CHECK FAILED: availability_reserve missing';
  end if;

  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'availability_reserve'
       and column_name = 'account_id'
  ) then
    raise exception 'SELF-CHECK FAILED: availability_reserve must NOT anchor a reserve to an account';
  end if;

  -- RLS encendido con las cuatro operaciones cubiertas.
  select c.relrowsecurity into v_rls_enabled
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relname = 'availability_reserve';
  if v_rls_enabled is distinct from true then
    raise exception 'SELF-CHECK FAILED: RLS not enabled on availability_reserve';
  end if;

  select count(*) into v_policies
    from pg_policies
   where schemaname = 'public' and tablename = 'availability_reserve';
  if v_policies < 4 then
    raise exception 'SELF-CHECK FAILED: expected 4 policies on availability_reserve, found %', v_policies;
  end if;

  -- Las dos funciones existen y son SECURITY INVOKER.
  select p.prosecdef into v_secdef
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'get_available_sums';
  if v_secdef is null then
    raise exception 'SELF-CHECK FAILED: get_available_sums missing';
  end if;
  if v_secdef is distinct from false then
    raise exception 'SELF-CHECK FAILED: get_available_sums must be SECURITY INVOKER';
  end if;

  select p.prosecdef into v_secdef
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'get_reserve_flow_sums';
  if v_secdef is null then
    raise exception 'SELF-CHECK FAILED: get_reserve_flow_sums missing';
  end if;
  if v_secdef is distinct from false then
    raise exception 'SELF-CHECK FAILED: get_reserve_flow_sums must be SECURITY INVOKER';
  end if;

  -- El disponible COMPONE sobre el universo propio en vez de reconstruirlo.
  perform 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'get_available_sums'
     and pg_get_functiondef(p.oid) ilike '%get_account_balance_sums%';
  if not found then
    raise exception 'SELF-CHECK FAILED: get_available_sums does not derive from get_account_balance_sums';
  end if;

  -- El corte temporal usa el timezone financiero, nunca current_date a secas.
  perform 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname in ('get_available_sums', 'get_reserve_flow_sums')
     and pg_get_functiondef(p.oid) not ilike '%America/Argentina/Buenos_Aires%';
  if found then
    raise exception 'SELF-CHECK FAILED: a reserve function computes its cut without the AR financial timezone';
  end if;

  raise notice 'availability reserve validated: no account anchor, RLS with 4 policies, two SECURITY INVOKER reads composing on the owned set.';
end $check$;

select '✓ 0057 availability reserve applied' as status;

commit;
