-- El propósito se separa de la reserva: repartir lo guardado, no etiquetar filas.
--
-- Run AFTER 0058_savings_purpose.sql.
--
-- CORRIGE A 0058. Esa migración puso `purpose_id` en `availability_reserve`, es
-- decir ató el propósito a UNA FILA HISTÓRICA. Parece lo simple y está mal por la
-- misma razón por la que una reserva no tiene `account_id`: **la plata guardada
-- es fungible**.
--
-- No existen "los $300.000 guardados el 15/7". Existe "hay $190.000 guardados".
-- Si de esos $300.000 el usuario ya volvió a usar parte, etiquetar esa fila
-- afirma que hay $300.000 apartados para algo — y deja al grupo sin etiqueta en
-- NEGATIVO mientras el total sigue cerrando. Es exactamente el estado que el piso
-- por propósito existía para impedir, entrando por la puerta de atrás.
--
-- Y no se arregla validando: con filas de 300.000, 600.000, 10.000 y 200.000 no
-- hay forma de expresar "150.000 son para Japón". El problema no es el control,
-- es la unidad. La pregunta correcta no es
--
--     ¿para qué fue este guardado viejo?
--
-- sino
--
--     de lo que tengo guardado HOY, ¿cuánto es para Japón?
--
-- Cada verbo con su tabla:
--
--   availability_reserve         guardar ⇄ volver a usar   → mueve el disponible
--   savings_purpose_allocation   destinar ⇄ quitar destino → NO mueve ningún total
--
-- «Sin destino» deja de ser filas y pasa a ser **el resto**, derivado:
-- `guardado − lo repartido`. Que es lo que honestamente es: no un propósito, sino
-- lo que sobra. Sigue siendo un grupo para el usuario, con las mismas reglas.
--
-- Tres cosas se acomodan solas:
--
--   · Borrar un propósito ya NO PUEDE tocar plata, y no porque lo cuidemos: la
--     plata vive en `availability_reserve`, que los propósitos ni rozan. El
--     self-check de 0058 sobre la regla de borrado deja de hacer falta porque el
--     peligro deja de existir.
--   · La fase 4 pide montos, no filas: "US$ 3.000 de los US$ 5.000 para Japón".
--   · La fase 3 puede decir "este plazo fijo respalda Japón" sin inventar una
--     reserva falsa para plata que ya salió de la cuenta.

begin;

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. savings_purpose_allocation — cuánto de lo guardado es para qué
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Monto CON SIGNO, como las reservas: destinar es positivo, quitar es negativo, y
-- lo repartido a un propósito se DERIVA de la suma de sus filas. Ningún total se
-- persiste, igual que en todo el resto de Grana.
--
-- ON DELETE CASCADE hacia el propósito, y acá es lo correcto —no como habría sido
-- en 0058—: borrar un propósito borra su REPARTO, y el dinero vuelve al resto
-- solo, sin que nadie lo mueva. La plata está en otra tabla que este borrado no
-- toca.

create table public.savings_purpose_allocation (
  id            uuid          primary key default gen_random_uuid(),
  user_id       uuid          not null references auth.users(id) on delete cascade,
  purpose_id    uuid          not null references public.savings_purpose(id) on delete cascade,
  currency_code text          not null references public.currencies(code),
  amount        numeric(18,2) not null,
  date          date          not null,
  created_at    timestamptz   not null default now(),
  constraint chk_purpose_allocation_amount_nonzero check (amount <> 0)
);

create index idx_purpose_allocation_user_currency
  on public.savings_purpose_allocation (user_id, currency_code, date);

create index idx_purpose_allocation_purpose
  on public.savings_purpose_allocation (purpose_id);

alter table public.savings_purpose_allocation enable row level security;

create policy "users read own purpose allocations"
  on public.savings_purpose_allocation for select
  using (user_id = auth.uid());

create policy "users insert own purpose allocations"
  on public.savings_purpose_allocation for insert
  with check (user_id = auth.uid());

create policy "users update own purpose allocations"
  on public.savings_purpose_allocation for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "users delete own purpose allocations"
  on public.savings_purpose_allocation for delete
  using (user_id = auth.uid());

comment on table public.savings_purpose_allocation is
  'Cuánto del guardado actual está apartado para cada propósito, por moneda. Monto con signo (apartar +, soltar −); el reparto de un propósito se deriva de la suma de sus filas. NO afecta el disponible ni el total guardado: es un corte de lo que ya está guardado, no un acto sobre la plata.';

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. Fuera `availability_reserve.purpose_id`
-- ═══════════════════════════════════════════════════════════════════════════
--
-- La tabla de reservas vuelve a contestar UNA sola pregunta: cuánto guardaste o
-- volviste a usar. Para qué es lo contesta la otra.

drop index if exists public.idx_availability_reserve_purpose;

alter table public.availability_reserve
  drop column if exists purpose_id;

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. El invariante, en la base
-- ═══════════════════════════════════════════════════════════════════════════
--
--     por moneda:     suma repartida  <=  total guardado
--     por propósito:  suma repartida  >=  0
--
-- Vive en un trigger y no en la mutación, y la diferencia importa: el invariante
-- lo pueden romper DOS tablas distintas. Apartar de más lo rompe por arriba;
-- volver a usar plata que ya estaba repartida lo rompe por abajo, sin tocar
-- ninguna fila de reparto. Un control en el write path tendría que estar en los
-- dos lados y acordarse para siempre — que es exactamente la forma del bug que
-- 0051 sacó de producción. Acá no hay call site que pueda olvidarse.
--
-- SIN corte temporal, a propósito: el invariante es sobre TODAS las filas, no
-- sobre las vigentes a una fecha. Una reserva futura ya existe como decisión, y
-- permitir repartir contra ella y no contra el corte dejaría el estado dependiendo
-- de qué día se mire.

create or replace function public.assert_purpose_allocation_fits()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user     uuid;
  v_currency text;
  v_reserved numeric;
  v_alloc    numeric;
  v_negative record;
begin
  v_user     := coalesce(new.user_id, old.user_id);
  v_currency := coalesce(new.currency_code, old.currency_code);

  select coalesce(sum(r.amount), 0)
    into v_reserved
    from public.availability_reserve r
   where r.user_id = v_user
     and r.currency_code = v_currency;

  select coalesce(sum(a.amount), 0)
    into v_alloc
    from public.savings_purpose_allocation a
   where a.user_id = v_user
     and a.currency_code = v_currency;

  if v_alloc > v_reserved then
    raise exception
      'allocation_exceeds_reserved: en % hay % guardado y % repartido entre propósitos.',
      v_currency, v_reserved, v_alloc
      using errcode = 'check_violation';
  end if;

  select a.purpose_id, sum(a.amount) as total
    into v_negative
    from public.savings_purpose_allocation a
   where a.user_id = v_user
     and a.currency_code = v_currency
   group by a.purpose_id
  having sum(a.amount) < 0
   limit 1;

  if found then
    raise exception
      'purpose_allocation_negative: el propósito % quedaría en % en %.',
      v_negative.purpose_id, v_negative.total, v_currency
      using errcode = 'check_violation';
  end if;

  return null;
end;
$$;

comment on function public.assert_purpose_allocation_fits() is
  'Invariante del reparto: lo apartado nunca supera lo guardado, y ningún propósito queda negativo. Se dispara desde las DOS tablas porque las dos lo pueden romper — apartar de más por arriba, volver a usar lo repartido por abajo.';

create trigger trg_purpose_allocation_fits
  after insert or update or delete on public.savings_purpose_allocation
  for each row execute function public.assert_purpose_allocation_fits();

create trigger trg_reserve_keeps_allocation_valid
  after insert or update or delete on public.availability_reserve
  for each row execute function public.assert_purpose_allocation_fits();

-- ═══════════════════════════════════════════════════════════════════════════
-- 4. get_purpose_sums — el reparto, con «Sin destino» derivado
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Reemplaza a la versión de 0058, que leía `availability_reserve.purpose_id`.
-- Misma forma de salida para no mover a los consumidores: una fila por
-- (propósito, moneda), y `purpose_id` nulo es «Sin destino».
--
-- La diferencia es de dónde sale el nulo: ya no es un grupo de filas, es **el
-- resto** — guardado menos lo repartido — y se calcula UNA vez, acá. Que el resto
-- lo derive cada consumidor sería exactamente el problema de 0051 otra vez, y
-- encima con un número que puede no cerrar contra el total.
--
-- Devuelve el resto de toda moneda que tenga guardado o reparto, incluso cuando
-- da cero: el write path lo lee como piso y necesita un cero explícito, no la
-- ausencia de la fila.

create or replace function public.get_purpose_sums(
  p_today date default null
)
returns table (
  purpose_id    uuid,
  purpose_name  text,
  purpose_icon  text,
  currency_code text,
  reserved      numeric
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
allocated as (
  select a.purpose_id, a.currency_code as code, sum(a.amount)::numeric as total
  from public.savings_purpose_allocation a
  where a.date <= (select d from cut)
    and a.currency_code in ('ARS', 'USD')
  group by a.purpose_id, a.currency_code
),
reserves as (
  select r.currency_code as code, sum(r.amount)::numeric as total
  from public.availability_reserve r
  where r.date <= (select d from cut)
    and r.currency_code in ('ARS', 'USD')
  group by r.currency_code
),
codes as (
  select code from reserves
  union
  select code from allocated
)
select
  al.purpose_id                        as purpose_id,
  p.name                               as purpose_name,
  p.icon                               as purpose_icon,
  al.code                              as currency_code,
  coalesce(al.total, 0.00)::numeric    as reserved
from allocated al
join public.savings_purpose p on p.id = al.purpose_id

union all

-- «Sin destino»: el resto, derivado una sola vez.
select
  null::uuid                                                            as purpose_id,
  null::text                                                            as purpose_name,
  null::text                                                            as purpose_icon,
  c.code                                                                as currency_code,
  (coalesce(r.total, 0.00) - coalesce(a.total, 0.00))::numeric          as reserved
from codes c
left join reserves r on r.code = c.code
left join (
  select code, sum(total)::numeric as total from allocated group by code
) a on a.code = c.code
$$;

comment on function public.get_purpose_sums(date) is
  'Definición normativa del reparto de lo guardado, por (propósito, moneda), cortado a hoy. purpose_id NULL es «Sin destino» y es EL RESTO —guardado menos lo repartido—, derivado acá y en ningún otro lado. Dos consumidores: el detalle agrupado y el piso del write path.';

revoke execute on function public.get_purpose_sums(date) from public;
grant  execute on function public.get_purpose_sums(date) to authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- 5. write_reserve — guardar o volver a usar, con su reparto, en un solo acto
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Guardar "para Japón" son DOS filas en dos tablas: la reserva y su reparto. Si
-- se escriben con dos llamadas desde el cliente, entre una y otra puede fallar la
-- red y quedar la mitad: plata guardada que el usuario pidió apartar y quedó sin
-- apartar, sin que nada avise. No corrompe ningún total —el invariante sigue
-- valiendo— pero es un estado que el usuario no pidió.
--
-- Acá las dos van en el cuerpo de una función, o sea en una transacción: si la
-- segunda falla, la primera no queda.
--
-- El ORDEN importa y no es simétrico:
--
--   guardar        reserva primero  → sube el techo, después se reparte
--   volver a usar  reparto primero  → baja lo repartido, después baja el techo
--
-- Al revés, cada operación se cruzaría con su propio invariante a mitad de camino.
--
-- `p_amount` viene CON SIGNO desde el write path, que es el único que decide la
-- dirección a partir del verbo que el usuario tocó.
--
-- SECURITY INVOKER: el usuario sale de `auth.uid()` y no del cliente, así que RLS
-- aplica igual que en un insert directo y no hay forma de escribir en nombre de
-- otro.

create or replace function public.write_reserve(
  p_amount     numeric,
  p_currency   text,
  p_date       date,
  p_purpose_id uuid default null
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user     uuid := auth.uid();
  v_reserve  uuid;
begin
  if v_user is null then
    raise exception 'unauthorized' using errcode = 'insufficient_privilege';
  end if;

  if p_amount = 0 then
    raise exception 'amount_zero' using errcode = 'check_violation';
  end if;

  -- El propósito tiene que ser del usuario, y el `user_id` va EXPLÍCITO aunque
  -- RLS ya acote la lectura. En el resto del repo repetir el criterio de RLS es
  -- duplicación; acá no: esto no es un filtro de listado, es la decisión de
  -- seguridad de la función, y hacerla depender de qué rol la ejecute la vuelve
  -- silenciosamente permisiva para cualquier caller privilegiado. La FK sola
  -- tampoco mira dueños.
  if p_purpose_id is not null
     and not exists (
       select 1 from public.savings_purpose
       where id = p_purpose_id and user_id = v_user
     ) then
    raise exception 'purpose_not_found' using errcode = 'foreign_key_violation';
  end if;

  if p_amount > 0 then
    insert into public.availability_reserve (user_id, currency_code, amount, date)
    values (v_user, p_currency, p_amount, p_date)
    returning id into v_reserve;

    if p_purpose_id is not null then
      insert into public.savings_purpose_allocation
        (user_id, purpose_id, currency_code, amount, date)
      values (v_user, p_purpose_id, p_currency, p_amount, p_date);
    end if;
  else
    if p_purpose_id is not null then
      insert into public.savings_purpose_allocation
        (user_id, purpose_id, currency_code, amount, date)
      values (v_user, p_purpose_id, p_currency, p_amount, p_date);
    end if;

    insert into public.availability_reserve (user_id, currency_code, amount, date)
    values (v_user, p_currency, p_amount, p_date)
    returning id into v_reserve;
  end if;

  return v_reserve;
end;
$$;

comment on function public.write_reserve(numeric, text, date, uuid) is
  'Guardar (+) o volver a usar (−), con su reparto opcional, en una sola transacción. El orden de las dos escrituras no es simétrico: guardar sube el techo antes de repartir, volver a usar baja el reparto antes que el techo.';

revoke execute on function public.write_reserve(numeric, text, date, uuid) from public;
grant  execute on function public.write_reserve(numeric, text, date, uuid) to authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- 6. Self-check — la reserva no vuelve a saber para qué es
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Reemplaza al self-check de 0058 sobre la regla de borrado, que ya no aplica.
-- Lo que hay que impedir ahora es que alguien reintroduzca el propósito en la
-- fila de la reserva: volvería a atar plata fungible a un hecho puntual, y el
-- síntoma —un grupo en negativo con el total cerrando— es de los que no rompen
-- ninguna lectura y por eso no los encuentra ninguna suite.

do $check$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'availability_reserve'
      and column_name = 'purpose_id'
  ) then
    raise exception
      'availability_reserve no puede tener purpose_id: la plata guardada es fungible y el propósito se reparte en savings_purpose_allocation. Ver el encabezado de 0059.';
  end if;
end
$check$;

commit;
